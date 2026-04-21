"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function BillingPage() {
  const[invoices, setInvoices] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const[sendEmails, setSendEmails] = useState(true);
  
  const[isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  // NEW: Credit/Waive State
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const[selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [creditReason, setCreditReason] = useState('');
  const [isProcessingCredit, setIsProcessingCredit] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: iData } = await supabase.from('tenant_invoices').select('*, tenants(name, contact_email), leases(property_id, spaces(name, properties(name)))').order('due_date', { ascending: false });
      if (iData) setInvoices(iData);
      const { data: aData } = await supabase.from('chart_of_accounts').select('*');
      if (aData) setAccounts(aData);
      const { data: tData } = await supabase.from('tenants').select('*').order('name');
      if (tData) setTenants(tData);
    }
    fetchData();
  },[]);

  async function generateMonthlyRent() {
    if (!confirm("Generate rent invoices for all active leases?")) return;
    setIsGenerating(true);
    try {
      const { data: leases } = await supabase.from('leases').select('*, tenants(name, contact_email, status)').eq('tenants.status', 'active');
      if (!leases || leases.length === 0) throw new Error("No active leases found.");

      const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1); nextMonth.setDate(1);
      const dueDate = nextMonth.toISOString().split('T')[0];
      const monthName = nextMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

      const newInvoices = []; const emailsToSend =[];
      for (const lease of leases) {
        const totalRent = Number(lease.base_rent_amount || 0) + Number(lease.cam_charge || 0) + Number(lease.tax_charge || 0) + Number(lease.insurance_charge || 0);
        if (totalRent > 0) {
          newInvoices.push({ tenant_id: lease.tenant_id, lease_id: lease.id, amount: totalRent, description: `${monthName} Rent & Escrows`, due_date: dueDate, status: 'Unpaid' });
          if (sendEmails && lease.tenants?.contact_email) {
            emailsToSend.push({ to: lease.tenants.contact_email, subject: `Invoice Available: ${monthName} Rent`, text: `Your rent invoice for ${monthName} ($${totalRent.toFixed(2)}) is due on ${dueDate}. Pay here: https://app.ophircre.com/portal-login` });
          }
        }
      }
      const { error } = await supabase.from('tenant_invoices').insert(newInvoices);
      if (error) throw error;
      if (emailsToSend.length > 0) {
        for (const email of emailsToSend) await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(email) });
      }
      alert(`Generated ${newInvoices.length} invoices!`);
      const { data } = await supabase.from('tenant_invoices').select('*, tenants(name, contact_email), leases(property_id, spaces(name, properties(name)))').order('due_date', { ascending: false });
      if (data) setInvoices(data);
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsGenerating(false); }
  }

  async function markAsPaid(inv: any) {
    try {
      await supabase.from('tenant_invoices').update({ status: 'Paid' }).eq('id', inv.id);
      const revenueAcc = accounts.find(a => a.name.includes('Rental Income') || a.account_type === 'Revenue')?.id;
      const { data: txnData, error: txnErr } = await supabase.from('transactions').insert([{ date: new Date().toISOString().split('T')[0], description: `Rent Payment - ${inv.tenants?.name}`, total_amount: inv.amount, status: 'Approved' }]).select().single();
      if (txnErr) throw txnErr;
      await supabase.from('journal_entries').insert([{ transaction_id: txnData.id, account_id: revenueAcc, property_id: inv.leases?.property_id || null, description: inv.description, debit: 0, credit: inv.amount }]);
      alert("Payment recorded!");
      const { data } = await supabase.from('tenant_invoices').select('*, tenants(name, contact_email), leases(property_id, spaces(name, properties(name)))').order('due_date', { ascending: false });
      if (data) setInvoices(data);
    } catch (error: any) { alert("Ledger Sync Error: " + error.message); }
  }

  // NEW: Process Credit / Waive Fee
  async function processCredit(e: any) {
    e.preventDefault();
    if (!creditReason) return alert("Please provide a reason for the credit.");
    setIsProcessingCredit(true);

    try {
      // 1. Mark Invoice as Waived
      await supabase.from('tenant_invoices').update({ status: 'Waived/Credited' }).eq('id', selectedInvoice.id);

      // 2. Find the Concessions/Bad Debt account
      let concessionAcc = accounts.find(a => a.name.includes('Concession') || a.name.includes('Bad Debt'))?.id;
      
      // If they don't have one, create it automatically!
      if (!concessionAcc) {
        const { data: newAcc } = await supabase.from('chart_of_accounts').insert([{ name: 'Rent Concessions & Bad Debt', account_type: 'Expense' }]).select().single();
        if (newAcc) concessionAcc = newAcc.id;
      }

      // 3. Log the loss in the General Ledger
      const { data: txnData, error: txnErr } = await supabase.from('transactions').insert([{
        date: new Date().toISOString().split('T')[0],
        description: `CREDIT ISSUED - ${selectedInvoice.tenants?.name}`,
        total_amount: selectedInvoice.amount,
        status: 'Approved'
      }]).select().single();
      if (txnErr) throw txnErr;

      await supabase.from('journal_entries').insert([{
        transaction_id: txnData.id,
        account_id: concessionAcc,
        property_id: selectedInvoice.leases?.property_id || null,
        description: `Reason: ${creditReason} (Original Inv: ${selectedInvoice.description})`,
        debit: selectedInvoice.amount, // Expense is a debit
        credit: 0
      }]);

      alert("Invoice waived and Concession logged in General Ledger!");
      setIsCreditModalOpen(false);
      setCreditReason('');
      
      const { data } = await supabase.from('tenant_invoices').select('*, tenants(name, contact_email), leases(property_id, spaces(name, properties(name)))').order('due_date', { ascending: false });
      if (data) setInvoices(data);
    } catch (error: any) {
      alert("Error processing credit: " + error.message);
    } finally {
      setIsProcessingCredit(false);
    }
  }

  function printStatement() {
    if (!selectedTenantId) return alert("Select a tenant first.");
    const tenant = tenants.find(t => t.id === selectedTenantId);
    const tenantInvoices = invoices.filter(i => i.tenant_id === selectedTenantId).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const balance = tenantInvoices.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').reduce((sum, i) => sum + Number(i.amount), 0);

    let html = `<html><head><title>Statement - ${tenant.name}</title><style>body{font-family:sans-serif;padding:40px;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border-bottom:1px solid #ddd;padding:10px;text-align:left;} th{background:#f9fafb;}</style></head><body>`;
    html += `<h2>OphirCRE Management</h2><h1>Statement of Account</h1><p><strong>Tenant:</strong> ${tenant.name}</p><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p><p><strong>Total Balance Due:</strong> $${balance.toFixed(2)}</p>`;
    html += `<table><thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>`;
    tenantInvoices.forEach(inv => {
      html += `<tr><td>${inv.due_date}</td><td>${inv.description}</td><td>$${Number(inv.amount).toFixed(2)}</td><td>${inv.status}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;

    const printWindow = window.open('', '_blank');
    printWindow?.document.write(html);
    printWindow?.document.close();
    printWindow?.print();
    setIsStatementModalOpen(false);
  }

  const unpaidTotal = invoices.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Tenant Billing & Collections</h2>
        <div className="flex items-center space-x-4">
          <button onClick={() => setIsStatementModalOpen(true)} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">🖨️ Print Statement</button>
          <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" /><span>Email Tenants</span>
          </label>
          <button onClick={generateMonthlyRent} disabled={isGenerating} className={`px-4 py-2 rounded-md font-medium text-white transition shadow-sm ${isGenerating ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isGenerating ? 'Generating...' : '⚡ Auto-Bill Next Month'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-800">All Invoices</h3>
            <span className="text-sm font-medium text-gray-600">Total Outstanding: <span className="text-red-600 font-bold">${unpaidTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></span>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tenant</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Description</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Due Date</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Amount</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th><th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th></tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-bold text-blue-600">{inv.tenants?.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{inv.description}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{inv.due_date}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">${Number(inv.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === 'Paid' ? 'bg-green-100 text-green-800' : inv.status === 'Waived/Credited' ? 'bg-gray-100 text-gray-800' : inv.status === 'Overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{inv.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {(inv.status === 'Unpaid' || inv.status === 'Overdue') && (
                      <>
                        <button onClick={() => { setSelectedInvoice(inv); setIsCreditModalOpen(true); }} className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded font-bold transition">Waive / Credit</button>
                        <button onClick={() => markAsPaid(inv)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded font-bold transition">Mark Paid</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No invoices on file.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* CREDIT / WAIVE MODAL */}
        {isCreditModalOpen && selectedInvoice && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-2 text-gray-800">Waive Fee or Issue Credit</h3>
              <p className="text-sm text-gray-500 mb-6">You are waiving <strong>${Number(selectedInvoice.amount).toFixed(2)}</strong> for {selectedInvoice.tenants?.name}. This will be logged as a Rent Concession / Bad Debt expense in your General Ledger.</p>
              <form onSubmit={processCredit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Reason for Credit *</label>
                  <input type="text" required placeholder="e.g., Courtesy late fee waiver, AC broken credit" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={creditReason} onChange={(e) => setCreditReason(e.target.value)} />
                </div>
                <div className="flex justify-end space-x-3 pt-4 mt-2 border-t">
                  <button type="button" onClick={() => setIsCreditModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" disabled={isProcessingCredit} className={`px-6 py-2 rounded font-bold text-white transition shadow-sm ${isProcessingCredit ? 'bg-orange-400' : 'bg-orange-600 hover:bg-orange-700'}`}>
                    {isProcessingCredit ? 'Processing...' : 'Confirm & Log Concession'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* STATEMENT MODAL */}
        {isStatementModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-96">
              <h3 className="text-xl font-bold mb-4">Generate Statement</h3>
              <select className="w-full border p-2 rounded outline-none mb-6" value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)}>
                <option value="">-- Select Tenant --</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="flex justify-end space-x-3">
                <button onClick={() => setIsStatementModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                <button onClick={printStatement} className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700">Generate PDF</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}