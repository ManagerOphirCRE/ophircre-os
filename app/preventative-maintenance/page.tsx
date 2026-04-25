"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useOrg } from '@/app/context/OrgContext';

export default function PreventativeMaintenancePage() {
  const { orgId } = useOrg();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const[isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [frequency, setFrequency] = useState('3'); // Default to Quarterly
  const [nextDueDate, setNextDueDate] = useState('');

  useEffect(() => {
    if (orgId) fetchData();
  }, [orgId]);

  async function fetchData() {
    const { data: sData } = await supabase.from('preventative_maintenance').select('*, properties(name)').order('next_due_date', { ascending: true });
    if (sData) setSchedules(sData);
    
    const { data: pData } = await supabase.from('properties').select('*').is('is_deleted', false).order('name');
    if (pData) setProperties(pData);
  }

  async function saveSchedule(e: any) {
    e.preventDefault();
    if (!propertyId) return alert("Please select a property.");
    setIsSaving(true);

    try {
      await supabase.from('preventative_maintenance').insert([{
        title,
        description,
        property_id: propertyId,
        frequency_months: Number(frequency),
        next_due_date: nextDueDate,
        organization_id: orgId
      }]);

      alert("Preventative Maintenance Schedule Created!");
      setIsModalOpen(false);
      setTitle(''); setDescription(''); setPropertyId(''); setFrequency('3'); setNextDueDate('');
      fetchData();
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSchedule(id: string) {
    if (!confirm("Delete this recurring schedule?")) return;
    await supabase.from('preventative_maintenance').delete().eq('id', id);
    fetchData();
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Preventative Maintenance</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          + Add Schedule
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <h3 className="font-bold text-gray-800">Recurring Work Orders</h3>
            <p className="text-sm text-gray-500 mt-1">The system will automatically generate a Task on the due date and calculate the next cycle.</p>
          </div>
          
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Task Title</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Property</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Frequency</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Next Due Date</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {schedules.map(s => {
                const isOverdue = new Date(s.next_due_date) < new Date();
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{s.title}</p>
                      <p className="text-xs text-gray-500 truncate max-w-xs">{s.description}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">{s.properties?.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">Every {s.frequency_months} Month(s)</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${isOverdue ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {s.next_due_date}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => deleteSchedule(s.id)} className="text-red-500 text-xs font-bold hover:underline">Delete</button>
                    </td>
                  </tr>
                )
              })}
              {schedules.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No recurring schedules set up.</td></tr>}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-6 text-gray-800">New Recurring Task</h3>
              <form onSubmit={saveSchedule} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Task Title</label>
                  <input type="text" required placeholder="e.g., Quarterly HVAC Filter Replacement" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Property</label>
                  <select required className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                    <option value="">-- Select Property --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Frequency</label>
                  <select className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                    <option value="1">Monthly</option>
                    <option value="3">Quarterly (Every 3 Months)</option>
                    <option value="6">Semi-Annually (Every 6 Months)</option>
                    <option value="12">Annually (Every 12 Months)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">First Due Date</label>
                  <input type="date" required className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Instructions / Notes</label>
                  <textarea placeholder="e.g., Use MERV 13 filters located in the utility closet." className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" disabled={isSaving} className={`px-6 py-2 rounded font-bold text-white transition ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>Save Schedule</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}