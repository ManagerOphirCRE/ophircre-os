"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function WorkspacePage() {
  const[isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [emails, setEmails] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    async function checkGoogleConnection() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        try {
          const res = await fetch(`/api/google-workspace?email=${encodeURIComponent(session.user.email)}`);
          const data = await res.json();
          
          if (data.connected) {
            setIsGoogleConnected(true);
            setEmails(data.emails || []);
            setTasks(data.tasks ||[]);
          }
        } catch (e) { console.error("Google Sync Error", e); }
      }
      setIsLoading(false);
    }
    checkGoogleConnection();
  },[]);

  async function connectGoogle() {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/google-auth');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to real Google Login
      } else {
        alert("Google Client ID missing from Vercel Environment Variables.");
      }
    } catch (error: any) {
      alert("Error connecting: " + error.message);
    } finally {
      setIsConnecting(false);
    }
  }

  if (isLoading) return <div className="p-8 text-center text-gray-500">Syncing with Google Workspace...</div>;

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
            <p className="text-gray-500 mb-6">Link your Google account to read your live Gmail inbox and manage your Google Tasks directly inside OphirCRE.</p>
            <button onClick={connectGoogle} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition shadow-sm text-lg">
              Authenticate with Google
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
            <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-150px)]">
              <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center rounded-t-xl">
                <h3 className="font-bold text-gray-800 flex items-center"><span className="mr-2">📧</span> Gmail Inbox (Unread)</h3>
                <a href="https://mail.google.com" target="_blank" className="text-xs font-bold text-blue-600 hover:underline">Open Gmail ↗</a>
              </div>
              <div className="flex-1 overflow-y-auto">
                {emails.map((email) => (
                  <div key={email.id} className="p-4 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition flex flex-col">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-gray-900 text-sm truncate pr-4">{email.from}</span>
                      <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{new Date(email.date).toLocaleDateString()}</span>
                    </div>
                    <span className="font-semibold text-gray-800 text-sm mb-1">{email.subject}</span>
                    <span className="text-sm text-gray-500 truncate">{email.snippet}</span>
                  </div>
                ))}
                {emails.length === 0 && <p className="p-8 text-center text-gray-500">Inbox Zero! No unread emails.</p>}
              </div>
            </div>

            <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-150px)]">
              <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center"><span className="mr-2">✅</span> Google Tasks</h3>
                <a href="https://tasks.google.com" target="_blank" className="text-xs font-bold text-blue-600 hover:underline">Open Tasks ↗</a>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {tasks.map((task) => (
                  <div key={task.id} className="flex items-center p-2 hover:bg-gray-50 rounded group">
                    <input type="checkbox" checked={task.status === 'completed'} readOnly className="w-4 h-4 text-blue-600 rounded border-gray-300 mr-3" />
                    <span className={`text-sm font-medium ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{task.title}</span>
                  </div>
                ))}
                {tasks.length === 0 && <p className="p-8 text-center text-gray-500">No tasks found.</p>}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}