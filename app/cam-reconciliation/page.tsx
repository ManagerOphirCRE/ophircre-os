"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function CAMPage() {
  const [properties, setProperties] = useState<any[]>([])
  const[selectedProperty, setSelectedProperty] = useState<any>(null)
  const [year, setYear] = useState(new Date().getFullYear().toString())
  
  const [expenses, setExpenses] = useState(0)
  const[reconciliations, setReconciliations] = useState<any[]>([])
  const [isCalculating, setIsCalculating] = useState(false)

  useEffect(() => {
    async function fetchProps() {
      const { data } = await supabase.from('properties').select('*').order('name')
      if (data) setProperties(data)
    }
    fetchProps()
  },[])

  async function generateCAM() {
    if (!selectedProperty) return alert("Select a property first.")
    setIsCalculating(true)

    try {
      // 1. Get total expenses for the property for the selected year
      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`
      
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('debit, chart_of_accounts(account_type), transactions(date)')
        .eq('property_id', selectedProperty.id)
        .eq('chart_of_accounts.account_type', 'Expense')
        .gte('transactions.date', startDate)
        .lte('transactions.date', endDate)

      const totalExpenses = journalEntries?.reduce((sum, entry) => sum + Number(entry.debit), 0) || 0
      setExpenses(totalExpenses)

      // 2. Get all leases and spaces for this property to calculate Pro-Rata Share
      const { data: spaces } = await supabase.from('spaces').select('*, leases(*, tenants(name))').eq('property_id', selectedProperty.id)
      
      const recs =[]
      if (spaces) {
        for (const space of spaces) {
          if (space.leases && space.leases.length > 0) {
            const lease = space.leases[0] // Assuming 1 active lease per space for this calculation
            
            // Pro-Rata Math: (Space SqFt / Total Property SqFt)
            const proRataPercent = (Number(space.square_footage) / Number(selectedProperty.total_sqft))
            const tenantShareOfExpenses = totalExpenses * proRataPercent
            
            // What they actually paid (Monthly CAM Charge * 12)
            const totalPaid = Number(lease.cam_charge || 0) * 12
            const balanceDue = tenantShareOfExpenses - totalPaid

            recs.push({
              tenantName: lease.tenants?.name,
              spaceName: space.name,
              sqft: space.square_footage,
              proRata: (proRataPercent * 100).toFixed(2),
              shareOfExpenses: tenantShareOfExpenses,
              amountPaid: totalPaid,
              balanceDue: balanceDue
            })
          }
        }
      }
      setReconciliations(recs)
    } catch (error: any) {
      alert("Error calculating CAM: " + error.message)
    } finally {
      setIsCalculating(false)
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Year-End CAM Reconciliations</h2>
        <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">🖨️ Print Statements</button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex space-x-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Property</label>
            <select className="w-full border p-2 rounded outline-none" onChange={(e) => setSelectedProperty(properties.find(p => p.id === e.target.value))}>
              <option value="">-- Choose Property --</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
            <input type="number" className="w-32 border p-2 rounded outline-none" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <button onClick={generateCAM} disabled={isCalculating} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-bold transition h-[42px]">
            {isCalculating ? 'Calculating...' : 'Generate Statements'}
          </button>
        </div>

        {reconciliations.length > 0 && (
          <div className="space-y-8">
            <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl text-center">
              <h3 className="text-blue-800 font-bold text-lg">Total Property Expenses ({year})</h3>
              <p className="text-4xl font-black text-blue-900 mt-2">${expenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              <p className="text-sm text-blue-700 mt-1">Based on {selectedProperty?.total_sqft} Total Leasable Square Feet</p>
            </div>

            {reconciliations.map((rec, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <div className="flex justify-between border-b pb-4 mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{rec.tenantName}</h3>
                    <p className="text-gray-500">{selectedProperty?.name} - {rec.spaceName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">{year} CAM Reconciliation</p>
                    <p className="text-sm text-gray-500">Pro-Rata Share: {rec.proRata}% ({rec.sqft} sqft)</p>
                  </div>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-gray-700"><span>Tenant's Share of Actual Expenses:</span> <span>${rec.shareOfExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                  <div className="flex justify-between text-gray-700"><span>Less: Estimated CAM Payments Made:</span> <span className="text-red-600">- ${rec.amountPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                </div>

                <div className={`p-4 rounded-lg flex justify-between items-center font-bold text-lg ${rec.balanceDue > 0 ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                  <span>{rec.balanceDue > 0 ? 'Balance Due to Landlord:' : 'Credit Due to Tenant:'}</span>
                  <span>${Math.abs(rec.balanceDue).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}