"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useOrg } from '@/app/context/OrgContext';

export default function RUBSPage() {
  const { orgId } = useOrg();
  const[properties, setProperties] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  
  const [billAmount, setBillAmount] = useState('');
  const [billDescription, setBillDescription] = useState('Water & Sewer - Master Bill');
  const [dueDate, setDueDate] = useState('');
  
  const [rubsPreview, setRubsPreview] = useState<any[]>([]);
  const[isProcessing, setIsProcessing] = useState(false);

  useEffect(function loadData() {
    async function fetchProps() {
      const { data } = await supabase.from('properties').select('*').order('name');
      if (data) setProperties(data);
    }
    if (orgId) fetchProps();
  }, [orgId]);

  async function calculateRUBS() {
    if (!selectedProperty || !billAmount || !dueDate) return alert("Fill out all fields.");
    try {
      const { data: spaces } = await supabase.from('spaces').select('*, leases(*, tenants(name))').eq('property_id', selectedProperty.id);
      const totalPropSqft = Number(selectedProperty.total_sqft);
      if (totalPropSqft <= 0) throw new Error("Property must have a total square footage set in its profile.");

      const previews =[];
      let totalAllocated = 0;

      if (spaces) {
        for (const space of spaces) {
          if (space.leases && space.leases.length > 0 && space.leases[0].status === 'Active') {
            const lease = space.leases[0];
            const proRataPercent = Number(space.square_footage) / totalPropSqft;
            const tenantShare = Number(billAmount) * proRataPercent;
            
            previews.push({
              tenantId: lease.tenant_id,
              leaseId: lease.id,
              tenantName: lease.tenants?.name,
              spaceName: space.name,
              proRata: (proRataPercent * 100).toFixed(2),
              amount: tenantShare
            });
            totalAllocated += tenantShare;
          }
        }
      }
      setRubsPreview(previews);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function generateInvoices() {
    if (!confirm("Generate these utility invoices for the tenants?")) return;
    setIsProcessing(true);
    try {
      const newInvoices = rubsPreview.map(p => ({
        tenant_id: p.tenantId,
        lease_id: p.leaseId,
        amount: p.amount,
        description: `RUBS Utility Bill: ${billDescription}`,
        due_date: dueDate,
        status: 'Unpaid',
        organization_id: orgId
      }));

      await supabase.from('tenant_invoices').insert(newInvoices);
      alert("RUBS Invoices Successfully Generated!");
      setRubsPreview([]); setBillAmount('');
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsProcessing(false); }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4">
        <h2 className="text-xl font-semibold text-gray-800">RUBS Calculator (Ratio Utility Billing)</h2>
      </header>
      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">Property</label><select className="w-full border p-2 rounded outline-none" onChange={(e) => setSelectedProperty(properties.find(p => p.id === e.target.value))}><option value="">-- Select Property --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">Master Bill Amount ($)</label><input type="number" className="w-full border p-2 rounded outline-none font-bold text-blue-600" value={billAmount} onChange={(e) => setBillAmount(e.target.value)} /></div>
          <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">Bill Description</label><input type="text" className="w-full border p-2 rounded outline-none" value={billDescription} onChange={(e) => setBillDescription(e.target.value)} /></div>
          <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-1">Tenant Due Date</label><input type="date" className="w-full border p-2 rounded outline-none" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <button onClick={calculateRUBS} className="bg-blue-600 text-white px-6 py-2 rounded font-bold h-[42px]">Calculate Splits</button>
        </div>

        {rubsPreview.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Proposed Utility Invoices</h3>
              <button onClick={generateInvoices} disabled={isProcessing} className="bg-green-600 text-white px-6 py-2 rounded font-bold">{isProcessing ? 'Processing...' : 'Approve & Bill Tenants ✓'}</button>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tenant</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Space</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Pro-Rata Share</th><th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Invoice Amount</th></tr></thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {rubsPreview.map((p, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-bold text-blue-600">{p.tenantName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.spaceName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{p.proRata}%</td>
                    <td className="px-6 py-4 text-sm text-right font-black text-red-600">${p.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}