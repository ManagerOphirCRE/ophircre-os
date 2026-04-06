"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function AIScannerPage() {
  const [activeTab, setActiveTab] = useState('lease') // 'lease' or 'invoice'
  
  const [accounts, setAccounts] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])

  const [leaseFile, setLeaseFile] = useState<File | null>(null)
  const [isScanningLease, setIsScanningLease] = useState(false)
  const [extractedLease, setExtractedLease] = useState<any>(null)

  const[invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const[isScanningInvoice, setIsScanningInvoice] = useState(false)
  const [extractedInvoice, setExtractedInvoice] = useState<any>(null)
  const [selectedProperty, setSelectedProperty] = useState('')

  useEffect(() => {
    async function fetchData() {
      const { data: accs } = await supabase.from('chart_of_accounts').select('*').order('name')
      if (accs) setAccounts(accs)
      const { data: props } = await supabase.from('properties').select('*').order('name')
      if (props) setProperties(props)
    }
    fetchData()
  },[])

  async function handleScanLease() {
    if (!leaseFile) return alert("Please select a PDF lease.")
    setIsScanningLease(true); setExtractedLease(null)
    try {
      const formData = new FormData(); formData.append('file', leaseFile)
      const res = await fetch('/api/scan-lease', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExtractedLease(data)
    } catch (error: any) { alert("AI Error: " + error.message) } finally { setIsScanningLease(false) }
  }

  async function saveLeaseToDatabase() {
    if (!extractedLease) return
    try {
      const { data: tenantData, error: tErr } = await supabase.from('tenants').insert([{ name: extractedLease.tenant_name, status: 'active' }]).select().single()
      if (tErr) throw tErr
      const { error: lErr } = await supabase.from('leases').insert([{ tenant_id: tenantData.id, start_date: extractedLease.start_date || null, end_date: extractedLease.end_date || null, base_rent_amount: extractedLease.base_rent ? Number(extractedLease.base_rent) : null }])
      if (lErr) throw lErr
      alert("Tenant and Lease saved!"); setExtractedLease(null); setLeaseFile(null)
    } catch (error: any) { alert("Database Error: " + error.message) }
  }

  async function handleScanInvoice() {
    if (!invoiceFile) return alert("Please select a PDF or Image.")
    setIsScanningInvoice(true); setExtractedInvoice(null)
    try {
      const formData = new FormData(); formData.append('file', invoiceFile)
      const res = await fetch('/api/scan-invoice', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExtractedInvoice(data)
    } catch (error: any) { alert("AI Error: " + error.message) } finally { setIsScanningInvoice(false) }
  }

  async function saveInvoiceToDatabase() {
    if (!extractedInvoice) return
    if (!selectedProperty) return alert("Please select which property this bill belongs to.")

    try {
      const { data: txnData, error: txnErr } = await supabase.from('transactions').insert([{
        date: extractedInvoice.date || new Date().toISOString().split('T')[0],
        description: extractedInvoice.payee_name,
        total_amount: Number(extractedInvoice.total_amount),
        status: 'Approved'
      }]).select().single()
      if (txnErr) throw txnErr

      const journalEntries =[]
      
      if (extractedInvoice.is_mortgage) {
        const principalAcc = accounts.find(a => a.name.includes('Mortgage Payable'))?.id
        const interestAcc = accounts.find(a => a.name.includes('Interest'))?.id || accounts.find(a => a.account_type === 'Expense')?.id
        const escrowAcc = accounts.find(a => a.name.includes('Tax') || a.name.includes('Insurance'))?.id || accounts.find(a => a.account_type === 'Expense')?.id

        if (extractedInvoice.principal_amount > 0) journalEntries.push({ transaction_id: txnData.id, account_id: principalAcc, property_id: selectedProperty, description: 'Principal Payment', debit: Number(extractedInvoice.principal_amount) })
        if (extractedInvoice.interest_amount > 0) journalEntries.push({ transaction_id: txnData.id, account_id: interestAcc, property_id: selectedProperty, description: 'Interest Payment', debit: Number(extractedInvoice.interest_amount) })
        if (extractedInvoice.escrow_amount > 0) journalEntries.push({ transaction_id: txnData.id, account_id: escrowAcc, property_id: selectedProperty, description: 'Escrow Payment', debit: Number(extractedInvoice.escrow_amount) })
      } else {
        const expenseAcc = accounts.find(a => a.account_type === 'Expense')?.id
        journalEntries.push({ transaction_id: txnData.id, account_id: expenseAcc, property_id: selectedProperty, description: extractedInvoice.description, debit: Number(extractedInvoice.total_amount) })
      }

      const { error: jeErr } = await supabase.from('journal_entries').insert(journalEntries)
      if (jeErr) throw jeErr

      alert("Invoice successfully posted to the General Ledger!")
      setExtractedInvoice(null); setInvoiceFile(null); setSelectedProperty('')
    } catch (error: any) { alert("Database Error: " + error.message) }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">AI Document Intelligence</h2>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setActiveTab('lease')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'lease' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Lease Abstraction</button>
          <button onClick={() => setActiveTab('invoice')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'invoice' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Invoice & Mortgage Reader</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex space-x-6 bg-gray-100">
        <div className="w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-[calc(100vh-120px)]">
          <h3 className="font-bold text-gray-800 mb-2">1. Upload {activeTab === 'lease' ? 'Lease' : 'Statement'}</h3>
          <div className="flex-1 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center bg-gray-50 p-6">
            <input 
  type="file" 
  accept={activeTab === 'lease' ? ".pdf" : ".pdf, image/*"} 
  onChange={(e) => activeTab === 'lease' ? setLeaseFile(e.target.files?.[0] || null) : setInvoiceFile(e.target.files?.[0] || null)} 
  className="mb-4 w-full" 
/>
          </div>
          <button onClick={activeTab === 'lease' ? handleScanLease : handleScanInvoice} disabled={activeTab === 'lease' ? (isScanningLease || !leaseFile) : (isScanningInvoice || !invoiceFile)} className={`w-full mt-4 py-3 rounded-lg font-bold text-white transition shadow-sm ${activeTab === 'lease' ? (isScanningLease || !leaseFile) : (isScanningInvoice || !invoiceFile) ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
            {activeTab === 'lease' ? (isScanningLease ? 'Reading...' : 'Scan Lease') : (isScanningInvoice ? 'Reading...' : 'Scan Invoice')}
          </button>
        </div>

        <div className="w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
          <h3 className="font-bold text-gray-800 mb-4">2. Review & Approve</h3>
          
          {activeTab === 'lease' && extractedLease && (
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700">Tenant Name</label><input type="text" className="w-full border p-2 rounded bg-gray-50 font-medium" value={extractedLease.tenant_name} readOnly /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">Start Date</label><input type="text" className="w-full border p-2 rounded bg-gray-50" value={extractedLease.start_date} readOnly /></div>
                <div><label className="block text-sm font-medium text-gray-700">End Date</label><input type="text" className="w-full border p-2 rounded bg-gray-50" value={extractedLease.end_date} readOnly /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700">Base Rent ($)</label><input type="text" className="w-full border p-2 rounded bg-gray-50 font-bold text-green-700" value={extractedLease.base_rent} readOnly /></div>
              <div><label className="block text-sm font-medium text-gray-700">CAM Provisions</label><textarea className="w-full border p-2 rounded bg-gray-50 h-24 resize-none text-sm" value={extractedLease.cam_provisions} readOnly /></div>
              <button onClick={saveLeaseToDatabase} className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition shadow-sm">Approve & Save Lease</button>
            </div>
          )}

          {activeTab === 'invoice' && extractedInvoice && (
            <div className="space-y-4">
              {extractedInvoice.is_mortgage && <div className="bg-blue-100 text-blue-800 p-2 rounded text-sm font-bold text-center mb-4">🏦 Mortgage Statement Detected</div>}
              <div><label className="block text-sm font-medium text-gray-700">Payee / Lender</label><input type="text" className="w-full border p-2 rounded bg-gray-50 font-medium" value={extractedInvoice.payee_name} readOnly /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700">Date</label><input type="text" className="w-full border p-2 rounded bg-gray-50" value={extractedInvoice.date} readOnly /></div>
                <div><label className="block text-sm font-medium text-gray-700">Total Amount ($)</label><input type="text" className="w-full border p-2 rounded bg-gray-50 font-bold text-red-600" value={extractedInvoice.total_amount} readOnly /></div>
              </div>
              {extractedInvoice.is_mortgage && (
                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded border border-gray-200">
                  <div><label className="block text-xs font-medium text-gray-500">Principal</label><input type="text" className="w-full border p-1 rounded text-sm bg-white" value={extractedInvoice.principal_amount} readOnly /></div>
                  <div><label className="block text-xs font-medium text-gray-500">Interest</label><input type="text" className="w-full border p-1 rounded text-sm bg-white" value={extractedInvoice.interest_amount} readOnly /></div>
                  <div><label className="block text-xs font-medium text-gray-500">Escrow</label><input type="text" className="w-full border p-1 rounded text-sm bg-white" value={extractedInvoice.escrow_amount} readOnly /></div>
                </div>
              )}
              <div><label className="block text-sm font-medium text-gray-700">Description</label><input type="text" className="w-full border p-2 rounded bg-gray-50 text-sm" value={extractedInvoice.description} readOnly /></div>
              <div className="pt-4 border-t border-gray-200">
                <label className="block text-sm font-bold text-blue-600 mb-1">Assign to Property *</label>
                <select className="w-full border-2 border-blue-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)}>
                  <option value="">-- Select Property --</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <button onClick={saveInvoiceToDatabase} className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition shadow-sm">Post to General Ledger</button>
            </div>
          )}
        </div>
      </main>
    </>
  )
}