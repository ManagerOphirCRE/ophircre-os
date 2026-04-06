"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function LeasingPipelinePage() {
  const[prospects, setProspects] = useState<any[]>([])

  useEffect(() => { fetchProspects() },[])

  async function fetchProspects() {
    const { data } = await supabase.from('tenants').select('*').ilike('status', 'prospect_%').order('created_at', { ascending: false })
    if (data) setProspects(data)
  }

  async function moveProspect(id: string, newStatus: string) {
    await supabase.from('tenants').update({ status: newStatus }).eq('id', id)
    fetchProspects()
  }

  const newApps = prospects.filter(p => p.status === 'prospect_new')
  const reviewing = prospects.filter(p => p.status === 'prospect_review')
  const negotiating = prospects.filter(p => p.status === 'prospect_negotiation')

  return (
    <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
      <header className="mb-8 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Leasing Pipeline</h2>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
        
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h3 className="font-bold text-gray-700 mb-4">New Applications ({newApps.length})</h3>
          <div className="space-y-3">
            {newApps.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <p className="font-bold text-blue-600">{p.name}</p>
                <p className="text-xs text-gray-500 mb-3">{p.entity_type} | {p.contact_phone}</p>
                <button onClick={() => moveProspect(p.id, 'prospect_review')} className="text-xs text-blue-600 font-bold">Move to Review →</button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <h3 className="font-bold text-blue-800 mb-4">Under Review ({reviewing.length})</h3>
          <div className="space-y-3">
            {reviewing.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                <p className="font-bold text-blue-600">{p.name}</p>
                <div className="flex justify-between mt-3">
                  <button onClick={() => moveProspect(p.id, 'prospect_new')} className="text-xs text-gray-500">← Back</button>
                  <button onClick={() => moveProspect(p.id, 'prospect_negotiation')} className="text-xs text-blue-600 font-bold">Negotiate →</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
          <h3 className="font-bold text-purple-800 mb-4">Negotiation ({negotiating.length})</h3>
          <div className="space-y-3">
            {negotiating.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-lg shadow-sm border border-purple-200">
                <p className="font-bold text-blue-600">{p.name}</p>
                <div className="flex justify-between mt-3">
                  <button onClick={() => moveProspect(p.id, 'prospect_review')} className="text-xs text-gray-500">← Back</button>
                  <button onClick={() => moveProspect(p.id, 'active')} className="text-xs text-green-600 font-bold">Approve (Make Active) ✓</button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  )
}