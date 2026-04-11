"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function CAMPage() {
  const [activeTab, setActiveTab] = useState('recon'); // 'recon' or 'budget'
  const[properties, setProperties] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  
  // Recon State
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [expenses, setExpenses] = useState(0);
  const[reconciliations, setReconciliations] = useState<any[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // Budget State
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetPreviews, setBudgetPreviews] = useState<any[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    async function fetchProps() {
      const { data } = await supabase.from('properties').select('*').order('name');
      if (data) setProperties(data);
    }
    fetchProps();
  },[]);

  // --- RECONCILIATION LOGIC ---
  async function generateCAM() {
    if (!selectedProperty) return alert("Select a property first.");
    setIsCalculating(true);
    try {
      const startDate = `${year}-01-01`; const endDate = `${year}-12-31`;
      const { data: journalEntries } = await supabase.from('journal_entries').select('debit, chart_of_accounts(account_type), transactions(date)').eq('property_id', selectedProperty.id).eq('chart_of_accounts.account_type', 'Expense').gte('transactions.date', startDate).lte('transactions.date', endDate);
      const totalExpenses = journalEntries?.reduce((sum, entry) => sum + Number(entry.debit), 0) || 0;
      setExpenses(totalExpenses);

      const { data: spaces } = await supabase.from('spaces').select('*, leases(*, tenants(name))').eq('property_id', selectedProperty.id);
      const recs =[];
      if (spaces) {
        for (const space of spaces) {
          if (space.leases && space.leases.length > 0) {
            const lease = space.leases[0];
            const proRataPercent = (Number(space.square_footage) / Number(selectedProperty.total_sqft));
            const tenantShareOfExpenses = totalExpenses * proRataPercent;
            const totalPaid = Number(lease.cam_charge || 0) * 12;
            recs.push({ tenantName: lease.tenants?.name, spaceName: space.name, sqft: space.square_footage, proRata: (proRataPercent * 100).toFixed(2), shareOfExpenses: tenantShareOfExpenses, amountPaid: totalPaid, balanceDue: tenantShareOfExpenses - totalPaid });
          }
        }
      }
      setReconciliations(recs);
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsCalculating(false); }
  }

  // --- NEW: BUDGETING LOGIC ---
  async function previewBudget() {
    if (!selectedProperty || !budgetAmount) return alert("Select property and enter budget.");
    try {
      const { data: spaces } = await supabase.from('spaces').select('*, leases(*, tenants(name))').eq('property_id', selectedProperty.id);
      const previews =[];
      if (spaces) {
        for (const space of spaces) {
          if (space.leases && space.leases.length > 0) {
            const lease = space.leases[0];
            const proRataPercent = (Number(space.square_footage) / Number(selectedProperty.total_sqft));
            const annualShare = Number(budgetAmount) * proRataPercent;
            const newMonthlyCam = annualShare / 12;
            previews.push({ leaseId: lease.id, tenantName: lease.tenants?.name, spaceName: space.name, proRata: (proRataPercent * 100).toFixed(2), currentCam: Number(lease.cam_charge || 0), newCam: newMonthlyCam });
          }
        }
      }
      setBudgetPreviews(previews);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function applyBudget() {
    if (!confirm("Approve these changes? This will permanently update the monthly CAM charge for all listed tenants.")) return;
    setIsApplying(true);
    try {
      for (const preview of budgetPreviews) {
        await supabase.from('leases').update({ cam_charge: preview.newCam }).eq('id', preview.leaseId);
      }
      alert("Budget Approved! Leases updated successfully.");
      setBudgetPreviews([]); setBudgetAmount('');
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsApplying(false); }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center print:hidden">
        <h2 className="text-xl font-semibold text-gray-800">CAM Management</h2>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setActiveTab('recon')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'recon' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Year-End Reconciliation</button>
          <button onClick={() => setActiveTab('budget')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'budget' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Next Year Budgeting</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100 print:bg-white print:p-0">
        
        {/* RECONCILIATION TAB */}
        {activeTab === 'recon' && (
          <div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex space-x-4 items-end print:hidden">
              <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Select Property</label><select className="w-full border p-2 rounded outline-none" onChange={(e) => setSelectedProperty(properties.find(p => p.id === e.target.value))}><option value="">-- Choose Property --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label><input type="number" className="w-32 border p-2 rounded outline-none" value={year} onChange={(e) => setYear(e.target.value)} /></div>
              <button onClick={generateCAM} disabled={isCalculating} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-bold transition h-[42px]">{isCalculating ? 'Calculating...' : 'Generate Statements'}</button>
              <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition h-[42px]">🖨️ Print</button>
            </div>

            {reconciliations.length > 0 && (
              <div className="space-y-8">
                <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl text-center">
                  <h3 className="text-blue-800 font-bold text-lg">Total Property Expenses ({year})</h3>
                  <p className="text-4xl font-black text-blue-900 mt-2">${expenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                {reconciliations.map((rec, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                    <div className="flex justify-between border-b pb-4 mb-4"><div><h3 className="text-2xl font-bold text-gray-900">{rec.tenantName}</h3><p className="text-gray-500">{selectedProperty?.name} - {rec.spaceName}</p></div><div className="text-right"><p className="font-bold text-gray-800">{year} CAM Reconciliation</p><p className="text-sm text-gray-500">Pro-Rata: {rec.proRata}%</p></div></div>
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between text-gray-700"><span>Tenant's Share of Actual Expenses:</span> <span>${rec.shareOfExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                      <div className="flex justify-between text-gray-700"><span>Less: Estimated CAM Payments Made:</span> <span className="text-red-600">- ${rec.amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                    </div>
                    <div className={`p-4 rounded-lg flex justify-between items-center font-bold text-lg ${rec.balanceDue > 0 ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-800 border-green-200'}`}>
                      <span>{rec.balanceDue > 0 ? 'Balance Due to Landlord:' : 'Credit Due to Tenant:'}</span><span>${Math.abs(rec.balanceDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NEW: BUDGETING TAB */}
        {activeTab === 'budget' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 items-end">
              <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Select Property</label><select className="w-full border p-2 rounded outline-none" onChange={(e) => setSelectedProperty(properties.find(p => p.id === e.target.value))}><option value="">-- Choose Property --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div className="flex-1"><label className="block text-sm font-medium text-gray-700 mb-1">Total Estimated Expenses (Next Year)</label><input type="number" placeholder="$0.00" className="w-full border p-2 rounded outline-none font-bold text-blue-700" value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} /></div>
              <button onClick={previewBudget} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-bold transition h-[42px]">Preview Budget</button>
            </div>

            {budgetPreviews.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">Proposed Monthly CAM Charges</h3>
                  <button onClick={applyBudget} disabled={isApplying} className={`px-4 py-2 rounded font-bold text-white transition ${isApplying ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>
                    {isApplying ? 'Applying...' : 'Approve & Apply to Leases ✓'}
                  </button>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-white"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tenant</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Pro-Rata</th><th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Current Monthly CAM</th><th className="px-6 py-3 text-right text-xs font-bold text-blue-600 uppercase">Proposed Monthly CAM</th></tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {budgetPreviews.map(p => (
                      <tr key={p.leaseId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{p.tenantName} <span className="text-xs text-gray-500 font-normal block">{p.spaceName}</span></td>
                        <td className="px-6 py-4 text-sm text-gray-600">{p.proRata}%</td>
                        <td className="px-6 py-4 text-sm text-right text-gray-500">${p.currentCam.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-right font-black text-blue-600">${p.newCam.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </main>
    </>
  );
}