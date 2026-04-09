"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function DepositsPage() {
  const [leases, setLeases] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Disposition Modal State
  const[selectedLease, setSelectedLease] = useState<any>(null);
  const[deductions, setDeductions] = useState([{ description: '', amount: '' }]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchDeposits();
  },[]);

  async function fetchDeposits() {
    const { data } = await supabase
      .from('leases')
      .select('*, tenants(name, status), spaces(name, properties(name))')
      .gt('security_deposit', 0)
      .order('end_date', { ascending: true });
    
    if (data) setLeases(data);
    setIsLoading(false);
  }

  function addDeductionRow() {
    setDeductions([...deductions, { description: '', amount: '' }]);
  }

  function updateDeduction(index: number, field: string, value: string) {
    const newDeds = [...deductions];
    newDeds[index] = { ...newDeds[index], [field]: value };
    setDeductions(newDeds);
  }

  async function processDisposition() {
    if (!confirm("Finalize this disposition? This will generate a statement and zero out the held deposit.")) return;
    setIsProcessing(true);

    try {
      const totalDeductions = deductions.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const refundAmount = Number(selectedLease.security_deposit) - totalDeductions;

      // 1. Format the Disposition Letter
      let letterHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Disposition of Security Deposit</h2>
          <p><strong>Tenant:</strong> ${selectedLease.tenants?.name}</p>
          <p><strong>Premises:</strong> ${selectedLease.spaces?.properties?.name} - ${selectedLease.spaces?.name}</p>
          <hr/>
          <p><strong>Original Deposit Held:</strong> $${Number(selectedLease.security_deposit).toFixed(2)}</p>
          <h3>Itemized Deductions:</h3>
          <ul>
            ${deductions.filter(d => d.description && d.amount).map(d => `<li>${d.description}: -$${Number(d.amount).toFixed(2)}</li>`).join('')}
            ${deductions.length === 0 || totalDeductions === 0 ? '<li>No deductions.</li>' : ''}
          </ul>
          <hr/>
          <h3><strong>Total Refund Due: $${refundAmount.toFixed(2)}</strong></h3>
          <p>If a refund is due, a check will be mailed to your forwarding address within the legally required timeframe.</p>
        </div>
      `;

      // 2. Save it to Communications History
      await supabase.from('communications').insert([{
        tenant_id: selectedLease.tenant_id,
        subject: 'Official Disposition of Security Deposit',
        body: letterHtml,
        type: 'Email',
        status: 'Logged'
      }]);

      // 3. Update the Lease to show the deposit was returned/processed
      await supabase.from('leases').update({ security_deposit: 0 }).eq('id', selectedLease.id);

      alert(`Disposition Processed! Refund Due: $${refundAmount.toFixed(2)}\nThe statement has been saved to the tenant's communication history.`);
      setSelectedLease(null);
      setDeductions([{ description: '', amount: '' }]);
      fetchDeposits();
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  }

  const totalHeld = leases.reduce((sum, l) => sum + Number(l.security_deposit || 0), 0);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center print:hidden">
        <h2 className="text-xl font-semibold text-gray-800">Security Deposit Management</h2>
        <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          🖨️ Print Ledger
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100 print:bg-white print:p-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
          <div className="p-6 bg-gray-50 border-b flex justify-between items-center print:bg-white print:border-b-2 print:border-gray-800">
            <h3 className="font-bold text-gray-800">Deposits Held in Escrow</h3>
            <span className="text-sm font-medium text-gray-600">Total Portfolio Liability: <span className="text-blue-600 font-bold">${totalHeld.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></span>
          </div>

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Property & Space</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Lease End Date</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Deposit Held</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leases.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-bold text-blue-600">{l.tenants?.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{l.spaces?.properties?.name} <br/><span className="text-gray-500 text-xs">{l.spaces?.name}</span></td>
                  <td className="px-6 py-4 text-sm text-gray-500">{l.end_date}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-green-700">${Number(l.security_deposit).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  <td className="px-6 py-4 text-right print:hidden">
                    <button onClick={() => setSelectedLease(l)} className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded font-bold transition shadow-sm">
                      Process Move-Out
                    </button>
                  </td>
                </tr>
              ))}
              {leases.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No security deposits currently held.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* DISPOSITION MODAL */}
        {selectedLease && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-2 text-gray-800">Disposition of Security Deposit</h3>
              <p className="text-sm text-gray-500 mb-6">Process deductions and generate the final refund statement for <strong>{selectedLease.tenants?.name}</strong>.</p>
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex justify-between items-center mb-6">
                <span className="font-bold text-blue-800">Original Deposit Held:</span>
                <span className="text-xl font-black text-blue-900">${Number(selectedLease.security_deposit).toFixed(2)}</span>
              </div>

              <div className="mb-4 flex justify-between items-end">
                <h4 className="font-semibold text-gray-800">Itemized Deductions</h4>
                <button onClick={addDeductionRow} className="text-sm text-blue-600 font-medium hover:underline">+ Add Deduction</button>
              </div>

              <div className="space-y-3 mb-6">
                {deductions.map((ded, index) => (
                  <div key={index} className="flex space-x-2 items-center">
                    <input type="text" placeholder="Description (e.g., Drywall repair, Unpaid rent)" className="flex-1 border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" value={ded.description} onChange={(e) => updateDeduction(index, 'description', e.target.value)} />
                    <input type="number" placeholder="$0.00" className="w-32 border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 text-right text-red-600 font-bold" value={ded.amount} onChange={(e) => updateDeduction(index, 'amount', e.target.value)} />
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t mt-6">
                <div className="flex justify-between items-center mb-6">
                  <span className="font-bold text-gray-800">Final Refund Due to Tenant:</span>
                  <span className={`text-2xl font-black ${Number(selectedLease.security_deposit) - deductions.reduce((sum, d) => sum + Number(d.amount || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${(Number(selectedLease.security_deposit) - deductions.reduce((sum, d) => sum + Number(d.amount || 0), 0)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-end space-x-3">
                  <button onClick={() => setSelectedLease(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button onClick={processDisposition} disabled={isProcessing} className={`px-6 py-2 rounded font-bold text-white ${isProcessing ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>
                    {isProcessing ? 'Processing...' : 'Finalize & Generate Statement'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}