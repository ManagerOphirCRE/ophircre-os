"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'
import { useParams } from 'next/navigation'

export default function PropertyProfilePage() {
  const params = useParams()
  const propertyId = params.id

  const [property, setProperty] = useState<any>(null)
  const [spaces, setSpaces] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Property State
  const[name, setName] = useState(''); const [address, setAddress] = useState(''); const [sqft, setSqft] = useState('')
  const [landlordName, setLandlordName] = useState(''); const[landlordEmail, setLandlordEmail] = useState('')
  const [landlordPhone, setLandlordPhone] = useState(''); const[landlordAddress, setLandlordAddress] = useState('')
  const [purchasePrice, setPurchasePrice] = useState(''); const[currentValue, setCurrentValue] = useState('')
  const [mortgageBalance, setMortgageBalance] = useState(''); const[interestRate, setInterestRate] = useState('')

  // New Space State
  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceSqft, setNewSpaceSqft] = useState('')
  const [newSpaceType, setNewSpaceType] = useState('physical')

  useEffect(() => { fetchPropertyData() }, [propertyId])

  async function fetchPropertyData() {
    const { data: pData } = await supabase.from('properties').select('*').eq('id', propertyId).single()
    if (pData) {
      setProperty(pData); setName(pData.name || ''); setAddress(pData.address || ''); setSqft(pData.total_sqft || '')
      setLandlordName(pData.landlord_entity_name || ''); setLandlordEmail(pData.landlord_email || '')
      setLandlordPhone(pData.landlord_phone || ''); setLandlordAddress(pData.landlord_address || '')
      setPurchasePrice(pData.purchase_price || ''); setCurrentValue(pData.current_value || '')
      setMortgageBalance(pData.mortgage_balance || ''); setInterestRate(pData.interest_rate || '')
    }
    const { data: sData } = await supabase.from('spaces').select('*').eq('property_id', propertyId).order('name')
    if (sData) setSpaces(sData)
  }

  async function savePropertyDetails() {
    setIsSaving(true)
    try {
      await supabase.from('properties').update({
        name, address, total_sqft: Number(sqft), landlord_entity_name: landlordName, landlord_email: landlordEmail,
        landlord_phone: landlordPhone, landlord_address: landlordAddress, purchase_price: Number(purchasePrice), 
        current_value: Number(currentValue), mortgage_balance: Number(mortgageBalance), interest_rate: Number(interestRate)
      }).eq('id', propertyId)
      alert("Property details saved!")
    } catch (error: any) { alert("Error saving: " + error.message) } finally { setIsSaving(false) }
  }

  async function addSpace(e: any) {
    e.preventDefault()
    try {
      await supabase.from('spaces').insert([{ property_id: propertyId, name: newSpaceName, square_footage: Number(newSpaceSqft), space_type: newSpaceType }])
      setNewSpaceName(''); setNewSpaceSqft(''); setNewSpaceType('physical')
      fetchPropertyData()
    } catch (error: any) { alert("Error adding space: " + error.message) }
  }

  async function deleteSpace(id: string) {
    if (!confirm("Delete this unit?")) return
    await supabase.from('spaces').delete().eq('id', id)
    fetchPropertyData()
  }

  if (!property) return <div className="p-8 text-gray-500">Loading Property...</div>

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <div>
          <a href="/properties" className="text-sm text-blue-600 hover:underline mb-1 inline-block">← Back to Portfolio</a>
          <h2 className="text-2xl font-bold text-gray-800">{property.name}</h2>
        </div>
        <button onClick={savePropertyDetails} disabled={isSaving} className={`px-6 py-2 rounded-md font-bold text-white transition ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>Save Changes</button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Physical Details</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label><input type="text" className="w-full border p-2 rounded outline-none" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><input type="text" className="w-full border p-2 rounded outline-none" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Total Square Footage</label><input type="number" className="w-full border p-2 rounded outline-none" value={sqft} onChange={(e) => setSqft(e.target.value)} /></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Legal & Landlord Entity</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Landlord Entity Name</label><input type="text" className="w-full border p-2 rounded outline-none" value={landlordName} onChange={(e) => setLandlordName(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Official Notice Email</label><input type="email" className="w-full border p-2 rounded outline-none" value={landlordEmail} onChange={(e) => setLandlordEmail(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Official Notice Phone</label><input type="text" className="w-full border p-2 rounded outline-none" value={landlordPhone} onChange={(e) => setLandlordPhone(e.target.value)} /></div>
            </div>
          </div>

        </div>

        {/* NEW: SPACES MANAGER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Spaces & Units Manager</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="md:col-span-2">
              <table className="min-w-full divide-y divide-gray-200 border rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit / Space Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SqFt</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {spaces.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-bold text-blue-600">{s.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-500 capitalize">{s.space_type}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{s.square_footage} sqft</td>
                      <td className="px-4 py-2 text-right"><button onClick={() => deleteSpace(s.id)} className="text-red-500 text-xs hover:underline">Delete</button></td>
                    </tr>
                  ))}
                  {spaces.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-500">No spaces added yet.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="font-bold text-sm text-gray-800 mb-3">Add New Space</h4>
              <form onSubmit={addSpace} className="space-y-3">
                <input type="text" required placeholder="e.g., Suite 100, ATM" className="w-full border p-2 rounded text-sm outline-none" value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)} />
                <input type="number" required placeholder="Square Footage" className="w-full border p-2 rounded text-sm outline-none" value={newSpaceSqft} onChange={(e) => setNewSpaceSqft(e.target.value)} />
                <select className="w-full border p-2 rounded text-sm outline-none" value={newSpaceType} onChange={(e) => setNewSpaceType(e.target.value)}>
                  <option value="physical">Physical Unit (Suite)</option>
                  <option value="virtual">Virtual Unit (ATM, Parking)</option>
                </select>
                <button type="submit" className="w-full bg-gray-800 hover:bg-black text-white py-2 rounded font-bold text-sm transition">Add Space</button>
              </form>
            </div>

          </div>
        </div>

      </main>
    </>
  )
}