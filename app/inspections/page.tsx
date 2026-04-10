"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

const DEFAULT_CHECKLIST =[
  { task: 'Keys & Locks functional', passed: null },
  { task: 'Walls & Paint clean', passed: null },
  { task: 'Floors & Carpets clean', passed: null },
  { task: 'HVAC Filters replaced', passed: null },
  { task: 'Plumbing / No leaks', passed: null },
  { task: 'Smoke Detectors tested', passed: null }
];

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const[isModalOpen, setIsModalOpen] = useState(false);
  const [activeInspection, setActiveInspection] = useState<any>(null);
  const [tenantId, setTenantId] = useState('');
  const[type, setType] = useState('Move-In');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => { fetchData(); },[]);

  async function fetchData() {
    const { data: iData } = await supabase.from('inspections').select('*, tenants(name), properties(name), spaces(name)').order('created_at', { ascending: false });
    if (iData) setInspections(iData);
    const { data: tData } = await supabase.from('tenants').select('*, leases(property_id, space_id)').eq('status', 'active');
    if (tData) setTenants(tData);
  }

  async function createInspection(e: any) {
    e.preventDefault();
    const selectedTenant = tenants.find(t => t.id === tenantId);
    if (!selectedTenant || !selectedTenant.leases?.[0]) return alert("Tenant has no active lease/space assigned.");
    try {
      await supabase.from('inspections').insert([{ tenant_id: tenantId, property_id: selectedTenant.leases[0].property_id, space_id: selectedTenant.leases[0].space_id, inspection_type: type, checklist: DEFAULT_CHECKLIST }]);
      setIsModalOpen(false); fetchData();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function updateChecklistItem(index: number, passed: boolean) {
    const updatedChecklist =[...activeInspection.checklist];
    updatedChecklist[index].passed = passed;
    setActiveInspection({ ...activeInspection, checklist: updatedChecklist });
  }

  // NEW: Native Mobile Camera Upload
  async function handleCameraUpload(e: any) {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `inspection_${Math.random().toString(36).substring(2)}.${fileExt}`;
      await supabase.storage.from('documents').upload(fileName, file);
      const { data } = supabase.storage.from('documents').getPublicUrl(fileName);
      
      // Append the photo URL to the inspection notes
      const currentNotes = activeInspection.notes || '';
      setActiveInspection({ ...activeInspection, notes: currentNotes + `\n[Photo Attached]: ${data.publicUrl}` });
      alert("Photo attached successfully!");
    } catch (error: any) {
      alert("Error uploading photo: " + error.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function saveInspection() {
    try {
      await supabase.from('inspections').update({ checklist: activeInspection.checklist, status: 'Completed', notes: activeInspection.notes }).eq('id', activeInspection.id);
      setActiveInspection(null); fetchData();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Property Inspections</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition">+ New Inspection</button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {inspections.map(insp => (
            <div key={insp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
              <div className="flex justify-between items-start mb-4 border-b pb-4">
                <div><h3 className="font-bold text-lg text-gray-900">{insp.tenants?.name}</h3><p className="text-sm text-gray-500">{insp.properties?.name} - {insp.spaces?.name}</p></div>
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${insp.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{insp.status}</span>
              </div>
              <p className="text-sm font-medium text-gray-700 mb-4">Type: <span className="font-bold text-blue-600">{insp.inspection_type}</span></p>
              <button onClick={() => setActiveInspection(insp)} className="mt-auto w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded font-bold transition">{insp.status === 'Completed' ? 'View Report' : 'Perform Inspection →'}</button>
            </div>
          ))}
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg w-[400px]">
              <h3 className="text-xl font-bold mb-4">Schedule Inspection</h3>
              <form onSubmit={createInspection} className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Tenant</label><select required className="w-full border p-2 rounded outline-none" value={tenantId} onChange={(e) => setTenantId(e.target.value)}><option value="">-- Select Tenant --</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">Type</label><select className="w-full border p-2 rounded outline-none" value={type} onChange={(e) => setType(e.target.value)}><option value="Move-In">Move-In</option><option value="Move-Out">Move-Out</option><option value="Annual Routine">Annual Routine</option></select></div>
                <div className="flex justify-end space-x-3 pt-4 border-t"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-medium">Create</button></div>
              </form>
            </div>
          </div>
        )}

        {activeInspection && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="flex justify-between items-center border-b pb-4 mb-4"><h3 className="text-2xl font-bold">{activeInspection.inspection_type} Checklist</h3><button onClick={() => setActiveInspection(null)} className="text-gray-400 hover:text-gray-800 text-2xl">&times;</button></div>
              
              <div className="space-y-3 flex-1 overflow-y-auto mb-6">
                {activeInspection.checklist.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 border rounded-lg">
                    <span className="font-medium text-gray-800">{item.task}</span>
                    <div className="flex space-x-2">
                      <button onClick={() => updateChecklistItem(index, false)} className={`px-4 py-1 rounded font-bold text-sm ${item.passed === false ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-red-200'}`}>FAIL</button>
                      <button onClick={() => updateChecklistItem(index, true)} className={`px-4 py-1 rounded font-bold text-sm ${item.passed === true ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-green-200'}`}>PASS</button>
                    </div>
                  </div>
                ))}
                <div className="pt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Inspector Notes</label>
                  <textarea className="w-full border p-3 rounded-lg outline-none h-24 resize-none mb-2" value={activeInspection.notes || ''} onChange={(e) => setActiveInspection({...activeInspection, notes: e.target.value})} placeholder="Add any damage notes here..." />
                  
                  {/* NEW: Native Camera Integration */}
                  <label className={`w-full flex justify-center items-center py-3 rounded-lg font-bold text-gray-700 bg-gray-100 border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-200 transition ${isUploading ? 'opacity-50' : ''}`}>
                    {isUploading ? 'Uploading Photo...' : '📷 Tap to Open Camera & Attach Photo'}
                    <input type="file" accept="image/*" capture="environment" onChange={handleCameraUpload} className="hidden" disabled={isUploading} />
                  </label>
                </div>
              </div>

              <button onClick={saveInspection} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition shadow-sm">Save & Complete Inspection</button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}