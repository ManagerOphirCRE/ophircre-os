"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function Dashboard() {
  const[stats, setStats] = useState({ props: 0, tenants: 0, tasks: 0 })
  const[recentTasks, setRecentTasks] = useState<any[]>([])
  const [recentTxns, setRecentTxns] = useState<any[]>([])
  
  // Survey State
  const [surveys, setSurveys] = useState<any[]>([])
  const[avgRating, setAvgRating] = useState(0)

  useEffect(() => {
    async function loadDashboard() {
      // 1. Load Top Stats
      const { count: pCount } = await supabase.from('properties').select('*', { count: 'exact', head: true })
      const { count: tCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true })
      const { count: tkCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'Done')
      setStats({ props: pCount || 0, tenants: tCount || 0, tasks: tkCount || 0 })

      // 2. Load Recent Tasks
      const { data: tasks } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(5)
      if (tasks) setRecentTasks(tasks)

      // 3. Load Recent Transactions
      const { data: txns } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(5)
      if (txns) setRecentTxns(txns)

      // 4. Load Tenant Surveys
      const { data: srvs } = await supabase.from('tenant_surveys').select('*, tenants(name)').order('created_at', { ascending: false }).limit(5)
      if (srvs && srvs.length > 0) {
        setSurveys(srvs)
        const total = srvs.reduce((sum, s) => sum + s.rating, 0)
        setAvgRating(total / srvs.length)
      }
    }
    loadDashboard()
  },[])

  return (
    <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
      
      {/* TOP STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-gray-500 text-sm font-medium">Total Properties</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{stats.props}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-gray-500 text-sm font-medium">Active Tenants</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{stats.tenants}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-gray-500 text-sm font-medium">Open Tasks</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">{stats.tasks}</p>
        </div>
      </div>

      {/* MIDDLE ROW: Tasks & Financials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Recent Tasks</h3>
          <div className="space-y-3">
            {recentTasks.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="font-medium text-sm text-gray-800">{t.title}</span>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">{t.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Recent Financials</h3>
          <div className="space-y-3">
            {recentTxns.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="font-medium text-sm text-gray-800">{t.description}</span>
                <span className="text-sm font-bold text-gray-900">${t.total_amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Tenant Satisfaction */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-lg font-semibold text-gray-800">Tenant Satisfaction</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Average Rating:</span>
            <span className="font-bold text-lg text-yellow-500">⭐ {avgRating.toFixed(1)} / 5.0</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {surveys.map(s => (
            <div key={s.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex justify-between mb-2">
                <span className="font-bold text-sm text-gray-900">{s.tenants?.name}</span>
                <span className="text-yellow-500 text-sm">{'⭐'.repeat(s.rating)}</span>
              </div>
              <p className="text-sm text-gray-600 italic">"{s.feedback || 'No written feedback provided.'}"</p>
              <p className="text-xs text-gray-400 mt-2">{new Date(s.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>

    </main>
  )
}