"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function RentRollPage() {
  const[leases, setLeases] = useState<any[]>([])
  const [totalBaseRent, setTotalBaseRent] = useState(0)
  const [totalEscrows, setTotalEscrows] = useState(0)

  useEffect(() => {
    async function fetchRentRoll() {
      const { data } = await supabase
        .from('leases')
        .select('*, tenants(name, status), spaces(name, square_footage, properties(name))')
        .order('end_date', { ascending: true })
      
      if (data) {
        // Only show leases for active tenants
        const activeLeases = data.filter(l => l.tenants?.status === 'active')
        setLeases(activeLeases)
        
        setTotalBaseRent(activeLeases.reduce((sum, l) => sum + Number(l.base_rent_amount || 0), 0))
        setTotalEscrows(activeLeases.reduce((sum, l) => sum + Number(l.cam_charge || 0) + Number(l.tax_charge || 0) + Number(l.insurance_charge || 0), 0))
      }
    }
    fetchRentRoll()
  },[])

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center print:hidden">
        <h2 className="text-xl font-semibold text-gray-800">Master Rent Roll</h2>
        <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          🖨️ Print Report
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100 print:bg-white print:p-0">
        
        <div className="hidden print:block text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">OphirCRE Master Rent Roll</h1>
          <p className="text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
          <div className="p-6 bg-gray-50 border-b flex justify-between items-center print:bg-white print:border-b-2 print:border-gray-800">
            <h3 className="font-bold text-gray-800">Active Leases ({leases.length})</h3>
            <div className="text-right">
              <span className="text-sm font-medium text-gray-600 block">Total Monthly Base Rent: <span className="text-green-600 font-bold">${totalBaseRent.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></span>
              <span className="text-sm font-medium text-gray-600 block">Total Monthly Escrows: <span className="text-blue-600 font-bold">${totalEscrows.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></span>
            </div>
          </div>

          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Property & Space</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">SqFt</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Lease Term</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Base Rent</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Escrows</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase">Total Monthly</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leases.map(l => {
                const escrows = Number(l.cam_charge || 0) + Number(l.tax_charge || 0) + Number(l.insurance_charge || 0)
                const total = Number(l.base_rent_amount || 0) + escrows
                
                // Highlight leases expiring in the next 90 days
                const isExpiringSoon = new Date(l.end_date) < new Date(new Date().setDate(new Date().getDate() + 90))

                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-bold text-blue-600">{l.tenants?.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{l.spaces?.properties?.name} <br/><span className="text-gray-500 text-xs">{l.spaces?.name}</span></td>
                    <td className="px-6 py-4 text-sm text-gray-500">{l.spaces?.square_footage}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {l.start_date} to <span className={isExpiringSoon ? 'text-red-600 font-bold' : ''}>{l.end_date}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">${Number(l.base_rent_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-500">${escrows.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-green-700">${total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                  </tr>
                )
              })}
              {leases.length === 0 && <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No active leases found.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}