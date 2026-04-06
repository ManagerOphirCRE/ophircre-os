"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function PropertiesPage() {
  const[properties, setProperties] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newProperty, setNewProperty] = useState({ name: '', address: '', total_sqft: '' })

  useEffect(() => {
    fetchProperties()
  },[])

  async function fetchProperties() {
    const { data } = await supabase.from('properties').select('*').order('created_at', { ascending: false })
    if (data) setProperties(data)
  }

  async function saveProperty() {
    await supabase.from('properties').insert([
      { 
        name: newProperty.name, 
        address: newProperty.address, 
        total_sqft: Number(newProperty.total_sqft) 
      }
    ])
    setIsModalOpen(false)
    setNewProperty({ name: '', address: '', total_sqft: '' })
    fetchProperties()
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">My Portfolio</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          + Add Property
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total SqFt</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {properties.map((property) => (
                <tr 
                  key={property.id} 
                  onClick={() => window.location.href = `/properties/${property.id}`} 
                  className="hover:bg-blue-50 cursor-pointer transition"
                >
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{property.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{property.address}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{property.total_sqft}</td>
                </tr>
              ))}
              {properties.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No properties found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* POP-UP MODAL */}
        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg w-96">
              <h3 className="text-lg font-bold mb-4">Add New Property</h3>
              <input 
                type="text" placeholder="Property Name" className="w-full border p-2 mb-3 rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={newProperty.name} onChange={(e) => setNewProperty({...newProperty, name: e.target.value})}
              />
              <input 
                type="text" placeholder="Address" className="w-full border p-2 mb-3 rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={newProperty.address} onChange={(e) => setNewProperty({...newProperty, address: e.target.value})}
              />
              <input 
                type="number" placeholder="Total Square Footage" className="w-full border p-2 mb-4 rounded outline-none focus:ring-2 focus:ring-blue-500"
                value={newProperty.total_sqft} onChange={(e) => setNewProperty({...newProperty, total_sqft: e.target.value})}
              />
              <div className="flex justify-end space-x-2">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                <button onClick={saveProperty} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Save</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}