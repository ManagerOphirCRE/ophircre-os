"use client"
import { useState } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function AIScannerPage() {
  const [file, setFile] = useState<File | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [extractedData, setExtractedData] = useState<any>(null)

  async function handleScan() {
    if (!file) return alert("Please select a PDF lease to scan.")
    setIsScanning(true)
    setExtractedData(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/scan-lease', {
        method: 'POST',
        body: formData // Sending the actual file now!
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to scan document")
      setExtractedData(data)
    } catch (error: any) {
      alert("AI Error: " + error.message)
    } finally {
      setIsScanning(false)
    }
  }

  // ... (saveToDatabase function remains exactly the same)
  async function saveToDatabase() {
    if (!extractedData) return
    try {
      const { data: tenantData, error: tenantError } = await supabase.from('tenants').insert([{ name: extractedData.tenant_name, status: 'active' }]).select().single()
      if (tenantError) throw tenantError
      const { error: leaseError } = await supabase.from('leases').insert([{ tenant_id: tenantData.id, start_date: extractedData.start_date || null, end_date: extractedData.end_date || null, base_rent_amount: extractedData.base_rent ? Number(extractedData.base_rent) : null }])
      if (leaseError) throw leaseError
      alert("Successfully saved Tenant and Lease to database!")
      setExtractedData(null); setFile(null)
    } catch (error: any) { alert("Database Error: " + error.message) }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">AI Lease Abstraction</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex space-x-6 bg-gray-100">
        <div className="w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-[calc(100vh-120px)]">
          <h3 className="font-bold text-gray-800 mb-2">1. Upload PDF Lease</h3>
          <p className="text-sm text-gray-500 mb-4">Select a PDF file from your computer. The AI will read it and extract the data.</p>
          
          <div className="flex-1 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center bg-gray-50 p-6">
            <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mb-4" />
            {file && <p className="text-green-600 font-medium text-sm">Selected: {file.name}</p>}
          </div>
          
          <button onClick={handleScan} disabled={isScanning || !file} className={`w-full mt-4 py-3 rounded-lg font-bold text-white transition shadow-sm ${isScanning || !file ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
            {isScanning ? '🤖 AI is reading PDF...' : '✨ Scan PDF with AI'}
          </button>
        </div>

        <div className="w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
          <h3 className="font-bold text-gray-800 mb-4">2. Review Extracted Data</h3>
          {extractedData ? (
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700">Tenant Name</label><input type="text" className="w-full border p-2 rounded bg-gray-50 font-medium" value={extractedData.tenant_name} readOnly /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">Start Date</label><input type="text" className="w-full border p-2 rounded bg-gray-50" value={extractedData.start_date} readOnly /></div>
                <div><label className="block text-sm font-medium text-gray-700">End Date</label><input type="text" className="w-full border p-2 rounded bg-gray-50" value={extractedData.end_date} readOnly /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700">Base Rent ($)</label><input type="text" className="w-full border p-2 rounded bg-gray-50 font-bold text-green-700" value={extractedData.base_rent} readOnly /></div>
              <div><label className="block text-sm font-medium text-gray-700">CAM / NNN Provisions</label><textarea className="w-full border p-2 rounded bg-gray-50 h-24 resize-none text-sm" value={extractedData.cam_provisions} readOnly /></div>
              <button onClick={saveToDatabase} className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition shadow-sm">Approve & Save to Database</button>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg"><p className="text-gray-400 text-center">Awaiting document scan...</p></div>
          )}
        </div>
      </main>
    </>
  )
}