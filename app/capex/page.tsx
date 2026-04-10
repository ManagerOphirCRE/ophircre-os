"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function CapExPage() {
  const[assets, setAssets] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [propertyId, setPropertyId] = useState('');
  const [desc, setDesc] = useState('');
  const [cost, setCost] = useState('');
  const [date, setDate] = useState('');
  const [life, setLife] = useState('39');

  useEffect(() => {
    async function fetchData() {
      const { data: aData } = await supabase.from('capex_assets').select('*, properties(name)').order('date_in_service', { ascending: false });
      if (aData) setAssets(aData);
      const { data: pData } = await supabase.from('properties').select('*').order('name');
      if (pData) setProperties(pData);
    }
    fetchData();
  },[]);

  async function saveAsset(e: any) {
    e.preventDefault(); setIsSaving(true);
    try {
      await supabase.from('capex_assets').insert([{ property_id: propertyId, description: desc, cost: Number(cost), date_in_service: date, useful_life_years: Number(life) }]);
      setPropertyId(''); setDesc(''); setCost(''); setDate(''); setLife('39');
      const { data } = await supabase.from('capex_assets').select('*, properties(name)').order('date_in_service', { ascending: false });
      if (data) setAssets(data);
      alert("CapEx Asset Logged!");
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSaving(false); }
  }

  return (
    <main className="flex-1 overflow-y-auto p-8 bg-gray-100 print:bg-white print:p-0">
      <header className="mb-8 flex justify-between items-center print:hidden">
        <h2 className="text-2xl font-bold text-gray-800">CapEx & Depreciation Schedule</h2>
        <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded-md font-medium">🖨️ Print Schedule</button>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Asset / Improvement</th><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Property</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Cost Basis</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Useful Life</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-900 uppercase">Annual Depreciation</th></tr></thead>
            <tbody className="divide-y divide-gray-200">
              {assets.map(a => {
                const annualDep = Number(a.cost) / Number(a.useful_life_years);
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4"><p className="font-bold text-gray-900">{a.description}</p><p className="text-xs text-gray-500">In Service: {a.date_in_service}</p></td>
                    <td className="px-4 py-4 text-sm text-blue-600">{a.properties?.name}</td>
                    <td className="px-4 py-4 text-sm text-right font-medium">${Number(a.cost).toLocaleString()}</td>
                    <td className="px-4 py-4 text-sm text-right text-gray-500">{a.useful_life_years} Yrs</td>
                    <td className="px-4 py-4 text-sm text-right font-bold text-green-700">${annualDep.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}/yr</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit print:hidden">
          <h3 className="font-bold text-gray-800 mb-4">Log Capital Expenditure</h3>
          <form onSubmit={saveAsset} className="space-y-4">
            <select required className="w-full border p-2 rounded outline-none" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">-- Select Property --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <input type="text" required placeholder="Description (e.g. New TPO Roof)" className="w-full border p-2 rounded outline-none" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <input type="number" required placeholder="Total Cost ($)" className="w-full border p-2 rounded outline-none" value={cost} onChange={(e) => setCost(e.target.value)} />
            <div><label className="block text-xs text-gray-500 mb-1">Date Placed in Service</label><input type="date" required className="w-full border p-2 rounded outline-none" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="block text-xs text-gray-500 mb-1">IRS Useful Life (Years)</label><select className="w-full border p-2 rounded outline-none" value={life} onChange={(e) => setLife(e.target.value)}><option value="27.5">27.5 (Residential)</option><option value="39">39 (Commercial)</option><option value="15">15 (Land Improvements)</option><option value="5">5 (Appliances/Carpet)</option></select></div>
            <button type="submit" disabled={isSaving} className="w-full bg-blue-600 text-white py-2 rounded font-bold">{isSaving ? 'Saving...' : 'Log Asset'}</button>
          </form>
        </div>
      </div>
    </main>
  );
}