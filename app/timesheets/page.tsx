"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function TimesheetsPage() {
  const [shifts, setShifts] = useState<any[]>([])
  const [properties, setProperties] = useState<any[]>([])
  
  // Clock In State
  const[staffName, setStaffName] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const[hourlyRate, setHourlyRate] = useState('')
  const [isClocking, setIsClocking] = useState(false)

  useEffect(() => {
    fetchData()
  },[])

  async function fetchData() {
    const { data: sData } = await supabase.from('timesheets').select('*, properties(name)').order('clock_in', { ascending: false })
    if (sData) setShifts(sData)
    const { data: pData } = await supabase.from('properties').select('*').order('name')
    if (pData) setProperties(pData)
  }

  async function handleClockIn(e: any) {
    e.preventDefault()
    setIsClocking(true)
    try {
      await supabase.from('timesheets').insert([{
        staff_name: staffName,
        property_id: propertyId || null,
        hourly_rate: Number(hourlyRate),
        clock_in: new Date().toISOString()
      }])
      alert("Clocked In Successfully!")
      setStaffName(''); setPropertyId(''); setHourlyRate('')
      fetchData()
    } catch (error: any) { alert("Error: " + error.message) } finally { setIsClocking(false) }
  }

  async function handleClockOut(id: string) {
    const notes = prompt("Enter any notes about what you worked on (Optional):")
    try {
      await supabase.from('timesheets').update({
        clock_out: new Date().toISOString(),
        notes: notes || ''
      }).eq('id', id)
      fetchData()
    } catch (error: any) { alert("Error: " + error.message) }
  }

  // Calculate Pay
  function calculatePay(clockIn: string, clockOut: string, rate: number) {
    if (!clockOut) return 0
    const hours = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / (1000 * 60 * 60)
    return hours * rate
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Staff Time Tracking & Payroll</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0 bg-gray-100">
        
        {/* LEFT COLUMN: Clock In Form */}
        <div className="w-full md:w-1/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
          <h3 className="font-bold text-gray-800 mb-4">Clock In</h3>
          <form onSubmit={handleClockIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Name *</label>
              <input type="text" required className="w-full border p-2 rounded outline-none" value={staffName} onChange={(e) => setStaffName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location / Property</label>
              <select className="w-full border p-2 rounded outline-none" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">-- General / Office --</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($)</label>
              <input type="number" required className="w-full border p-2 rounded outline-none" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
            </div>
            <button type="submit" disabled={isClocking} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-md font-bold mt-4 transition">
              ⏱️ Clock In Now
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Timesheet Log */}
        <div className="w-full md:w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200"><h3 className="font-bold text-gray-800">Recent Shifts</h3></div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Staff</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Time In/Out</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Est. Pay</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {shifts.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{s.staff_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.properties?.name || 'Office'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <span className="text-green-600 block">In: {new Date(s.clock_in).toLocaleString()}</span>
                    {s.clock_out ? <span className="text-red-600 block">Out: {new Date(s.clock_out).toLocaleString()}</span> : <span className="text-yellow-600 font-bold block">Currently Working</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                    ${calculatePay(s.clock_in, s.clock_out, s.hourly_rate).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!s.clock_out && <button onClick={() => handleClockOut(s.id)} className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">Clock Out</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </main>
    </>
  )
}