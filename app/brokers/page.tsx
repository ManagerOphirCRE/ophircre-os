"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<any[]>([]);
  const[tours, setTours] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const[isTourModalOpen, setIsTourModalOpen] = useState(false);

  const [name, setName] = useState(''); const [firm, setFirm] = useState('');
  const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const[rate, setRate] = useState('3.0');

  const [brokerId, setBrokerId] = useState(''); const [propertyId, setPropertyId] = useState('');
  const [prospect, setProspect] = useState(''); const[tourDate, setTourDate] = useState('');

  useEffect(() => { fetchData(); },[]);

  async function fetchData() {
    const { data: bData } = await supabase.from('brokers').select('*').order('name');
    if (bData) setBrokers(bData);
    const { data: tData } = await supabase.from('tours').select('*, brokers(name), properties(name)').order('tour_date', { ascending: true });
    if (tData) setTours(tData);
    const { data: pData } = await supabase.from('properties').select('*').order('name');
    if (pData) setProperties(pData);
  }

  async function saveBroker(e: any) {
    e.preventDefault();
    await supabase.from('brokers').insert([{ name, firm, email, phone, commission_rate: Number(rate) }]);
    setIsModalOpen(false); setName(''); setFirm(''); setEmail(''); setPhone(''); setRate('3.0'); fetchData();
  }

  async function saveTour(e: any) {
    e.preventDefault();
    await supabase.from('tours').insert([{ broker_id: brokerId, property_id: propertyId, prospect_name: prospect, tour_date: tourDate }]);
    setIsTourModalOpen(false); setBrokerId(''); setPropertyId(''); setProspect(''); setTourDate(''); fetchData();
  }

  async function updateTourStatus(id: string, status: string) {
    await supabase.from('tours').update({ status }).eq('id', id);
    fetchData();
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Broker CRM & Tours</h2>
        <div className="space-x-2">
          <button onClick={() => setIsTourModalOpen(true)} className="bg-orange-600 text-white px-4 py-2 rounded-md font-medium shadow-sm">📅 Schedule Tour</button>
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium shadow-sm">+ Add Broker</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100 flex flex-col md:flex-row gap-6">
        
        <div className="w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
          <div className="p-4 bg-gray-50 border-b"><h3 className="font-bold text-gray-800">Broker Directory</h3></div>
          <div className="divide-y divide-gray-200">
            {brokers.map(b => (
              <div key={b.id} className="p-4 hover:bg-gray-50">
                <p className="font-bold text-blue-600">{b.name} <span className="text-xs text-gray-500 font-normal">({b.firm})</span></p>
                <p className="text-xs text-gray-600 mt-1">{b.email} | {b.phone}</p>
                <p className="text-xs font-bold text-green-600 mt-1">Comm. Rate: {b.commission_rate}%</p>
              </div>
            ))}
            {brokers.length === 0 && <p className="p-6 text-center text-gray-500 text-sm">No brokers added.</p>}
          </div>
        </div>

        <div className="w-full md:w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
          <div className="p-4 bg-gray-50 border-b"><h3 className="font-bold text-gray-800">Upcoming Property Tours</h3></div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Prospect</th><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Property</th><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Broker</th><th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tours.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{new Date(t.tour_date).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{t.prospect_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.properties?.name}</td>
                  <td className="px-4 py-3 text-sm text-blue-600">{t.brokers?.name}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {t.status === 'Scheduled' ? (
                      <>
                        <button onClick={() => updateTourStatus(t.id, 'Completed')} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold hover:bg-green-200">✓ Done</button>
                        <button onClick={() => updateTourStatus(t.id, 'No Show')} className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-bold hover:bg-red-200">No Show</button>
                      </>
                    ) : <span className="text-xs font-bold text-gray-500 uppercase">{t.status}</span>}
                  </td>
                </tr>
              ))}
              {tours.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-500 text-sm">No tours scheduled.</td></tr>}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Add Broker</h3>
              <form onSubmit={saveBroker} className="space-y-3">
                <input type="text" required placeholder="Broker Name" className="w-full border p-2 rounded outline-none" value={name} onChange={(e)=>setName(e.target.value)} />
                <input type="text" placeholder="Firm / Agency" className="w-full border p-2 rounded outline-none" value={firm} onChange={(e)=>setFirm(e.target.value)} />
                <input type="email" placeholder="Email" className="w-full border p-2 rounded outline-none" value={email} onChange={(e)=>setEmail(e.target.value)} />
                <input type="text" placeholder="Phone" className="w-full border p-2 rounded outline-none" value={phone} onChange={(e)=>setPhone(e.target.value)} />
                <input type="number" step="0.1" placeholder="Commission Rate (%)" className="w-full border p-2 rounded outline-none" value={rate} onChange={(e)=>setRate(e.target.value)} />
                <div className="flex justify-end space-x-2 pt-4"><button type="button" onClick={()=>setIsModalOpen(false)} className="px-4 py-2 text-gray-500">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Save</button></div>
              </form>
            </div>
          </div>
        )}

        {isTourModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Schedule Tour</h3>
              <form onSubmit={saveTour} className="space-y-3">
                <select required className="w-full border p-2 rounded outline-none" value={brokerId} onChange={(e)=>setBrokerId(e.target.value)}><option value="">-- Select Broker --</option>{brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                <select required className="w-full border p-2 rounded outline-none" value={propertyId} onChange={(e)=>setPropertyId(e.target.value)}><option value="">-- Select Property --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <input type="text" required placeholder="Prospect Name / Company" className="w-full border p-2 rounded outline-none" value={prospect} onChange={(e)=>setProspect(e.target.value)} />
                <input type="datetime-local" required className="w-full border p-2 rounded outline-none" value={tourDate} onChange={(e)=>setTourDate(e.target.value)} />
                <div className="flex justify-end space-x-2 pt-4"><button type="button" onClick={()=>setIsTourModalOpen(false)} className="px-4 py-2 text-gray-500">Cancel</button><button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded font-bold">Schedule</button></div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}