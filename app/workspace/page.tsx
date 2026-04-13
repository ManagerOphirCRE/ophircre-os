"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useOrg } from '@/app/context/OrgContext';

export default function WorkspacePage() {
  const { orgId } = useOrg();
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [emails, setEmails] = useState<any[]>([]);
  const[accounts, setAccounts] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('ALL');
  
  const [properties, setProperties] = useState<any[]>([]);
  const [taskModalEmail, setTaskModalEmail] = useState<any>(null);
  const[selectedPropertyId, setSelectedPropertyId] = useState('');

  useEffect(() => {
    if (orgId) {
      fetchDatabaseEmails();
      fetchProperties();
      syncGmail(); 
    }
  }, [orgId]);

  async function fetchProperties() {
    const { data } = await supabase.from('properties').select('*').order('name');
    if (data) setProperties(data);
  }

  async function fetchDatabaseEmails() {
    const { data } = await supabase.from('email_inbox').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setIsGoogleConnected(true);
      setEmails(data);
      const uniqueAccounts = Array.from(new Set(data.map(e => e.account_email)));
      setAccounts(uniqueAccounts as string[]);
    }
    setIsLoading(false);
  }

  async function syncGmail() {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/google-workspace?orgId=${orgId}`);
      const data = await res.json();
      if (data.connected) {
        setIsGoogleConnected(true);
        if (data.synced > 0) fetchDatabaseEmails(); 
      }
    } catch (e) { console.error(e); } finally { setIsSyncing(false); }
  }

  async function connectNewGoogleAccount() {
    try {
      const res = await fetch(`/api/google-auth?state=${orgId}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error: any) { alert("Error connecting: " + error.message); }
  }

  async function convertToTask(e: any) {
    e.preventDefault();
    try {
      await supabase.from('tasks').insert([{
        title: `EMAIL: ${taskModalEmail.subject}`,
        description: `From: ${taskModalEmail.sender}\nReceived at: ${taskModalEmail.account_email}\n\n${taskModalEmail.snippet}`,
        property_id: selectedPropertyId || null,
        status: 'To Do',
        organization_id: orgId
      }]);
      alert("Email successfully added to Task Board!");
      setTaskModalEmail(null);
      setSelectedPropertyId('');
    } catch (error: any) { alert("Error: " + error.message); }
  }

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Workspace...</div>;

  const filteredEmails = selectedAccount === 'ALL' ? emails : emails.filter(e => e.account_email === selectedAccount);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Unified Inbox & Workspace</h2>
        
        {/* FIX: Only show these buttons IF they are already connected */}
        {isGoogleConnected && (
          <div className="flex space-x-3">
            <button onClick={syncGmail} disabled={isSyncing} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium transition">
              {isSyncing ? '🔄 Syncing...' : '🔄 Sync Now'}
            </button>
            <button onClick={connectNewGoogleAccount} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm flex items-center">
              <span className="mr-2 bg-white text-blue-600 rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs">G</span>
              + Add Another Account
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        {!isGoogleConnected ? (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center max-w-2xl mx-auto mt-10">
            <div className="text-5xl mb-4">📧</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Connect Your Inboxes</h3>
            <p className="text-gray-500 mb-6">Link your property-specific Gmail accounts to view them all in one place and instantly convert emails into Maintenance Tasks.</p>
            <button onClick={connectNewGoogleAccount} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition shadow-sm text-lg">
              Authenticate with Google
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-150px)]">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center rounded-t-xl">
              <div className="flex items-center space-x-4">
                <h3 className="font-bold text-gray-800 flex items-center"><span className="mr-2">📥</span> Unified Inbox</h3>
                <select className="border p-1 rounded text-sm outline-none bg-white" value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                  <option value="ALL">All Accounts</option>
                  {accounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                </select>
              </div>
              <span className="text-xs text-gray-500 font-medium">{filteredEmails.length} messages saved</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredEmails.map((email) => (
                <div key={email.id} className="p-4 border-b border-gray-100 hover:bg-blue-50 transition flex flex-col group">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900 text-sm truncate max-w-md">{email.sender}</span>
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded uppercase">{email.account_email}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{new Date(email.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="flex-1 pr-4">
                      <span className="font-semibold text-gray-800 text-sm mb-1 block">{email.subject}</span>
                      <span className="text-sm text-gray-500 line-clamp-1">{email.snippet}</span>
                    </div>
                    <button onClick={() => setTaskModalEmail(email)} className="opacity-0 group-hover:opacity-100 bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1 rounded text-xs font-bold transition whitespace-nowrap">
                      ⚡ Create Task
                    </button>
                  </div>
                </div>
              ))}
              {filteredEmails.length === 0 && <p className="p-8 text-center text-gray-500">Inbox Zero! No unread emails.</p>}
            </div>
          </div>
        )}

        {taskModalEmail && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-2 text-gray-800">Convert Email to Task</h3>
              <p className="text-sm text-gray-500 mb-4">This will add the email to your Kanban board.</p>
              
              <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-4 text-sm">
                <p className="font-bold truncate">{taskModalEmail.subject}</p>
                <p className="text-gray-500 text-xs truncate mt-1">From: {taskModalEmail.sender}</p>
              </div>

              <form onSubmit={convertToTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Link to Property (Optional)</label>
                  <select className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}>
                    <option value="">-- General Task --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={() => setTaskModalEmail(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold transition shadow-sm">Create Task</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}