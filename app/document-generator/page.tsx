"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'
import dynamic from 'next/dynamic'
import 'react-quill/dist/quill.snow.css'

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })

export default function DocumentGeneratorPage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  
  const[selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [selectedTenant, setSelectedTenant] = useState<any>(null)
  
  const [subject, setSubject] = useState('')
  const[generatedDoc, setGeneratedDoc] = useState('')
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const { data: tpls } = await supabase.from('document_templates').select('*')
      if (tpls) setTemplates(tpls)
      
      // Fetch tenants and their active property address
      const { data: tnts } = await supabase.from('tenants').select('*, leases(spaces(properties(address)))')
      if (tnts) setTenants(tnts)
    }
    fetchData()
  },[])

  function generateDocument() {
    if (!selectedTemplate) return alert("Please select a template.")
    
    let doc = selectedTemplate.body_text
    setSubject(selectedTemplate.subject)

    // Find the tenant's property address if they have a lease
    const propertyAddress = selectedTenant?.leases?.[0]?.spaces?.properties?.address || '[PROPERTY ADDRESS]'

    doc = doc.replace(/{{TODAY_DATE}}/g, new Date().toLocaleDateString())
    doc = doc.replace(/{{TENANT_NAME}}/g, selectedTenant ? selectedTenant.name : '[TENANT NAME]')
    doc = doc.replace(/{{PROPERTY_ADDRESS}}/g, propertyAddress)

    setGeneratedDoc(doc)
  }

  async function emailDocument() {
    if (!selectedTenant?.contact_email) return alert("This tenant does not have an email address on file.")
    if (!generatedDoc || !subject) return alert("Please generate a document and subject line first.")
    
    setIsSending(true)
    try {
      // Send via our existing SendGrid API
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedTenant.contact_email,
          subject: subject,
          text: generatedDoc // The API will wrap this in the official OphirCRE HTML template
        })
      })
      
      if (!res.ok) throw new Error((await res.json()).error)

      // Log it in Communications History
      await supabase.from('communications').insert([{
        tenant_id: selectedTenant.id,
        subject: subject,
        body: generatedDoc,
        type: 'Email',
        status: 'Sent'
      }])

      alert("Official Notice Emailed to Tenant and Logged in History!")
    } catch (error: any) {
      alert("Error sending email: " + error.message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Document & Notice Generator</h2>
        <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">🖨️ Print to PDF</button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex space-x-6 bg-gray-100">
        
        {/* LEFT COLUMN: Parameters */}
        <div className="w-1/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
          <h3 className="font-bold text-gray-800 mb-4">Letter Parameters</h3>
          <div className="space-y-4">
            
            <select className="w-full border p-2 rounded text-sm" onChange={(e) => setSelectedTemplate(templates.find(t => t.id === e.target.value))}>
              <option value="">-- Choose Template --</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <select className="w-full border p-2 rounded text-sm" onChange={(e) => setSelectedTenant(tenants.find(t => t.id === e.target.value))}>
              <option value="">-- Choose Tenant --</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <button onClick={generateDocument} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium mt-4">
              Generate Letter →
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Editor & Email Button */}
        <div className="w-2/3 flex flex-col">
          <div className="bg-white p-4 rounded-t-xl border-t border-l border-r border-gray-200 flex items-center space-x-4">
            <label className="text-sm font-bold text-gray-700">Email Subject:</label>
            <input type="text" className="flex-1 border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <button onClick={emailDocument} disabled={isSending} className={`px-6 py-2 rounded font-bold text-white transition ${isSending ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>
              {isSending ? 'Sending...' : '✉️ Email to Tenant'}
            </button>
          </div>
          
          <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 overflow-hidden">
            <ReactQuill theme="snow" value={generatedDoc} onChange={setGeneratedDoc} className="h-[500px] bg-white" />
          </div>
        </div>

      </main>
    </>
  )
}