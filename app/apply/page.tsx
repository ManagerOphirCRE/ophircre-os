"use client"
import { useState } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function RentalApplicationPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const[businessType, setBusinessType] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  async function submitApplication(e: any) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // 1. Save as a "Prospect" in the tenants table
      const { data: tenantData, error: tErr } = await supabase.from('tenants').insert([{
        name,
        contact_email: email,
        contact_phone: phone,
        entity_type: businessType,
        status: 'prospect_new' // Special status for the pipeline
      }]).select().single()

      if (tErr) throw tErr

      // 2. Alert Management via Task Board
      await supabase.from('tasks').insert([{
        title: `NEW APPLICATION: ${name}`,
        description: `New rental application received from ${name} (${businessType}). Email: ${email}, Phone: ${phone}.`,
        status: 'To Do',
        tenant_id: tenantData.id
      }])

      setIsSuccess(true)
    } catch (error: any) {
      alert("Error submitting application: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-t-8 border-green-500">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Application Received!</h2>
          <p className="text-gray-600">Thank you for applying. Our leasing team will review your information and contact you shortly.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        
        <div className="bg-slate-900 p-8 text-center text-white">
          <h1 className="text-3xl font-bold tracking-wider">OphirCRE</h1>
          <p className="text-slate-400 mt-2">Commercial Commercial Rental Application</p>
        </div>

        <form onSubmit={submitApplication} className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Business Name / DBA *</label>
            <input type="text" required className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Contact Email *</label>
              <input type="email" required className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Contact Phone *</label>
              <input type="tel" required className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Type of Business / Industry *</label>
            <input type="text" required placeholder="e.g., Retail Coffee Shop, Medical Office" className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={businessType} onChange={(e) => setBusinessType(e.target.value)} />
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
            <strong>Note:</strong> Upon initial review, you will receive a secure link to upload financial documents and negotiate lease terms.
          </div>

          <button type="submit" disabled={isSubmitting} className={`w-full py-4 rounded-lg font-bold text-white transition shadow-md text-lg ${isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  )
}