"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function TenantPortal() {
  const [tenant, setTenant] = useState<any>(null)
  const [ticketTitle, setTicketTitle] = useState('')
  const [ticketDesc, setTicketDesc] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchSimulatedTenant()
  }, [])

  // For Phase 3 testing, we just grab the first tenant in the DB to simulate a logged-in user
  async function fetchSimulatedTenant() {
    const { data } = await supabase.from('tenants').select('*').limit(1).single()
    if (data) setTenant(data)
  }

  // Submit a maintenance ticket directly to the Landlord's Kanban Board
  async function submitTicket(e: any) {
    e.preventDefault()
    if (!ticketTitle) return alert("Please enter an issue title.")
    setIsSubmitting(true)

    try {
      const { error } = await supabase.from('tasks').insert([{
        title: `TENANT TICKET: ${ticketTitle}`,
        description: ticketDesc,
        tenant_id: tenant.id,
        status: 'New' // Drops it into the first column of your Kanban board
      }])

      if (error) throw error
      alert("Ticket submitted successfully! Management has been notified.")
      setTicketTitle('')
      setTicketDesc('')
    } catch (error: any) {
      alert("Error submitting ticket: " + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!tenant) return <div className="p-8 text-center text-gray-500">Loading your portal...</div>

  return (
    <div className="space-y-8">
      
      {/* Welcome Banner */}
      <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-md">
        <h2 className="text-3xl font-bold mb-2">Welcome back, {tenant.name}</h2>
        <p className="text-blue-100">Manage your lease, pay rent, and request maintenance here.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Account & Lease Info */}
        <div className="md:col-span-1 space-y-8">
          
          {/* Balance Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-gray-500 font-medium mb-2">Current Balance</h3>
            <p className="text-4xl font-bold text-gray-900 mb-4">$0.00</p>
            <button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition shadow-sm">
              Make a Payment
            </button>
            <p className="text-xs text-center text-gray-400 mt-3">Payments securely processed via Bank Transfer</p>
          </div>

          {/* Lease Details Card */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Lease Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="font-medium text-green-600">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Entity</span>
                <span className="font-medium text-gray-900">{tenant.entity_type || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Contact</span>
                <span className="font-medium text-gray-900">{tenant.contact_email || 'N/A'}</span>
              </div>
            </div>
            <button className="w-full mt-6 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition">
              View Lease Document
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Maintenance Ticketing */}
        <div className="md:col-span-2">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 h-full">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Request Maintenance</h3>
            <p className="text-gray-500 mb-6">Submit a work order directly to property management. For emergencies, please call immediately.</p>
            
            <form onSubmit={submitTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Issue Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g., AC not cooling, Leaking faucet" 
                  className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={ticketTitle}
                  onChange={(e) => setTicketTitle(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Description</label>
                <textarea 
                  required
                  placeholder="Please provide as much detail as possible..." 
                  className="w-full border p-3 rounded-lg h-32 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  value={ticketDesc}
                  onChange={(e) => setTicketDesc(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attach Photo (Optional)</label>
                <input type="file" className="w-full border p-2 rounded-lg text-sm" />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 rounded-lg font-bold text-white transition shadow-sm mt-4 ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Work Order'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}