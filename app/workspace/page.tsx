"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function WorkspacePage() {
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const[isConnecting, setIsConnecting] = useState(false);
  
  // Google Data State
  const[emails, setEmails] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTask, setNewTask] = useState('');

  useEffect(
    function checkGoogleConnection() {
      // In Phase 5, we will check the database to see if your Google Token is saved.
      // For now, we wait for the user to click Connect.
    }
    ,[]
  );

  async function connectGoogle() {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/google-auth');
      const data = await res.json();
      
      if (data.url) {
        // Redirects you to the official Google Login screen
        window.location.href = data.url;
      } else {
        // If API keys aren't in Vercel yet, we enter Simulation Mode so you can see the UI!
        alert("Google Client ID missing from Vercel. Entering UI Simulation Mode!");
        setIsGoogleConnected(true);
        setEmails([
          { id: 1, from: 'Starbucks Legal <legal@starbucks.com>', subject: 'Lease Renewal Addendum', snippet: 'Please see the attached redlines for the upcoming renewal...', date: '10:42 AM' },
          { id: 2, from: 'City Water Dept <billing@city.gov>', subject: 'New Utility Bill Available', snippet: 'Your statement for Property A is now available to view...', date: 'Yesterday' },
          { id: 3, from: 'Joe Plumber <joe@plumbing.com>', subject: 'Invoice #4092', snippet: 'Thanks for the business. The leak in Suite 100 is fixed.', date: 'Oct 12' }
        ]);
        setTasks([
          { id: 1, title: 'Review Starbucks Redlines', status: 'needsAction' },
          { id: 2, title: 'Pay City Water Bill', status: 'needsAction' },
          { id: 3, title: 'Call roofer for inspection', status: 'completed' }
        ]);
      }
    } catch (error: any) {
      alert("Error connecting to Google: " + error.message);
    } finally {
      setIsConnecting(false);
    }
  }

  function handleAddTask(e: any) {
    e.preventDefault();
    if (!newTask) return;
    setTasks([{ id: Math.random(), title: newTask, status: 'needsAction' }, ...tasks]);
    setNewTask('');
  }

  function toggleTask(id: number) {
    setTasks(tasks.map(t => {
      if (t.id === id) return { ...t, status: t.status === 'completed' ? 'needsAction' : 'completed' };
      return t;
    }));
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Google Workspace Sync</h2>
        {!isGoogleConnected && (
          <button onClick={connectGoogle} disabled={isConnecting} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm flex items-center">
            <span className="mr-2 bg-white text-blue-600 rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs">G</span>
            {isConnecting ? 'Connecting...' : 'Connect Google Account'}
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        
        {!isGoogleConnected ? (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center max-w-2xl mx-auto mt-10">
            <div className="text-5xl mb-4">📧</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Connect Your Workspace</h3>
            <p className="text-gray-500 mb-6">Link your Google account to read your Gmail inbox and manage your Google Tasks directly inside the OphirCRE Operating System.</p>
            <button onClick={connectGoogle} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition shadow-sm text-lg">
              Authenticate with Google
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            
            {/* LEFT COLUMN: GMAIL INBOX */}
            <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-150px)]">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center rounded-t-xl">
                <h3 className="font-bold text-gray-800 flex items-center"><span className="mr-2">📧</span> Gmail Inbox (Unread)</h3>
                <button className="text-xs font-bold text-blue-600 hover:underline">Compose Email</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {emails.map((email) => (
                  <div key={email.id} className="p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-gray-900 text-sm">{email.from}</span>
                      <span className="text-xs text-gray-500 font-medium">{email.date}</span>
                    </div>
                    <span className="font-semibold text-gray-800 text-sm mb-1">{email.subject}</span>
                    <span className="text-sm text-gray-500 truncate">{email.snippet}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT COLUMN: GOOGLE TASKS */}
            <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-150px)]">
              <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                <h3 className="font-bold text-gray-800 flex items-center"><span className="mr-2">✅</span> Google Tasks</h3>
              </div>
              
              <div className="p-4 border-b border-gray-100">
                <form onSubmit={handleAddTask} className="flex">
                  <input type="text" placeholder="Add a new task..." className="flex-1 border border-gray-300 rounded-l-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newTask} onChange={(e) => setNewTask(e.target.value)} />
                  <button type="submit" className="bg-blue-600 text-white px-3 rounded-r-lg text-sm font-bold">+</button>
                </form>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center p-2 hover:bg-gray-50 rounded group">
                    <input 
                      type="checkbox" 
                      checked={task.status === 'completed'} 
                      onChange={() => toggleTask(task.id)}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer mr-3" 
                    />
                    <span className={`text-sm font-medium ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {task.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </main>
    </>
  );
}