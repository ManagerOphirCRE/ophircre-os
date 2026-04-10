"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'
import { useRouter } from 'next/navigation'

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const[isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [name, setName] = useState('')
  const [entityType, setEntityType] = useState('')
  const[email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const router = useRouter() // NEW: Next.js Router

  useEffect(() => {
    fetchTenants()
  },[])

  async function fetchTenants() {
    const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false })
    if (data) setTenants(data)
  }

  async function saveTenant(e: any) {
    e.preventDefault()
    if (!name) return alert("Tenant name is required.")
    setIsSaving(true)

    try {
      const { error } = await supabase.from('tenants').insert([{
        name, entity_type: entityType, contact_email: email, contact_phone: phone, status: 'active'
      }])
      if (error) throw error

      setIsModalOpen(false)
      setName(''); setEntityType(''); setEmail(''); setPhone('')
      fetchTenants()
    } catch (error: any) {
      alert("Error saving tenant: " + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Tenant Directory</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          + Add Tenant
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tenants.map((tenant) => (
                <tr 
                  key={tenant.id} 
                  // UPGRADE: Instant client-side routing
                  onClick={() => router.push(`/tenants/${tenant.id}`)} 
                  className="hover:bg-blue-50 cursor-pointer transition"
                >
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{tenant.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.entity_type || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.contact_email || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{tenant.contact_phone || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Active</span>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No tenants found.</td></tr>}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg w-[500px]">
              <h3 className="text-xl font-bold mb-6 text-gray-800">Add New Tenant</h3>
              <form onSubmit={saveTenant} className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tenant / DBA Name *</label><input type="text" required className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Legal Entity Type</label><input type="text" placeholder="e.g., LLC, Inc, Individual" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={entityType} onChange={(e) => setEntityType(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label><input type="email" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label><input type="tel" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="flex justify-end space-x-3 pt-4 mt-2 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" disabled={isSaving} className={`px-4 py-2 rounded font-medium text-white ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>Save Tenant</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  )
}