"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function EntitiesPage() {
  const [entities, setEntities] = useState<any[]>([]);
  const[name, setName] = useState('');
  const [ein, setEin] = useState('');
  const [state, setState] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { fetchEntities(); },[]);

  async function fetchEntities() {
    const { data } = await supabase.from('legal_entities').select('*, properties(name)').order('name');
    if (data) setEntities(data);
  }

  async function saveEntity(e: any) {
    e.preventDefault(); setIsSaving(true);
    try {
      await supabase.from('legal_entities').insert([{ name, ein, formation_state: state }]);
      setName(''); setEin(''); setState(''); fetchEntities();
      alert("LLC Created!");
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSaving(false); }
  }

  async function deleteEntity(id: string) {
    if (!confirm("Delete this LLC?")) return;
    await supabase.from('legal_entities').delete().eq('id', id);
    fetchEntities();
  }

  return (
    <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
      <header className="mb-8"><h2 className="text-2xl font-bold text-gray-800">Legal Entities (LLCs)</h2></header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Entity Name</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">EIN</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">State</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Properties Owned</th><th className="px-6 py-3 text-right"></th></tr></thead>
            <tbody className="divide-y divide-gray-200">
              {entities.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-bold text-blue-600">{e.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{e.ein || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{e.formation_state || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{e.properties?.length || 0}</td>
                  <td className="px-6 py-4 text-right"><button onClick={() => deleteEntity(e.id)} className="text-red-500 text-xs font-bold hover:underline">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
          <h3 className="font-bold text-gray-800 mb-4">Add New LLC</h3>
          <form onSubmit={saveEntity} className="space-y-4">
            <input type="text" required placeholder="Legal Name (e.g. 123 Main LLC)" className="w-full border p-2 rounded outline-none" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="text" placeholder="EIN (XX-XXXXXXX)" className="w-full border p-2 rounded outline-none" value={ein} onChange={(e) => setEin(e.target.value)} />
            <input type="text" placeholder="State of Formation" className="w-full border p-2 rounded outline-none" value={state} onChange={(e) => setState(e.target.value)} />
            <button type="submit" disabled={isSaving} className="w-full bg-blue-600 text-white py-2 rounded font-bold">{isSaving ? 'Saving...' : 'Create Entity'}</button>
          </form>
        </div>
      </div>
    </main>
  );
}