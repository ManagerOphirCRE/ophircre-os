"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('pnl') // 'pnl' or 'sreo'
  const [properties, setProperties] = useState<any[]>([])
  
  // P&L State
  const [selectedPropertyId, setSelectedPropertyId] = useState('ALL')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [revenue, setRevenue] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [totalRev, setTotalRev] = useState(0)
  const [totalExp, setTotalExp] = useState(0)

  useEffect(() => {
    fetchProperties()
  },[])

  useEffect(() => {
    if (activeTab === 'pnl') generatePnL()
  }, [selectedPropertyId, year, activeTab])

  async function fetchProperties() {
    const { data } = await supabase.from('properties').select('*').order('name')
    if (data) setProperties(data)
  }

  async function generatePnL() {
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    let query = supabase
      .from('journal_entries')
      .select('debit, credit, chart_of_accounts(name, account_type), transactions(date)')
      .gte('transactions.date', startDate)
      .lte('transactions.date', endDate)

    if (selectedPropertyId !== 'ALL') {
      query = query.eq('property_id', selectedPropertyId)
    }

    const { data } = await query

    if (data) {
      // Group by Account Name
      const revMap: Record<string, number> = {}
      const expMap: Record<string, number> = {}

      data.forEach((entry: any) => {
        const accName = Array.isArray(entry.chart_of_accounts) ? entry.chart_of_accounts[0]?.name : entry.chart_of_accounts?.name
        const accType = Array.isArray(entry.chart_of_accounts) ? entry.chart_of_accounts[0]?.account_type : entry.chart_of_accounts?.account_type
        
        // In our simple ledger, Revenue is usually recorded as a Credit (or positive Debit depending on how you entered it). 
        // We will use absolute values here to ensure the P&L reads cleanly for the user.
        const amount = Math.abs(Number(entry.debit) || Number(entry.credit))

        if (accType?.toLowerCase() === 'revenue') {
          revMap[accName] = (revMap[accName] || 0) + amount
        } else if (accType?.toLowerCase() === 'expense') {
          expMap[accName] = (expMap[accName] || 0) + amount
        }
      })

      const revArray = Object.keys(revMap).map(k => ({ name: k, amount: revMap[k] }))
      const expArray = Object.keys(expMap).map(k => ({ name: k, amount: expMap[k] }))

      setRevenue(revArray)
      setExpenses(expArray)
      setTotalRev(revArray.reduce((sum, item) => sum + item.amount, 0))
      setTotalExp(expArray.reduce((sum, item) => sum + item.amount, 0))
    }
  }

  // SREO Calculations
  const portfolioValue = properties.reduce((sum, p) => sum + Number(p.current_value || 0), 0)
  const portfolioDebt = properties.reduce((sum, p) => sum + Number(p.mortgage_balance || 0), 0)
  const portfolioEquity = portfolioValue - portfolioDebt

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Financial Reporting</h2>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setActiveTab('pnl')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'pnl' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Profit & Loss</button>
          <button onClick={() => setActiveTab('sreo')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'sreo' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>SREO</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        
        {/* P&L TAB */}
        {activeTab === 'pnl' && (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-end mb-6 print:hidden">
              <div className="flex space-x-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property</label>
                  <select className="border p-2 rounded outline-none w-64" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}>
                    <option value="ALL">Entire Portfolio (Consolidated)</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
                  <input type="number" className="border p-2 rounded outline-none w-32" value={year} onChange={(e) => setYear(e.target.value)} />
                </div>
              </div>
              <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
                🖨️ Print to PDF
              </button>
            </div>

            <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none">
              <div className="text-center mb-10 border-b pb-6">
                <h1 className="text-3xl font-serif font-bold text-gray-900">OphirCRE</h1>
                <h2 className="text-xl font-serif text-gray-600 mt-1">Profit & Loss Statement</h2>
                <p className="text-sm text-gray-500 mt-2">
                  {selectedPropertyId === 'ALL' ? 'Consolidated Portfolio' : properties.find(p => p.id === selectedPropertyId)?.name} <br/>
                  For the Year Ending Dec 31, {year}
                </p>
              </div>

              {/* REVENUE SECTION */}
              <div className="mb-8">
                <h3 className="font-bold text-lg text-gray-800 border-b border-gray-300 pb-1 mb-3">Operating Revenue</h3>
                {revenue.length > 0 ? revenue.map((item, i) => (
                  <div key={i} className="flex justify-between py-1 text-gray-700">
                    <span>{item.name}</span>
                    <span>${item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                )) : <p className="text-sm text-gray-400 italic py-2">No revenue recorded.</p>}
                <div className="flex justify-between py-2 mt-2 font-bold text-gray-900 bg-gray-50 px-2 rounded">
                  <span>Total Operating Revenue</span>
                  <span>${totalRev.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              </div>

              {/* EXPENSE SECTION */}
              <div className="mb-8">
                <h3 className="font-bold text-lg text-gray-800 border-b border-gray-300 pb-1 mb-3">Operating Expenses</h3>
                {expenses.length > 0 ? expenses.map((item, i) => (
                  <div key={i} className="flex justify-between py-1 text-gray-700">
                    <span>{item.name}</span>
                    <span>${item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                )) : <p className="text-sm text-gray-400 italic py-2">No expenses recorded.</p>}
                <div className="flex justify-between py-2 mt-2 font-bold text-gray-900 bg-gray-50 px-2 rounded border-b border-gray-300">
                  <span>Total Operating Expenses</span>
                  <span>${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>
              </div>

              {/* NOI SECTION */}
              <div className="flex justify-between py-4 mt-6 font-black text-xl text-gray-900 border-t-4 border-double border-gray-800">
                <span>Net Operating Income (NOI)</span>
                <span className={totalRev - totalExp >= 0 ? 'text-green-700' : 'text-red-600'}>
                  ${(totalRev - totalExp).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SREO TAB */}
        {activeTab === 'sreo' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6 print:hidden">
              <p className="text-gray-600">Schedule of Real Estate Owned (SREO) required for lender underwriting.</p>
              <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
                🖨️ Print SREO
              </button>
            </div>

            {/* Portfolio Summary Cards */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total Est. Value</p>
                <p className="text-3xl font-black text-gray-900 mt-2">${portfolioValue.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total Debt</p>
                <p className="text-3xl font-black text-red-600 mt-2">${portfolioDebt.toLocaleString()}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total Equity</p>
                <p className="text-3xl font-black text-green-600 mt-2">${portfolioEquity.toLocaleString()}</p>
              </div>
            </div>

            {/* SREO Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase">Property Name</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase">SqFt</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase">Purchase Price</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase">Current Value</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase">Mortgage Bal.</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase">Equity</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {properties.map(p => {
                    const equity = Number(p.current_value || 0) - Number(p.mortgage_balance || 0)
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-bold text-blue-600">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{Number(p.total_sqft || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">${Number(p.purchase_price || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">${Number(p.current_value || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">${Number(p.mortgage_balance || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-green-600">${equity.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="p-4 bg-gray-50 text-xs text-gray-500 border-t">
                * To update valuations and mortgage balances, click on a property in the main "Properties" tab and edit its profile.
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  )
}