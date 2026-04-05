"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')

  useEffect(() => {
    fetchTasks()
  }, [])

  async function fetchTasks() {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false })
    if (data) setTasks(data)
  }

  async function addTask() {
    if (!newTaskTitle) return
    await supabase.from('tasks').insert([{ title: newTaskTitle, status: 'To Do' }])
    setNewTaskTitle('')
    fetchTasks()
  }

  async function moveTask(id: string, newStatus: string) {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', id)
    fetchTasks()
  }

  // Filter tasks into columns
  const todoTasks = tasks.filter(t => t.status === 'To Do')
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress')
  const doneTasks = tasks.filter(t => t.status === 'Done')

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Task Board</h2>
        <div className="flex space-x-2">
          <input 
            type="text" placeholder="Quick add task..." className="border p-2 rounded-md text-sm w-64"
            value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
          />
          <button onClick={addTask} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
            Add
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
          
          {/* TO DO COLUMN */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-bold text-gray-700 mb-4">To Do ({todoTasks.length})</h3>
            <div className="space-y-3">
              {todoTasks.map(task => (
                <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <p className="font-medium text-gray-800">{task.title}</p>
                  <button onClick={() => moveTask(task.id, 'In Progress')} className="mt-3 text-xs text-blue-600 font-semibold hover:underline">
                    Move to In Progress →
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* IN PROGRESS COLUMN */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-4">In Progress ({inProgressTasks.length})</h3>
            <div className="space-y-3">
              {inProgressTasks.map(task => (
                <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-blue-200">
                  <p className="font-medium text-gray-800">{task.title}</p>
                  <div className="flex justify-between mt-3">
                    <button onClick={() => moveTask(task.id, 'To Do')} className="text-xs text-gray-500 hover:underline">← Back</button>
                    <button onClick={() => moveTask(task.id, 'Done')} className="text-xs text-green-600 font-semibold hover:underline">Complete ✓</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DONE COLUMN */}
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <h3 className="font-bold text-green-800 mb-4">Done ({doneTasks.length})</h3>
            <div className="space-y-3">
              {doneTasks.map(task => (
                <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-green-200 opacity-60">
                  <p className="font-medium text-gray-800 line-through">{task.title}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  )
}