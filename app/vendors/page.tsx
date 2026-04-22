"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'
import { useRouter } from 'next/navigation'
import { useOrg } from '@/app/context/OrgContext'

export default function VendorsPage() {
  const { orgId } = useOrg();
  const [vendors, setVendors] = useState<any[]>([])
  const[isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const router = useRouter()

  const [companyName, setCompanyName] = useState('')
  const[trade, setTrade] = useState('')
  const [email, setEmail] = useState('')
  const[phone, setPhone] = useState('')

  const [stagedVendors, setStagedVendors] = useState<any[]>([])
  const [isProcessingAi, setIsProcessingAi] = useState(false)

  useEffect(() => { if (orgId) fetchVendors() },[orgId])

  async function fetchVendors() {
    const { data } = await supabase.from('vendors').select('*').is('is_deleted', false).order('company_name', { ascending: true })
    if (data) setVendors(data)
  }

  async function deleteVendor(e: any, id: string) {
    e.stopPropagation();
    if (!confirm("Move this vendor to the Trash Bin?")) return;
    try { await supabase.from('vendors').update({ is_deleted: true }).eq('id', id); fetchVendors(); } 
    catch (error: any) { alert("Error: " + error.message); }
  }

  async function saveManualVendor(e: any) {
    e.preventDefault()
    if (!companyName) return alert("Company name is required.")
    setIsSaving(true)
    try {
      await supabase.from('vendors').insert([{ company_name: companyName, trade, contact_email: email, contact_phone: phone, organization_id: orgId }])
      setIsModalOpen(false); setCompanyName(''); setTrade(''); setEmail(''); setPhone(''); fetchVendors()
    } catch (error: any) { alert("Error: " + error.message) } finally { setIsSaving(false) }
  }

  async function handleInlineAiUpload(e: any) {
    const files = Array.from(e.target.files) as File[]; if (files.length === 0) return;
    setIsProcessingAi(true); const newStaged: any[] = [...stagedVendors];
    for (const file of files) {
      try {
        const formData = new FormData(); formData.append('file', file);
        const res = await fetch('/api/magic-upload', { method: 'POST', body: formData });
        const aiResult = await res.json();
        if (!res.ok) throw new Error(aiResult.error);
        const extractedName = aiResult.data.payee || aiResult.data.name || '';
        if (!extractedName) continue;
        let duplicateWarning = null;
        const { data: existing } = await supabase.from('vendors').select('id').ilike('company_name', `%${extractedName}%`).is('is_deleted', false).maybeSingle();
        if (existing) duplicateWarning = `A vendor named "${extractedName}" already exists.`;
        newStaged.push({ id: Math.random().toString(), fileName: file.name, company_name: extractedName, email: aiResult.data.email || '', phone: aiResult.data.phone || '', trade: aiResult.data.trade || 'General', duplicateWarning });
      } catch (err: any) { console.error(err.message); }
    }
    setStagedVendors(newStaged); setIsProcessingAi(false);
  }

  async function approveStagedVendor(index: number) {
    const item = stagedVendors[index];
    try {
      await supabase.from('vendors').insert([{ company_name: item.company_name, contact_email: item.email, contact_phone: item.phone, trade: item.trade, organization_id: orgId }]);
      const updatedStaged = [...stagedVendors]; updatedStaged.splice(index, 1); setStagedVendors(updatedStaged); fetchVendors();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  function discardStagedVendor(index: number) {
    const updatedStaged = [...stagedVendors]; updatedStaged.splice(index, 1); setStagedVendors(updatedStaged);
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Vendor Directory</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm text-sm md:text-base">+ Add Vendor</button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-gray-200 whitespace-nowrap">
              <thead className="bg-gray-50">
                <tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trade</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th></tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vendors.map((v) => (
                  <tr key={v.id} onClick={() => router.push(`/vendors/${v.id}`)} className="hover:bg-blue-50 cursor-pointer transition">
                    <td className="px-6 py-4 font-bold text-gray-900">{v.company_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{v.trade || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{v.contact_email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{v.contact_phone || '-'}</td>
                    <td className="px-6 py-4 text-right"><button onClick={(e) => deleteVendor(e, v.id)} className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded font-bold hover:bg-red-200 transition">Trash</button></td>
                  </tr>
                ))}
                {vendors.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No vendors found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col md:flex-row gap-8 relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 text-2xl">&times;</button>
              
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-6 text-gray-800">Manual Entry</h3>
                <form onSubmit={saveManualVendor} className="space-y-4">
                  <input type="text" required placeholder="Company Name *" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                  <input type="text" placeholder="Trade / Specialty" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={trade} onChange={(e) => setTrade(e.target.value)} />
                  <input type="email" placeholder="Contact Email" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <input type="tel" placeholder="Cell Phone (For SMS)" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <button type="submit" disabled={isSaving} className={`w-full py-3 rounded font-bold text-white mt-4 ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>Save Vendor</button>
                </form>
              </div>

              <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-200 pt-6 md:pt-0 md:pl-8 flex flex-col">
                <h3 className="text-xl font-bold mb-2 text-purple-800 flex items-center"><span className="mr-2">✨</span> AI Bulk Import</h3>
                <p className="text-xs text-gray-500 mb-4">Upload vendor invoices or W9s. The AI will extract the vendor info automatically.</p>
                <label className={`w-full flex justify-center items-center py-4 rounded-lg border-2 border-dashed font-bold cursor-pointer transition mb-4 ${isProcessingAi ? 'bg-purple-50 border-purple-300 text-purple-400' : 'bg-purple-50 border-purple-400 text-purple-700 hover:bg-purple-100'}`}>
                  {isProcessingAi ? '🤖 Analyzing files...' : 'Click to Upload Files'}
                  <input type="file" multiple accept=".pdf,image/*,.csv,.xlsx" onChange={handleInlineAiUpload} className="hidden" disabled={isProcessingAi} />
                </label>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {stagedVendors.map((item, idx) => (
                    <div key={item.id} className="p-3 bg-gray-50 border rounded-lg text-sm">
                      <p className="font-bold text-gray-900">{item.company_name}</p>
                      <p className="text-xs text-gray-500">{item.email} | {item.phone}</p>
                      {item.duplicateWarning && <p className="text-xs font-bold text-red-600 mt-1">⚠️ {item.duplicateWarning}</p>}
                      <div className="flex space-x-2 mt-2">
                        <button onClick={() => approveStagedVendor(idx)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold">Approve</button>
                        <button onClick={() => discardStagedVendor(idx)} className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-xs font-bold">Discard</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}