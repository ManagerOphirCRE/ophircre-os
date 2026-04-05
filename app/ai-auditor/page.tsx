"use client"
import { useState } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function AIAuditorPage() {
  const[anomalies, setAnomalies] = useState<any[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [lastScanDate, setLastScanDate] = useState<string | null>(null)
  const[debugLog, setDebugLog] = useState<string>('')

  async function runAudit() {
    setIsScanning(true)
    setAnomalies([])
    setDebugLog('Starting scan...')

    try {
      const { data: entries, error } = await supabase
        .from('journal_entries')
        .select(`
          debit,
          description,
          property_id,
          properties (name),
          chart_of_accounts (name, account_type),
          transactions (date)
        `)

      if (error) throw error
      if (!entries) {
        setDebugLog('No journal entries found in database at all.')
        return
      }

      // FIX: Added ': any' to completely bypass TypeScript's strict checking here
      const validEntries = entries.filter((e: any) => {
        // Handle both object and array returns from Supabase just to be hyper-safe
        const accType = Array.isArray(e.chart_of_accounts) ? e.chart_of_accounts[0]?.account_type : e.chart_of_accounts?.account_type
        const isExpense = accType?.toLowerCase() === 'expense'
        
        const propName = Array.isArray(e.properties) ? e.properties[0]?.name : e.properties?.name
        const txnDate = Array.isArray(e.transactions) ? e.transactions[0]?.date : e.transactions?.date
        
        return isExpense && !!propName && !!txnDate
      })

      setDebugLog(`Database has ${entries.length} total entries. Found ${validEntries.length} valid expense entries tied to a property.`)

      validEntries.sort((a: any, b: any) => {
        const dateA = Array.isArray(a.transactions) ? a.transactions[0].date : a.transactions.date
        const dateB = Array.isArray(b.transactions) ? b.transactions[0].date : b.transactions.date
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })

      const groups: Record<string, any[]> = {}
      validEntries.forEach((entry: any) => {
        const propName = Array.isArray(entry.properties) ? entry.properties[0].name : entry.properties.name
        const accName = Array.isArray(entry.chart_of_accounts) ? entry.chart_of_accounts[0].name : entry.chart_of_accounts.name
        const key = `${propName}_${accName}`
        if (!groups[key]) groups[key] = []
        groups[key].push(entry)
      })

      const detectedAnomalies: any[] =[]

      for (const key in groups) {
        const group = groups[key]
        if (group.length < 2) continue 

        const recentBill = group[0] 
        const olderBills = group.slice(1) 
        
        const totalOld = olderBills.reduce((sum: number, e: any) => sum + Number(e.debit), 0)
        const historicalAverage = totalOld / olderBills.length
        const threshold = historicalAverage * 1.20

        if (Number(recentBill.debit) > threshold) {
          const variancePercent = (((Number(recentBill.debit) - historicalAverage) / historicalAverage) * 100).toFixed(0)
          
          const propName = Array.isArray(recentBill.properties) ? recentBill.properties[0].name : recentBill.properties.name
          const accName = Array.isArray(recentBill.chart_of_accounts) ? recentBill.chart_of_accounts[0].name : recentBill.chart_of_accounts.name
          const txnDate = Array.isArray(recentBill.transactions) ? recentBill.transactions[0].date : recentBill.transactions.date

          detectedAnomalies.push({
            id: Math.random().toString(),
            property: propName,
            category: accName,
            date: txnDate,
            description: recentBill.description,
            amount: Number(recentBill.debit),
            average: historicalAverage,
            variance: variancePercent
          })
        }
      }

      setAnomalies(detectedAnomalies)
      setLastScanDate(new Date().toLocaleString())

    } catch (error: any) {
      alert("Audit Error: " + error.message)
    } finally {
      setIsScanning(false)
    }
  }

  async function createInvestigationTask(anomaly: any) {
    const { error } = await supabase.from('tasks').insert([{
      title: `INVESTIGATE: High ${anomaly.category} at ${anomaly.property}`,
      description: `AI Auditor flagged a $${anomaly.amount} bill on ${anomaly.date}. This is ${anomaly.variance}% higher than the historical average of $${anomaly.average.toFixed(2)}. Description: ${anomaly.description}`,
      status: 'To Do'
    }])

    if (error) alert("Error creating task: " + error.message)
    else alert("Task successfully added to your Kanban Board!")
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">AI Auditor & Anomaly Detection</h2>
        <button onClick={runAudit} disabled={isScanning} className={`px-4 py-2 rounded-md font-medium text-white transition shadow-sm ${isScanning ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
          {isScanning ? 'Scanning Ledger...' : '✨ Run Full Audit'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-800 mb-2">How this works</h3>
          <p className="text-sm text-gray-600">
            The AI Auditor scans your ledger, groups expenses by Property and Category, and calculates historical averages. If a recent bill is <strong>more than 20% higher</strong> than normal, it flags it here.
          </p>
          {lastScanDate && <p className="text-xs text-gray-400 mt-4">Last scan completed: {lastScanDate}</p>}
        </div>

        {anomalies.length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-bold text-red-600 text-lg flex items-center">⚠️ {anomalies.length} Anomalies Detected</h3>
            {anomalies.map((anomaly) => (
              <div key={anomaly.id} className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-l-red-500 border-y border-r border-gray-200 flex justify-between items-center">
                <div>
                  <div className="flex items-center space-x-3 mb-1">
                    <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">+{anomaly.variance}% Spike</span>
                    <h4 className="font-bold text-gray-900">{anomaly.property} - {anomaly.category}</h4>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">A bill for <strong>${anomaly.amount.toFixed(2)}</strong> was logged on {anomaly.date}. This is higher than the historical average of <strong>${anomaly.average.toFixed(2)}</strong>.</p>
                </div>
                <button onClick={() => createInvestigationTask(anomaly)} className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md font-medium transition shadow-sm ml-6">
                  Create Task
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Ledger is Clean</h3>
            <p className="text-gray-500">{lastScanDate ? "No expense anomalies detected." : "Click 'Run Full Audit' to scan your ledger."}</p>
          </div>
        )}

        {debugLog && (
          <div className="mt-8 p-4 bg-slate-800 text-green-400 font-mono text-xs rounded-lg">
            <strong>Diagnostic Log:</strong><br/>
            {debugLog}
          </div>
        )}
      </main>
    </>
  )
}