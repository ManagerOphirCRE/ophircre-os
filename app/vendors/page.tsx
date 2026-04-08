"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function VendorsPage() {
  const[vendors, setVendors] = useState<any[]>([])
  const[isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Form State
  const[companyName, setCompanyName] = useState('')
  const [trade, setTrade] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => { fetchVendors() },[])

  async function fetchVendors() {
    const { data } = await supabase.from('vendors').select('*').order('company_name', { ascending: true })
    if (data) setVendors(data)
  }

  async function saveVendor(e: any) {
    e.preventDefault()
    if (!companyName) return alert("Company name is required.")
    setIsSaving(true)

    try {
      const { error } = await supabase.from('vendors').insert([{
        company_name: companyName,
        trade,
        contact_email: email
      }])

      if (error) throw error

      setIsModalOpen(false)
      setCompanyName(''); setTrade(''); setEmail('')
      fetchVendors()
    } catch (error: any) {
      alert("Error saving vendor: " + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Vendor Directory</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          + Add Vendor
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr key={v.id} onClick={() => window.location.href = `/vendors/${v.id}`} className="hover:bg-blue-50 cursor-pointer transition">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trade / Specialty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Portal Email</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vendors.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{v.company_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.trade || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.contact_email || 'No email (Portal Access Disabled)'}</td>
                </tr>
              ))}
              {vendors.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No vendors found.</td></tr>}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg w-[500px]">
              <h3 className="text-xl font-bold mb-6 text-gray-800">Add New Vendor</h3>
              <form onSubmit={saveVendor} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                  <input type="text" required className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trade / Specialty</label>
                  <input type="text" placeholder="e.g., Plumbing, Landscaping" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={trade} onChange={(e) => setTrade(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email (For Portal Access)</label>
                  <input type="email" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="flex justify-end space-x-3 pt-4 mt-2 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" disabled={isSaving} className={`px-4 py-2 rounded font-medium text-white ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>Save Vendor</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  )
}