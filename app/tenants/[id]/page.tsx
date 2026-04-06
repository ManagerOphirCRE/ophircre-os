"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'
import { useParams } from 'next/navigation'

export default function TenantProfilePage() {
  const params = useParams()
  const tenantId = params.id

  const [tenant, setTenant] = useState<any>(null)
  const [lease, setLease] = useState<any>(null)
  const[isSaving, setIsSaving] = useState(false)

  // Lease Financials State
  const [baseRent, setBaseRent] = useState(0)
  const [camCharge, setCamCharge] = useState(0)
  const[taxCharge, setTaxCharge] = useState(0)
  const [insCharge, setInsCharge] = useState(0)

  useEffect(() => {
    async function fetchTenantData() {
      // Fetch Tenant
      const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).single()
      if (tData) setTenant(tData)

      // Fetch their active lease
      const { data: lData } = await supabase.from('leases').select('*, spaces(name, properties(name))').eq('tenant_id', tenantId).single()
      if (lData) {
        setLease(lData)
        setBaseRent(lData.base_rent_amount || 0)
        setCamCharge(lData.cam_charge || 0)
        setTaxCharge(lData.tax_charge || 0)
        setInsCharge(lData.insurance_charge || 0)
      }
    }
    fetchTenantData()
  }, [tenantId])

  async function saveLeaseFinancials() {
    setIsSaving(true)
    try {
      const { error } = await supabase.from('leases').update({
        base_rent_amount: baseRent,
        cam_charge: camCharge,
        tax_charge: taxCharge,
        insurance_charge: insCharge
      }).eq('id', lease.id)

      if (error) throw error
      alert("Lease Financials Updated! The Auto-Split engine will now use these numbers.")
    } catch (error: any) {
      alert("Error saving: " + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!tenant) return <div className="p-8 text-gray-500">Loading Tenant Profile...</div>

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <div>
          <a href="/tenants" className="text-sm text-blue-600 hover:underline mb-1 inline-block">← Back to Directory</a>
          <h2 className="text-2xl font-bold text-gray-800">{tenant.name}</h2>
        </div>
        <div className="space-x-3">
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md font-medium shadow-sm">Edit Details</button>
          <a href={`mailto:${tenant.contact_email}`} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium shadow-sm">Email Tenant</a>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex space-x-6 bg-gray-100">
        
        {/* LEFT COLUMN: Contact & Space Info */}
        <div className="w-1/3 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Contact Information</h3>
            <div className="space-y-3 text-sm">
              <p><span className="text-gray-500 block">Legal Entity:</span> <span className="font-medium">{tenant.entity_type || 'N/A'}</span></p>
              <p><span className="text-gray-500 block">Email:</span> <span className="font-medium">{tenant.contact_email || 'N/A'}</span></p>
              <p><span className="text-gray-500 block">Phone:</span> <span className="font-medium">{tenant.contact_phone || 'N/A'}</span></p>
              <p><span className="text-gray-500 block">Status:</span> <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold uppercase">Active</span></p>
            </div>
          </div>

          {lease && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Location</h3>
              <div className="space-y-3 text-sm">
                <p><span className="text-gray-500 block">Property:</span> <span className="font-bold text-blue-600">{lease.spaces?.properties?.name || 'Unassigned'}</span></p>
                <p><span className="text-gray-500 block">Space / Suite:</span> <span className="font-medium">{lease.spaces?.name || 'Unassigned'}</span></p>
                <p><span className="text-gray-500 block">Lease Term:</span> <span className="font-medium">{lease.start_date} to {lease.end_date}</span></p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Lease Financials (The Auto-Split Brain) */}
        <div className="w-2/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Lease Financials (Monthly Escrows)</h3>
          <p className="text-sm text-gray-500 mb-6">Set the expected monthly charges here. When you type this tenant's name into the Financials ledger, the system will automatically split their payment into these exact buckets.</p>
          
          {lease ? (
            <div className="space-y-4 max-w-md">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Base Rent</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" className="border p-2 pl-6 rounded w-32 text-right font-bold" value={baseRent} onChange={(e) => setBaseRent(Number(e.target.value))} />
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">CAM Escrow</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={camCharge} onChange={(e) => setCamCharge(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Real Estate Tax Escrow</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={taxCharge} onChange={(e) => setTaxCharge(Number(e.target.value))} />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Insurance Escrow</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={insCharge} onChange={(e) => setInsCharge(Number(e.target.value))} />
                </div>
              </div>

              <div className="pt-4 border-t mt-6 flex justify-between items-center">
                <span className="font-bold text-gray-800">Total Expected Monthly:</span>
                <span className="text-xl font-black text-green-600">${(baseRent + camCharge + taxCharge + insCharge).toFixed(2)}</span>
              </div>

              <button onClick={saveLeaseFinancials} disabled={isSaving} className={`w-full mt-6 py-3 rounded-lg font-bold text-white transition shadow-sm ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSaving ? 'Saving...' : 'Save Financials'}
              </button>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded border border-yellow-200 text-sm">
              This tenant does not have an active lease attached to them yet. Go to the AI Scanner or Lease Drafter to create one!
            </div>
          )}
        </div>

      </main>
    </>
  )
}