"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/app/context/OrgContext';

export default function TenantsPage() {
  const { orgId } = useOrg();
  const [tenants, setTenants] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const[isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  // Manual Form State
  const[name, setName] = useState('');
  const [entityType, setEntityType] = useState('');
  const[email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Inline AI Bulk Upload State
  const [stagedTenants, setStagedTenants] = useState<any[]>([]);
  const [isProcessingAi, setIsProcessingAi] = useState(false);

  useEffect(() => { if (orgId) fetchTenants(); }, [orgId]);

  async function fetchTenants() {
    // ONLY fetch active tenants (is_deleted = false or null)
    const { data } = await supabase.from('tenants').select('*').is('is_deleted', false).order('created_at', { ascending: false });
    if (data) setTenants(data);
  }

  // --- SOFT DELETE LOGIC ---
  async function deleteTenant(e: any, id: string) {
    e.stopPropagation(); // Prevent row click
    if (!confirm("Move this tenant to the Trash Bin? You can restore them later.")) return;
    try {
      await supabase.from('tenants').update({ is_deleted: true }).eq('id', id);
      fetchTenants();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  // --- MANUAL SAVE ---
  async function saveManualTenant(e: any) {
    e.preventDefault();
    if (!name) return alert("Tenant name is required.");
    setIsSaving(true);
    try {
      await supabase.from('tenants').insert([{ name, entity_type: entityType, contact_email: email, contact_phone: phone, status: 'active', organization_id: orgId }]);
      setIsModalOpen(false); setName(''); setEntityType(''); setEmail(''); setPhone(''); fetchTenants();
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSaving(false); }
  }

  // --- INLINE AI BULK UPLOAD ENGINE ---
  async function handleInlineAiUpload(e: any) {
    const files = Array.from(e.target.files) as File[];
    if (files.length === 0) return;
    
    setIsProcessingAi(true);
    const newStaged: any[] = [...stagedTenants];

    for (const file of files) {
      try {
        const formData = new FormData(); formData.append('file', file);
        const res = await fetch('/api/magic-upload', { method: 'POST', body: formData });
        const aiResult = await res.json();
        
        if (!res.ok) throw new Error(aiResult.error);

        // Extract tenant data whether the AI thought it was a LEASE or TENANT_INFO
        const extractedName = aiResult.data.name || aiResult.data.tenant_name || '';
        const extractedEmail = aiResult.data.email || '';
        const extractedPhone = aiResult.data.phone || '';
        const extractedEntity = aiResult.data.entity_type || 'Business';

        if (!extractedName) continue; // Skip if no name found

        // DUPLICATE DETECTION
        let duplicateWarning = null;
        const { data: existing } = await supabase.from('tenants').select('id').ilike('name', `%${extractedName}%`).is('is_deleted', false).maybeSingle();
        if (existing) duplicateWarning = `A tenant named "${extractedName}" already exists in your active directory.`;

        newStaged.push({
          id: Math.random().toString(),
          fileName: file.name,
          name: extractedName,
          email: extractedEmail,
          phone: extractedPhone,
          entity: extractedEntity,
          duplicateWarning
        });
      } catch (err: any) { console.error("File failed:", err.message); }
    }

    setStagedTenants(newStaged);
    setIsProcessingAi(false);
  }

  async function approveStagedTenant(index: number) {
    const item = stagedTenants[index];
    try {
      await supabase.from('tenants').insert([{ name: item.name, contact_email: item.email, contact_phone: item.phone, entity_type: item.entity, status: 'active', organization_id: orgId }]);
      const updatedStaged = [...stagedTenants];
      updatedStaged.splice(index, 1);
      setStagedTenants(updatedStaged);
      fetchTenants();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  function discardStagedTenant(index: number) {
    const updatedStaged = [...stagedTenants];
    updatedStaged.splice(index, 1);
    setStagedTenants(updatedStaged);
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Tenant Directory</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          + Add Tenants
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tenants.map((tenant) => (
                <tr key={tenant.id} onClick={() => router.push(`/tenants/${tenant.id}`)} className="hover:bg-blue-50 cursor-pointer transition">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{tenant.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.entity_type || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.contact_email || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.contact_phone || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button onClick={(e) => deleteTenant(e, tenant.id)} className="text-xs text-red-500 hover:underline font-bold">Trash</button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No active tenants found.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* INLINE ADD / AI UPLOAD MODAL */}
        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col md:flex-row gap-8">
              
              {/* LEFT: Manual Entry */}
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-6 text-gray-800">Manual Entry</h3>
                <form onSubmit={saveManualTenant} className="space-y-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Tenant / DBA Name *</label><input type="text" required className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Legal Entity Type</label><input type="text" placeholder="e.g., LLC, Inc, Individual" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={entityType} onChange={(e) => setEntityType(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label><input type="email" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label><input type="tel" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                  <div className="flex justify-end pt-4 mt-2 border-t">
                    <button type="submit" disabled={isSaving} className={`w-full py-2 rounded font-bold text-white ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>Save Tenant</button>
                  </div>
                </form>
              </div>

              {/* RIGHT: AI Bulk Upload */}
              <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-200 pt-6 md:pt-0 md:pl-8 flex flex-col">
                <h3 className="text-xl font-bold mb-2 text-purple-800 flex items-center"><span className="mr-2">✨</span> AI Bulk Import</h3>
                <p className="text-xs text-gray-500 mb-4">Upload multiple leases, PDFs, or Excel files. The AI will extract the tenant info automatically.</p>
                
                <label className={`w-full flex justify-center items-center py-4 rounded-lg border-2 border-dashed font-bold cursor-pointer transition mb-4 ${isProcessingAi ? 'bg-purple-50 border-purple-300 text-purple-400' : 'bg-purple-50 border-purple-400 text-purple-700 hover:bg-purple-100'}`}>
                  {isProcessingAi ? '🤖 AI is reading files...' : 'Drop Files Here or Click to Upload'}
                  <input type="file" multiple accept=".pdf,image/*,.csv,.xlsx" onChange={handleInlineAiUpload} className="hidden" disabled={isProcessingAi} />
                </label>

                <div className="flex-1 overflow-y-auto space-y-3">
                  {stagedTenants.map((item, idx) => (
                    <div key={item.id} className="p-3 bg-gray-50 border rounded-lg text-sm">
                      <p className="font-bold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.email} | {item.phone}</p>
                      {item.duplicateWarning && <p className="text-xs font-bold text-red-600 mt-1">⚠️ {item.duplicateWarning}</p>}
                      <div className="flex space-x-2 mt-2">
                        <button onClick={() => approveStagedTenant(idx)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold">Approve</button>
                        <button onClick={() => discardStagedTenant(idx)} className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-xs font-bold">Discard</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
            
            {/* Global Close Button */}
            <div className="absolute top-4 right-4"><button onClick={() => setIsModalOpen(false)} className="text-white text-3xl hover:text-gray-300">&times;</button></div>
          </div>
        )}
      </main>
    </>
  );
}