import { supabase } from '@/app/utils/supabase'

export const revalidate = 0;

export default async function Dashboard() {
  const { count: propertyCount } = await supabase.from('properties').select('*', { count: 'exact', head: true })
  const { count: tenantCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true })
  const { count: taskCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true })

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Command Center</h2>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          + New Task
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-gray-500 text-sm font-medium">Total Properties</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">{propertyCount || 0}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-gray-500 text-sm font-medium">Active Tenants</h3>
            <p className="text-3xl font-bold text-gray-800 mt-2">{tenantCount || 0}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-gray-500 text-sm font-medium">Open Tasks</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">{taskCount || 0}</p>
          </div>
        </div>
      </main>
    </>
  )
}