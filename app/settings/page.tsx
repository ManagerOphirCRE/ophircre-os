"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<any[]>([])

  useEffect(() => { fetchAccounts() },[])

  async function fetchAccounts() {
    const { data } = await supabase.from('chart_of_accounts').select('*').order('account_type', { ascending: true })
    if (data) setAccounts(data)
  }

  async function deleteAccount(id: string) {
    if (!confirm("Are you sure? This might break past transactions linked to this account.")) return
    await supabase.from('chart_of_accounts').delete().eq('id', id)
    fetchAccounts()
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4"><h2 className="text-xl font-semibold text-gray-800">Global Settings</h2></header>
      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-3xl">
          <h3 className="font-bold text-gray-800 mb-4">Chart of Accounts Manager</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {accounts.map(acc => (
                <tr key={acc.id}>
                  <td className="px-4 py-2 text-sm font-medium">{acc.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-500">{acc.account_type}</td>
                  <td className="px-4 py-2 text-right"><button onClick={() => deleteAccount(acc.id)} className="text-red-500 text-xs hover:underline">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  )
}