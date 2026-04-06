"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'
import { useParams } from 'next/navigation'

export default function TenantProfilePage() {
  const params = useParams()
  const tenantId = params.id

  const[tenant, setTenant] = useState<any>(null)
  const [lease, setLease] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Tenant State
  const[coiDate, setCoiDate] = useState('')

  // Lease Financials State
  const [baseRent, setBaseRent] = useState(0)
  const [camCharge, setCamCharge] = useState(0)
  const[taxCharge, setTaxCharge] = useState(0)
  const [insCharge, setInsCharge] = useState(0)
  
  // Escalation State
  const [escalationDate, setEscalationDate] = useState('')
  const [escalationPct, setEscalationPct] = useState(0)

  useEffect(() => {
    async function fetchTenantData() {
      const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).single()
      if (tData) {
        setTenant(tData)
        setCoiDate(tData.coi_expiration || '')
      }

      const { data: lData } = await supabase.from('leases').select('*, spaces(name, properties(name))').eq('tenant_id', tenantId).single()
      if (lData) {
        setLease(lData)
        setBaseRent(lData.base_rent_amount || 0)
        setCamCharge(lData.cam_charge || 0)
        setTaxCharge(lData.tax_charge || 0)
        setInsCharge(lData.insurance_charge || 0)
        setEscalationDate(lData.next_escalation_date || '')
        setEscalationPct(lData.escalation_percentage || 0)
      }
    }
    fetchTenantData()
  }, [tenantId])

  async function saveProfile() {
    setIsSaving(true)
    try {
      // Save Tenant Data (COI)
      await supabase.from('tenants').update({ coi_expiration: coiDate || null }).eq('id', tenantId)

      // Save Lease Data
      if (lease) {
        await supabase.from('leases').update({
          base_rent_amount: baseRent, cam_charge: camCharge, tax_charge: taxCharge, insurance_charge: insCharge,
          next_escalation_date: escalationDate || null, escalation_percentage: escalationPct
        }).eq('id', lease.id)
      }
      alert("Profile and Financials Updated!")
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
        <button onClick={saveProfile} disabled={isSaving} className={`px-6 py-2 rounded-md font-bold text-white transition shadow-sm ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex space-x-6 bg-gray-100">
        
        {/* LEFT COLUMN */}
        <div className="w-1/3 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Contact & Compliance</h3>
            <div className="space-y-3 text-sm mb-4">
              <p><span className="text-gray-500 block">Email:</span> <span className="font-medium">{tenant.contact_email || 'N/A'}</span></p>
              <p><span className="text-gray-500 block">Phone:</span> <span className="font-medium">{tenant.contact_phone || 'N/A'}</span></p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">COI Expiration Date</label>
              <input type="date" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={coiDate} onChange={(e) => setCoiDate(e.target.value)} />
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

        {/* RIGHT COLUMN */}
        <div className="w-2/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Lease Financials & Escalations</h3>
          
          {lease ? (
            <div className="space-y-6 max-w-md">
              
              {/* Escrows */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Monthly Charges</h4>
                <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Base Rent</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right font-bold" value={baseRent} onChange={(e) => setBaseRent(Number(e.target.value))} /></div></div>
                <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">CAM Escrow</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={camCharge} onChange={(e) => setCamCharge(Number(e.target.value))} /></div></div>
                <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Tax Escrow</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={taxCharge} onChange={(e) => setTaxCharge(Number(e.target.value))} /></div></div>
                <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Insurance Escrow</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={insCharge} onChange={(e) => setInsCharge(Number(e.target.value))} /></div></div>
              </div>

              {/* Escalations */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Rent Escalations</h4>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Next Bump Date</label>
                  <input type="date" className="border p-2 rounded w-40 outline-none focus:ring-2 focus:ring-blue-500" value={escalationDate} onChange={(e) => setEscalationDate(e.target.value)} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Increase Percentage</label>
                  <div className="relative">
                    <input type="number" step="0.1" className="border p-2 pr-6 rounded w-32 text-right outline-none focus:ring-2 focus:ring-blue-500" value={escalationPct} onChange={(e) => setEscalationPct(Number(e.target.value))} />
                    <span className="absolute right-3 top-2 text-gray-500">%</span>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded border border-yellow-200 text-sm">This tenant does not have an active lease attached to them yet.</div>
          )}
        </div>

      </main>
    </>
  )
}