"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function CompliancePage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const { data: tData } = await supabase.from('tenants').select('*').order('name')
      if (tData) setTenants(tData)
      
      const { data: vData } = await supabase.from('vendors').select('*').order('company_name')
      if (vData) setVendors(vData)
      
      setIsLoading(false)
    }
    fetchData()
  },[])

  // Helper function to determine COI status
  function getStatus(dateString: string | null) {
    if (!dateString) return { label: 'Missing COI', color: 'bg-red-100 text-red-800 border-red-200' }
    
    const expDate = new Date(dateString)
    const today = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(today.getDate() + 30)

    if (expDate < today) return { label: 'Expired', color: 'bg-red-100 text-red-800 border-red-200' }
    if (expDate <= thirtyDaysFromNow) return { label: 'Expiring Soon', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' }
    return { label: 'Compliant', color: 'bg-green-100 text-green-800 border-green-200' }
  }

  if (isLoading) return <div className="p-8">Loading compliance data...</div>

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Compliance & COI Tracker</h2>
        <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          🖨️ Print Report
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* TENANT COMPLIANCE */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">Tenant Insurance (COI)</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tenant Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Expiration Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tenants.map(t => {
                  const status = getStatus(t.coi_expiration)
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">{t.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.coi_expiration || 'Not on file'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* VENDOR COMPLIANCE */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">Vendor Insurance (COI)</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Vendor Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Expiration Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vendors.map(v => {
                  const status = getStatus(v.coi_expiration)
                  return (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">{v.company_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{v.coi_expiration || 'Not on file'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold border ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

        </div>
      </main>
    </>
  )
}