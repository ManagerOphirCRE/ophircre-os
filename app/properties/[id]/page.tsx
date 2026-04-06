"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'
import { useParams } from 'next/navigation'

export default function PropertyProfilePage() {
  const params = useParams()
  const propertyId = params.id

  const [property, setProperty] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Basic State
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const[sqft, setSqft] = useState('')
  const [landlordName, setLandlordName] = useState('')
  const [landlordEmail, setLandlordEmail] = useState('')
  const[landlordPhone, setLandlordPhone] = useState('')
  const [landlordAddress, setLandlordAddress] = useState('')

  // NEW: SREO State
  const [purchasePrice, setPurchasePrice] = useState('')
  const[currentValue, setCurrentValue] = useState('')
  const [mortgageBalance, setMortgageBalance] = useState('')
  const [interestRate, setInterestRate] = useState('')

  useEffect(() => {
    async function fetchProperty() {
      const { data } = await supabase.from('properties').select('*').eq('id', propertyId).single()
      if (data) {
        setProperty(data)
        setName(data.name || '')
        setAddress(data.address || '')
        setSqft(data.total_sqft || '')
        setLandlordName(data.landlord_entity_name || '')
        setLandlordEmail(data.landlord_email || '')
        setLandlordPhone(data.landlord_phone || '')
        setLandlordAddress(data.landlord_address || '')
        
        // Load SREO Data
        setPurchasePrice(data.purchase_price || '')
        setCurrentValue(data.current_value || '')
        setMortgageBalance(data.mortgage_balance || '')
        setInterestRate(data.interest_rate || '')
      }
    }
    fetchProperty()
  }, [propertyId])

  async function savePropertyDetails() {
    setIsSaving(true)
    try {
      const { error } = await supabase.from('properties').update({
        name, address, total_sqft: Number(sqft),
        landlord_entity_name: landlordName, landlord_email: landlordEmail,
        landlord_phone: landlordPhone, landlord_address: landlordAddress,
        purchase_price: Number(purchasePrice), current_value: Number(currentValue),
        mortgage_balance: Number(mortgageBalance), interest_rate: Number(interestRate)
      }).eq('id', propertyId)

      if (error) throw error
      alert("Property details and SREO valuations saved successfully!")
    } catch (error: any) {
      alert("Error saving: " + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!property) return <div className="p-8 text-gray-500">Loading Property...</div>

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <div>
          <a href="/properties" className="text-sm text-blue-600 hover:underline mb-1 inline-block">← Back to Portfolio</a>
          <h2 className="text-2xl font-bold text-gray-800">{property.name}</h2>
        </div>
        <button onClick={savePropertyDetails} disabled={isSaving} className={`px-6 py-2 rounded-md font-bold text-white transition shadow-sm ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex space-x-6 bg-gray-100">
        
        {/* LEFT COLUMN */}
        <div className="w-1/2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Physical Details</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label><input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Address</label><input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Total Square Footage</label><input type="number" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={sqft} onChange={(e) => setSqft(e.target.value)} /></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Legal & Landlord Entity</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Landlord Entity Name</label><input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={landlordName} onChange={(e) => setLandlordName(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Official Notice Email</label><input type="email" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={landlordEmail} onChange={(e) => setLandlordEmail(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Official Notice Phone</label><input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={landlordPhone} onChange={(e) => setLandlordPhone(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Official Mailing Address</label><textarea className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none" value={landlordAddress} onChange={(e) => setLandlordAddress(e.target.value)} /></div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SREO Financials */}
        <div className="w-1/2 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
          <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Financials & Valuation (SREO)</h3>
          <p className="text-sm text-gray-500 mb-6">Update these figures periodically. They are used to generate your Schedule of Real Estate Owned for lenders.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price ($)</label>
              <input type="number" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 font-medium" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Estimated Value ($)</label>
              <input type="number" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 font-bold text-green-700" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mortgage Balance ($)</label>
                <input type="number" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 font-bold text-red-600" value={mortgageBalance} onChange={(e) => setMortgageBalance(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label>
                <input type="number" step="0.01" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
              </div>
            </div>
            
            <div className="pt-4 border-t mt-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800">Estimated Equity:</span>
                <span className="text-xl font-black text-blue-600">
                  ${(Number(currentValue) - Number(mortgageBalance)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

      </main>
    </>
  )
}