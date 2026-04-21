"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function LeasingPipelinePage() {
  const [prospects, setProspects] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const[approvingProspect, setApprovingProspect] = useState<any>(null);
  const [selectedProperty, setSelectedProperty] = useState('');
  const[selectedSpace, setSelectedSpace] = useState('');
  const [baseRent, setBaseRent] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBroker, setSelectedBroker] = useState('');
  const[isScreening, setIsScreening] = useState('');

  useEffect(() => { fetchProspects(); fetchProperties(); fetchBrokers(); },[]);

  async function fetchProspects() {
    const { data } = await supabase.from('tenants').select('*').ilike('status', 'prospect_%').order('created_at', { ascending: false });
    if (data) setProspects(data);
  }
  async function fetchProperties() {
    const { data: pData } = await supabase.from('properties').select('*'); if (pData) setProperties(pData);
    const { data: sData } = await supabase.from('spaces').select('*'); if (sData) setSpaces(sData);
  }
  async function fetchBrokers() {
    const { data } = await supabase.from('brokers').select('*'); if (data) setBrokers(data);
  }

  async function moveProspect(id: string, newStatus: string) {
    await supabase.from('tenants').update({ status: newStatus }).eq('id', id); fetchProspects();
  }

  // NEW: Run Background Check
  async function runScreening(id: string) {
    setIsScreening(id);
    try {
      await fetch('/api/screen-tenant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: id }) });
      fetchProspects();
    } catch (e) { alert("Error running screening."); } finally { setIsScreening(''); }
  }

  function openApproveModal(prospect: any) { setApprovingProspect(prospect); setIsModalOpen(true); }

  async function finalizeLease(e: any) {
    e.preventDefault(); if (!selectedSpace) return alert("Select a space.");
    try {
      await supabase.from('leases').insert([{ tenant_id: approvingProspect.id, space_id: selectedSpace, base_rent_amount: Number(baseRent), start_date: startDate, end_date: endDate }]);
      await supabase.from('tenants').update({ status: 'active' }).eq('id', approvingProspect.id);
      if (selectedBroker) {
        const broker = brokers.find(b => b.id === selectedBroker);
        const months = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
        const estCommission = (Number(baseRent) * months) * (Number(broker.commission_rate) / 100);
        await supabase.from('tasks').insert([{ title: `APPROVE COMMISSION: ${broker.name}`, description: `Lease signed for ${approvingProspect.name}. Est commission: $${estCommission.toFixed(2)}.`, status: 'To Do' }]);
      }
      alert("Prospect approved!"); setIsModalOpen(false); fetchProspects();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  const filteredSpaces = spaces.filter(s => s.property_id === selectedProperty);
  const newApps = prospects.filter(p => p.status === 'prospect_new');
  const reviewing = prospects.filter(p => p.status === 'prospect_review');
  const negotiating = prospects.filter(p => p.status === 'prospect_negotiation');

  return (
    <main className="flex-1 overflow-y-auto p-8 bg-gray-100 relative">
      <header className="mb-8 flex justify-between items-center"><h2 className="text-2xl font-bold text-gray-800">Leasing Pipeline</h2></header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200"><h3 className="font-bold text-gray-700 mb-4">New Applications ({newApps.length})</h3><div className="space-y-3">{newApps.map(p => (<div key={p.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"><p className="font-bold text-blue-600">{p.name}</p><p className="text-xs text-gray-500 mb-3">{p.entity_type} | {p.contact_phone}</p><button onClick={() => moveProspect(p.id, 'prospect_review')} className="text-xs text-blue-600 font-bold">Move to Review →</button></div>))}</div></div>
        
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <h3 className="font-bold text-blue-800 mb-4">Under Review ({reviewing.length})</h3>
          <div className="space-y-3">
            {reviewing.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                <p className="font-bold text-blue-600">{p.name}</p>
                
                {/* NEW: Screening UI */}
                <div className="my-3 p-2 bg-gray-50 rounded border text-xs">
                  <span className="font-bold text-gray-700 block mb-1">Screening Status: {p.screening_status}</span>
                  {p.fico_score && <span className={`font-black ${p.fico_score > 650 ? 'text-green-600' : 'text-red-600'}`}>FICO: {p.fico_score}</span>}
                  {p.screening_status === 'Not Started' && (
                    <button onClick={() => runScreening(p.id)} disabled={isScreening === p.id} className="mt-1 w-full bg-slate-800 text-white py-1 rounded font-bold">{isScreening === p.id ? 'Running...' : 'Run Background Check'}</button>
                  )}
                </div>

                <div className="flex justify-between mt-3"><button onClick={() => moveProspect(p.id, 'prospect_new')} className="text-xs text-gray-500">← Back</button><button onClick={() => moveProspect(p.id, 'prospect_negotiation')} className="text-xs text-blue-600 font-bold">Negotiate →</button></div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100"><h3 className="font-bold text-purple-800 mb-4">Negotiation ({negotiating.length})</h3><div className="space-y-3">{negotiating.map(p => (<div key={p.id} className="bg-white p-4 rounded-lg shadow-sm border border-purple-200"><p className="font-bold text-blue-600">{p.name}</p><div className="flex justify-between mt-3"><button onClick={() => moveProspect(p.id, 'prospect_review')} className="text-xs text-gray-500">← Back</button><button onClick={() => openApproveModal(p)} className="text-xs text-green-600 font-bold">Approve (Make Active) ✓</button></div></div>))}</div></div>
      </div>

      {isModalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-lg w-[500px]">
            <h3 className="text-xl font-bold mb-2 text-gray-800">Approve Tenant</h3>
            <form onSubmit={finalizeLease} className="space-y-4 mt-4">
              <select className="w-full border p-2 rounded outline-none" onChange={(e) => { setSelectedProperty(e.target.value); setSelectedSpace('') }}><option value="">-- Select Property --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              {selectedProperty && <select className="w-full border p-2 rounded outline-none bg-blue-50" required onChange={(e) => setSelectedSpace(e.target.value)}><option value="">-- Select Space / Suite --</option>{filteredSpaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
              <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-gray-600">Start Date</label><input type="date" required className="w-full border p-2 rounded outline-none" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div><div><label className="block text-xs font-bold text-gray-600">End Date</label><input type="date" required className="w-full border p-2 rounded outline-none" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div></div>
              <div><label className="block text-xs font-bold text-gray-600">Monthly Base Rent ($)</label><input type="number" required className="w-full border p-2 rounded outline-none" value={baseRent} onChange={(e) => setBaseRent(e.target.value)} /></div>
              <div className="pt-2 border-t"><label className="block text-xs font-bold text-orange-600 mb-1">Procuring Broker (Optional)</label><select className="w-full border p-2 rounded outline-none" value={selectedBroker} onChange={(e) => setSelectedBroker(e.target.value)}><option value="">-- No Broker --</option>{brokers.map(b => <option key={b.id} value={b.id}>{b.name} ({b.commission_rate}%)</option>)}</select></div>
              <div className="flex justify-end space-x-3 pt-4 mt-2 border-t"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button><button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-medium text-white">Finalize Lease</button></div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}