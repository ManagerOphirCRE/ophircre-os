"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function VendorPortal() {
  const [vendor, setVendor] = useState<any>(null)
  const [properties, setProperties] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [propertyId, setPropertyId] = useState('')
  const[submissionType, setSubmissionType] = useState('Invoice')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [attestation, setAttestation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function loadSecureVendor() {
      const { data: { session } } = await supabase.auth.getSession()
      const userEmail = session?.user?.email

      if (userEmail) {
        const { data: vData } = await supabase.from('vendors').select('*').ilike('contact_email', userEmail).single()
        if (vData) setVendor(vData)
      }
      
      const { data: pData } = await supabase.from('properties').select('*').order('name')
      if (pData) setProperties(pData)
      
      setIsLoading(false)
    }
    loadSecureVendor()
  },[])

  async function handleSubmit(e: any) {
    e.preventDefault()
    if (!propertyId) return alert("Please select the property you serviced.")
    if (submissionType === 'Inspection Report' && !attestation) return alert("You must check the attestation box.")
    setIsSubmitting(true)

    try {
      const { error: subError } = await supabase.from('vendor_submissions').insert([{
        vendor_id: vendor.id, property_id: propertyId, submission_type: submissionType,
        amount: amount ? Number(amount) : null, notes, attestation_agreed: attestation
      }])
      if (subError) throw subError

      const propertyName = properties.find(p => p.id === propertyId)?.name || 'a property'
      await supabase.from('tasks').insert([{
        title: `REVIEW: ${submissionType} from ${vendor.company_name}`,
        description: `Vendor submitted a ${submissionType} for ${propertyName}. Notes: ${notes}`,
        status: 'To Do'
      }])

      alert("Successfully submitted! Thank you.")
      setPropertyId(''); setAmount(''); setNotes(''); setAttestation(false)
    } catch (error: any) {
      alert("Error submitting: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <div className="p-8 text-center">Authenticating secure connection...</div>
  
  if (!vendor) return (
    <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-red-200 max-w-2xl mx-auto mt-10">
      <h2 className="text-2xl font-bold text-red-600 mb-2">Vendor Account Not Linked</h2>
      <p className="text-gray-600">Your email address is not currently linked to an approved vendor profile. Please contact Accounts Payable.</p>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-slate-100 p-6 border-b border-slate-200">
        <h2 className="text-2xl font-bold text-slate-800">Submit Work or Invoice</h2>
        <p className="text-slate-600 mt-1">Welcome, <span className="font-semibold">{vendor.company_name}</span>. Please upload your documentation below.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Property Serviced *</label>
            <select required className="w-full border border-slate-300 p-3 rounded-lg outline-none" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              <option value="">-- Select Property --</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Submission Type *</label>
            <select className="w-full border border-slate-300 p-3 rounded-lg outline-none" value={submissionType} onChange={(e) => setSubmissionType(e.target.value)}>
              <option value="Invoice">Bill / Invoice</option>
              <option value="Inspection Report">Inspection Report / Attestation</option>
              <option value="Routine Photo">Routine Photos</option>
            </select>
          </div>
        </div>

        {submissionType === 'Invoice' && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Invoice Amount ($) *</label>
            <input type="number" required step="0.01" className="w-full md:w-1/2 border border-slate-300 p-3 rounded-lg outline-none" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Notes / Description of Work</label>
          <textarea required className="w-full border border-slate-300 p-3 rounded-lg h-24 outline-none resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {submissionType === 'Inspection Report' && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start space-x-3">
            <input type="checkbox" id="attest" className="mt-1 w-5 h-5 text-amber-600 rounded" checked={attestation} onChange={(e) => setAttestation(e.target.checked)} />
            <label htmlFor="attest" className="text-sm text-amber-900 font-medium cursor-pointer">
              <strong>Legal Attestation:</strong> I certify that the inspection/work was completed according to local code and property standards.
            </label>
          </div>
        )}

        <button type="submit" disabled={isSubmitting} className={`w-full py-4 rounded-lg font-bold text-white transition shadow-md text-lg ${isSubmitting ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'}`}>
          {isSubmitting ? 'Submitting...' : 'Submit to Property Management'}
        </button>
      </form>
    </div>
  )
}