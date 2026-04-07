"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function BillingPage() {
  const[invoices, setInvoices] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(function loadInvoices() {
    fetchInvoices();
  },[]);

  async function fetchInvoices() {
    const { data } = await supabase
      .from('tenant_invoices')
      .select('*, tenants(name), leases(spaces(name, properties(name)))')
      .order('due_date', { ascending: false });
    if (data) setInvoices(data);
  }

  // The Auto-Invoicing Engine
  async function generateMonthlyRent() {
    if (!confirm("Generate rent invoices for all active leases for the 1st of next month?")) return;
    setIsGenerating(true);

    try {
      // 1. Get all active leases
      const { data: leases } = await supabase
        .from('leases')
        .select('*, tenants(status)')
        .eq('tenants.status', 'active');

      if (!leases || leases.length === 0) throw new Error("No active leases found.");

      // 2. Calculate next month's due date (1st of the month)
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      const dueDate = nextMonth.toISOString().split('T')[0];
      const monthName = nextMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

      // 3. Build the invoices
      const newInvoices =[];
      for (const lease of leases) {
        const totalRent = Number(lease.base_rent_amount || 0) + Number(lease.cam_charge || 0) + Number(lease.tax_charge || 0) + Number(lease.insurance_charge || 0);
        
        if (totalRent > 0) {
          newInvoices.push({
            tenant_id: lease.tenant_id,
            lease_id: lease.id,
            amount: totalRent,
            description: `${monthName} Rent & Escrows`,
            due_date: dueDate,
            status: 'Unpaid'
          });
        }
      }

      // 4. Insert into database
      const { error } = await supabase.from('tenant_invoices').insert(newInvoices);
      if (error) throw error;

      alert(`Successfully generated ${newInvoices.length} invoices for ${monthName}!`);
      fetchInvoices();
    } catch (error: any) {
      alert("Error generating invoices: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function markAsPaid(id: string) {
    await supabase.from('tenant_invoices').update({ status: 'Paid' }).eq('id', id);
    fetchInvoices();
  }

  const unpaidTotal = invoices.filter(i => i.status === 'Unpaid' || i.status === 'Overdue').reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Tenant Billing & Collections</h2>
        <button onClick={generateMonthlyRent} disabled={isGenerating} className={`px-4 py-2 rounded-md font-medium text-white transition shadow-sm ${isGenerating ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isGenerating ? 'Generating...' : '⚡ Auto-Bill Next Month\'s Rent'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-800">All Invoices</h3>
            <span className="text-sm font-medium text-gray-600">Total Outstanding: <span className="text-red-600 font-bold">${unpaidTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></span>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-bold text-blue-600">{inv.tenants?.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{inv.description}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{inv.due_date}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">${Number(inv.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {inv.status !== 'Paid' && (
                      <button onClick={() => markAsPaid(inv.id)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded font-bold transition">
                        Mark Paid
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No invoices generated yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}