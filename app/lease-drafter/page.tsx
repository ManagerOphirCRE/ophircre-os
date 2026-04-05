"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'
import dynamic from 'next/dynamic'
import 'react-quill/dist/quill.snow.css'

// Dynamically import ReactQuill so it doesn't break Next.js server rendering
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })

export default function LeaseDrafterPage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  const [spaces, setSpaces] = useState<any[]>([])

  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [selectedTenant, setSelectedTenant] = useState<any>(null)
  const[selectedProperty, setSelectedProperty] = useState<any>(null)
  const [selectedSpace, setSelectedSpace] = useState<any>(null)
  
  const [rentAmount, setRentAmount] = useState('')
  const[startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const[generatedLease, setGeneratedLease] = useState('')

  useEffect(() => { fetchData() },[])

  async function fetchData() {
    const { data: tpls } = await supabase.from('lease_templates').select('*')
    if (tpls) setTemplates(tpls)
    const { data: tnts } = await supabase.from('tenants').select('*')
    if (tnts) setTenants(tnts)
    const { data: props } = await supabase.from('properties').select('*')
    if (props) setProperties(props)
    const { data: spcs } = await supabase.from('spaces').select('*')
    if (spcs) setSpaces(spcs)
  }

  const filteredSpaces = spaces.filter(s => selectedProperty && s.property_id === selectedProperty.id)

  function generateDocument() {
    if (!selectedTemplate) return alert("Please select a template first.")
    let doc = selectedTemplate.body_text
    doc = doc.replace(/{{TODAY_DATE}}/g, new Date().toLocaleDateString())
    doc = doc.replace(/{{TENANT_NAME}}/g, selectedTenant ? selectedTenant.name : '[TENANT NAME]')
    doc = doc.replace(/{{PROPERTY_ADDRESS}}/g, selectedProperty ? selectedProperty.address : '[PROPERTY ADDRESS]')
    doc = doc.replace(/{{RENT_AMOUNT}}/g, rentAmount || '[RENT AMOUNT]')
    doc = doc.replace(/{{START_DATE}}/g, startDate || '[START DATE]')
    doc = doc.replace(/{{END_DATE}}/g, endDate || '[END DATE]')
    doc = doc.replace(/{{SPACE_NAME}}/g, selectedSpace ? selectedSpace.name : '[SPACE/SUITE]')
    doc = doc.replace(/{{LANDLORD_NAME}}/g, selectedProperty?.landlord_entity_name || 'OphirCRE')
    
    // Format it as HTML for the Rich Text Editor
    setGeneratedLease(`<div style="font-family: serif; line-height: 1.6;">${doc.replace(/\n/g, '<br>')}</div>`)
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Lease Drafter & Redlining</h2>
        <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">🖨️ Print / Save PDF</button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex space-x-6 bg-gray-100">
        <div className="w-1/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
          <h3 className="font-bold text-gray-800 mb-4">Lease Parameters</h3>
          <div className="space-y-4">
            <select className="w-full border p-2 rounded text-sm" onChange={(e) => setSelectedTemplate(templates.find(t => t.id === e.target.value))}><option value="">-- Choose Template --</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select className="w-full border p-2 rounded text-sm" onChange={(e) => setSelectedTenant(tenants.find(t => t.id === e.target.value))}><option value="">-- Choose Tenant --</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select className="w-full border p-2 rounded text-sm" onChange={(e) => { setSelectedProperty(properties.find(p => p.id === e.target.value)); setSelectedSpace(null) }}><option value="">-- Choose Property --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            {selectedProperty && <select className="w-full border p-2 rounded text-sm bg-blue-50" onChange={(e) => setSelectedSpace(spaces.find(s => s.id === e.target.value))}><option value="">-- Choose Space / Suite --</option>{filteredSpaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs text-gray-500">Start Date</label><input type="date" className="w-full border p-2 rounded text-sm" onChange={(e) => setStartDate(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500">End Date</label><input type="date" className="w-full border p-2 rounded text-sm" onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
            <div><label className="block text-xs text-gray-500">Monthly Rent ($)</label><input type="number" className="w-full border p-2 rounded text-sm" onChange={(e) => setRentAmount(e.target.value)} /></div>
            <button onClick={generateDocument} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium mt-4">Generate Document →</button>
          </div>
        </div>

        <div className="w-2/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <ReactQuill theme="snow" value={generatedLease} onChange={setGeneratedLease} className="h-[600px] bg-white" />
        </div>
      </main>
    </>
  )
}