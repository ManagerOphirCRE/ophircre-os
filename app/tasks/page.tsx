"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const[newTaskTitle, setNewTaskTitle] = useState('')
  const [selectedTask, setSelectedTask] = useState<any>(null)

  useEffect(() => { fetchTasks() },[])

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('*, tenants(name), properties(name)').order('created_at', { ascending: false })
    if (data) setTasks(data)
  }

  async function addTask() {
    if (!newTaskTitle) return
    await supabase.from('tasks').insert([{ title: newTaskTitle, status: 'To Do' }])
    setNewTaskTitle(''); fetchTasks()
  }

  async function moveTask(id: string, newStatus: string) {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', id)
    fetchTasks(); setSelectedTask(null)
  }

  async function deleteTask(id: string) {
    if(!confirm("Are you sure you want to delete this task?")) return
    await supabase.from('tasks').delete().eq('id', id)
    fetchTasks(); setSelectedTask(null)
  }

  // Group tasks by status (Treating 'New' from the portals as 'To Do')
  const todoTasks = tasks.filter(t => t.status === 'To Do' || t.status === 'New')
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress')
  const doneTasks = tasks.filter(t => t.status === 'Done')

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Task Board</h2>
        <div className="flex space-x-2">
          <input type="text" placeholder="Quick add task..." className="border p-2 rounded-md text-sm w-64 outline-none focus:ring-2 focus:ring-blue-500" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} />
          <button onClick={addTask} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">Add</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
          
          {/* TO DO COLUMN */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-bold text-gray-700 mb-4">To Do ({todoTasks.length})</h3>
            <div className="space-y-3">
              {todoTasks.map(task => (
                <div key={task.id} onClick={() => setSelectedTask(task)} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:border-blue-500 transition">
                  <p className="font-medium text-gray-800">{task.title}</p>
                  {task.tenants && <p className="text-xs text-blue-600 mt-1 font-bold">{task.tenants.name}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* IN PROGRESS COLUMN */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-4">In Progress ({inProgressTasks.length})</h3>
            <div className="space-y-3">
              {inProgressTasks.map(task => (
                <div key={task.id} onClick={() => setSelectedTask(task)} className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 cursor-pointer hover:border-blue-500 transition">
                  <p className="font-medium text-gray-800">{task.title}</p>
                  {task.tenants && <p className="text-xs text-blue-600 mt-1 font-bold">{task.tenants.name}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* DONE COLUMN */}
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <h3 className="font-bold text-green-800 mb-4">Done ({doneTasks.length})</h3>
            <div className="space-y-3">
              {doneTasks.map(task => (
                <div key={task.id} onClick={() => setSelectedTask(task)} className="bg-white p-4 rounded-lg shadow-sm border border-green-200 opacity-60 cursor-pointer hover:opacity-100 transition">
                  <p className="font-medium text-gray-800 line-through">{task.title}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* TASK DETAILS MODAL */}
        {selectedTask && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg w-[600px] max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-start mb-4 border-b pb-4">
                <h3 className="text-xl font-bold text-gray-800 pr-4">{selectedTask.title}</h3>
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap">{selectedTask.status}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto mb-6 space-y-4 text-sm">
                {selectedTask.tenants && <p><strong className="text-gray-700">Linked Tenant:</strong> <span className="text-blue-600 font-bold">{selectedTask.tenants.name}</span></p>}
                {selectedTask.properties && <p><strong className="text-gray-700">Linked Property:</strong> {selectedTask.properties.name}</p>}
                <div>
                  <strong className="text-gray-700">Description / Notes:</strong>
                  <p className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                    {selectedTask.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              <div className="flex justify-between border-t pt-4 items-center">
                <button onClick={() => deleteTask(selectedTask.id)} className="text-red-500 text-sm font-bold hover:underline">Delete Task</button>
                <div className="space-x-2">
                  <button onClick={() => setSelectedTask(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md font-medium text-sm transition">Close</button>
                  {selectedTask.status !== 'In Progress' && <button onClick={() => moveTask(selectedTask.id, 'In Progress')} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md font-bold text-sm hover:bg-blue-200 transition">Start Work</button>}
                  {selectedTask.status !== 'Done' && <button onClick={() => moveTask(selectedTask.id, 'Done')} className="px-4 py-2 bg-green-600 text-white rounded-md font-bold text-sm hover:bg-green-700 transition">Mark Done ✓</button>}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}