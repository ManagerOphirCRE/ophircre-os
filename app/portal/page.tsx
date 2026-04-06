"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function TenantPortal() {
  const [tenant, setTenant] = useState<any>(null)
  const[ticketTitle, setTicketTitle] = useState('')
  const [ticketDesc, setTicketDesc] = useState('')
  
  // Survey State
  const [rating, setRating] = useState(5)
  const [feedback, setFeedback] = useState('')
  const [surveySent, setSurveySent] = useState(false)

  useEffect(() => { fetchSimulatedTenant() },[])

  async function fetchSimulatedTenant() {
    const { data } = await supabase.from('tenants').select('*').limit(1).single()
    if (data) setTenant(data)
  }

  async function submitTicket(e: any) {
    e.preventDefault()
    await supabase.from('tasks').insert([{ title: `TENANT TICKET: ${ticketTitle}`, description: ticketDesc, tenant_id: tenant.id, status: 'New' }])
    alert("Ticket submitted!"); setTicketTitle(''); setTicketDesc('')
  }

  async function submitSurvey(e: any) {
    e.preventDefault()
    await supabase.from('tenant_surveys').insert([{ tenant_id: tenant.id, rating, feedback }])
    setSurveySent(true)
  }

  if (!tenant) return <div className="p-8 text-center text-gray-500">Loading your portal...</div>

  return (
    <div className="space-y-8">
      <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-md">
        <h2 className="text-3xl font-bold mb-2">Welcome back, {tenant.name}</h2>
        <p className="text-blue-100">Manage your lease, pay rent, and request maintenance here.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-gray-500 font-medium mb-2">Current Balance</h3>
            <p className="text-4xl font-bold text-gray-900 mb-4">$0.00</p>
            <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition">Make a Payment</button>
          </div>

          {/* NEW: Tenant Survey Box */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl shadow-sm text-white">
            <h3 className="font-bold mb-2">How are we doing?</h3>
            {surveySent ? (
              <p className="text-green-400 text-sm font-medium">Thank you for your feedback!</p>
            ) : (
              <form onSubmit={submitSurvey} className="space-y-3">
                <p className="text-xs text-slate-300">Please rate your experience at our property.</p>
                <select className="w-full p-2 rounded text-slate-900 text-sm outline-none" value={rating} onChange={(e)=>setRating(Number(e.target.value))}>
                  <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
                  <option value="4">⭐⭐⭐⭐ Good</option>
                  <option value="3">⭐⭐⭐ Average</option>
                  <option value="2">⭐⭐ Poor</option>
                  <option value="1">⭐ Terrible</option>
                </select>
                <textarea placeholder="Any comments?" className="w-full p-2 rounded text-slate-900 text-sm h-16 resize-none outline-none" value={feedback} onChange={(e)=>setFeedback(e.target.value)}></textarea>
                <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-bold text-sm transition">Submit Survey</button>
              </form>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 h-full">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Request Maintenance</h3>
            <form onSubmit={submitTicket} className="space-y-4 mt-6">
              <input type="text" required placeholder="Issue Title" className="w-full border p-3 rounded-lg outline-none" value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} />
              <textarea required placeholder="Detailed Description..." className="w-full border p-3 rounded-lg h-32 outline-none resize-none" value={ticketDesc} onChange={(e) => setTicketDesc(e.target.value)} />
              <button type="submit" className="w-full py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700">Submit Work Order</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}