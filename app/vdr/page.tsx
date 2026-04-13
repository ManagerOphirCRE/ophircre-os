"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function VDRPage() {
  const[vdrs, setVdrs] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [propertyId, setPropertyId] = useState('');
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => { fetchData(); },[]);

  async function fetchData() {
    const { data: vData } = await supabase.from('virtual_data_rooms').select('*, properties(name)').order('created_at', { ascending: false });
    if (vData) setVdrs(vData);
    const { data: pData } = await supabase.from('properties').select('*').order('name');
    if (pData) setProperties(pData);
  }

  async function createVDR(e: any) {
    e.preventDefault(); setIsSaving(true);
    try {
      await supabase.from('virtual_data_rooms').insert([{ property_id: propertyId, name, passcode, expires_at: expiresAt }]);
      setIsModalOpen(false); setPropertyId(''); setName(''); setPasscode(''); setExpiresAt('');
      fetchData(); alert("Virtual Data Room Created!");
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSaving(false); }
  }

  async function deleteVDR(id: string) {
    if (!confirm("Revoke access to this Data Room?")) return;
    await supabase.from('virtual_data_rooms').delete().eq('id', id);
    fetchData();
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Virtual Data Rooms (VDR)</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">+ Create VDR</button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 bg-gray-50 border-b flex justify-between items-center"><h3 className="font-bold text-gray-800">Active Data Rooms & Analytics</h3></div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">VDR Name</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Property</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Passcode</th><th className="px-6 py-3 text-center text-xs font-bold text-blue-600 uppercase">Total Views</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Last Viewed</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Expires</th><th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th></tr></thead>
            <tbody className="divide-y divide-gray-200">
              {vdrs.map(v => {
                const isExpired = new Date(v.expires_at) < new Date();
                return (
                  <tr key={v.id} className="hover:bg-gray-50 bg-white">
                    <td className="px-6 py-4 text-sm font-bold text-blue-600">{v.name}<button onClick={() => {navigator.clipboard.writeText(`https://app.ophircre.com/vdr-access/${v.id}`); alert("Link Copied!");}} className="ml-2 text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded transition">Copy Link</button></td>
                    <td className="px-6 py-4 text-sm text-gray-900">{v.properties?.name}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{v.passcode}</td>
                    <td className="px-6 py-4 text-sm font-black text-center text-blue-600">{v.views || 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{v.last_viewed_at ? new Date(v.last_viewed_at).toLocaleString() : 'Never'}</td>
                    <td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded-full text-xs font-bold ${isExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{v.expires_at}</span></td>
                    <td className="px-6 py-4 text-right"><button onClick={() => deleteVDR(v.id)} className="text-xs text-red-500 font-bold hover:underline">Revoke</button></td>
                  </tr>
                )
              })}
              {vdrs.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No active data rooms.</td></tr>}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-6 text-gray-800">Create Secure VDR</h3>
              <form onSubmit={createVDR} className="space-y-4">
                <select required className="w-full border p-2 rounded outline-none" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">-- Select Property --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <input type="text" required placeholder="VDR Name (e.g., Chase Refinance)" className="w-full border p-2 rounded outline-none" value={name} onChange={(e) => setName(e.target.value)} />
                <input type="text" required placeholder="Secure Passcode" className="w-full border p-2 rounded outline-none font-mono" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
                <input type="date" required className="w-full border p-2 rounded outline-none" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                <div className="flex justify-end space-x-3 pt-4 border-t"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button><button type="submit" disabled={isSaving} className={`px-6 py-2 rounded font-bold text-white transition ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>Generate VDR</button></div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}