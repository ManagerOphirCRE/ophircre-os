"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useOrg } from '@/app/context/OrgContext';

export default function WorkspacePage() {
  const { orgId } = useOrg();
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const[isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [emails, setEmails] = useState<any[]>([]);
  const[accounts, setAccounts] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('newest'); // NEW: Sorting State
  
  const[properties, setProperties] = useState<any[]>([]);
  const [taskModalEmail, setTaskModalEmail] = useState<any>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const[syncError, setSyncError] = useState<string | null>(null);

  // NEW: Read & Compose State
  const[viewingEmail, setViewingEmail] = useState<any>(null);
  const[isComposing, setIsComposing] = useState(false);
  const [composeFrom, setComposeFrom] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const[composeBody, setComposeBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (orgId) { fetchProperties(); checkConnectionAndSync(); }
  }, [orgId]);

  async function fetchProperties() {
    const { data } = await supabase.from('properties').select('*').order('name');
    if (data) setProperties(data);
  }

  async function checkConnectionAndSync() {
    setIsLoading(true); setSyncError(null);
    try {
      const { data: tokens } = await supabase.from('google_tokens').select('*').eq('organization_id', orgId);
      if (tokens && tokens.length > 0) {
        setIsGoogleConnected(true);
        const connectedEmails = tokens.map(t => t.user_email);
        setAccounts(connectedEmails);
        if (connectedEmails.length > 0) setComposeFrom(connectedEmails[0]); // Default sender

        const { data: dbEmails } = await supabase.from('email_inbox').select('*').order('created_at', { ascending: false });
        if (dbEmails) setEmails(dbEmails);

        const res = await fetch(`/api/google-workspace?orgId=${orgId}`);
        const data = await res.json();
        if (data.error) setSyncError(`Google API Error: ${data.error}`);
        else if (data.synced > 0) {
          const { data: newDbEmails } = await supabase.from('email_inbox').select('*').order('created_at', { ascending: false });
          if (newDbEmails) setEmails(newDbEmails);
        }
      }
    } catch (e: any) { setSyncError(e.message); } finally { setIsLoading(false); }
  }

  async function manualSync() {
    setIsSyncing(true); setSyncError(null);
    try {
      const res = await fetch(`/api/google-workspace?orgId=${orgId}`);
      const data = await res.json();
      if (data.error) setSyncError(`Google API Error: ${data.error}`);
      else {
        alert(`Sync complete! Found ${data.synced || 0} new emails.`);
        if (data.accounts) setAccounts(data.accounts);
        const { data: dbEmails } = await supabase.from('email_inbox').select('*').order('created_at', { ascending: false });
        if (dbEmails) setEmails(dbEmails);
      }
    } catch (e: any) { setSyncError(e.message); } finally { setIsSyncing(false); }
  }

  async function connectNewGoogleAccount() {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/google-auth?state=${orgId}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error: any) { setSyncError("Error connecting: " + error.message); }
  }

  async function convertToTask(e: any) {
    e.preventDefault();
    try {
      await supabase.from('tasks').insert([{ title: `EMAIL: ${taskModalEmail.subject}`, description: `From: ${taskModalEmail.sender}\nReceived at: ${taskModalEmail.account_email}\n\n${taskModalEmail.snippet}`, property_id: selectedPropertyId || null, status: 'To Do', organization_id: orgId }]);
      alert("Email successfully added to Task Board!"); setTaskModalEmail(null); setSelectedPropertyId(''); setViewingEmail(null);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function sendGmail(e: any) {
    e.preventDefault();
    setIsSending(true);
    try {
      const res = await fetch('/api/google-send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, fromEmail: composeFrom, toEmail: composeTo, subject: composeSubject, bodyHtml: composeBody.replace(/\n/g, '<br>') })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert("Email sent successfully via Gmail!");
      setIsComposing(false); setComposeTo(''); setComposeSubject(''); setComposeBody('');
    } catch (error: any) { alert("Send Error: " + error.message); } finally { setIsSending(false); }
  }

  // SORTING LOGIC
  let filteredEmails = selectedAccount === 'ALL' ? [...emails] : emails.filter(e => e.account_email === selectedAccount);
  if (sortOrder === 'oldest') filteredEmails = filteredEmails.reverse();
  if (sortOrder === 'sender') filteredEmails = filteredEmails.sort((a, b) => a.sender.localeCompare(b.sender));

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading Workspace...</div>;

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Unified Inbox & Workspace</h2>
        {isGoogleConnected && (
          <div className="flex space-x-3">
            <button onClick={() => setIsComposing(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
              ✏️ Compose
            </button>
            <button onClick={manualSync} disabled={isSyncing} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium transition">
              {isSyncing ? '🔄 Syncing...' : '🔄 Sync Now'}
            </button>
            <button onClick={connectNewGoogleAccount} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm flex items-center">
              <span className="mr-2 bg-white text-blue-600 rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs">G</span>
              + Add Account
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        {syncError && <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm"><h3 className="text-red-800 font-bold">Diagnostic Alert:</h3><p className="text-red-600 font-mono text-sm mt-1">{syncError}</p></div>}

        {!isGoogleConnected ? (
          <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center max-w-2xl mx-auto mt-10"><div className="text-5xl mb-4">📧</div><h3 className="text-2xl font-bold text-gray-800 mb-2">Connect Your Inboxes</h3><button onClick={connectNewGoogleAccount} className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition shadow-sm text-lg">Authenticate with Google</button></div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-150px)]">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center rounded-t-xl">
              <div className="flex items-center space-x-4">
                <h3 className="font-bold text-gray-800 flex items-center"><span className="mr-2">📥</span> Unified Inbox</h3>
                <select className="border p-1 rounded text-sm outline-none bg-white font-bold text-blue-600" value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                  <option value="ALL">All Connected Accounts</option>
                  {accounts.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                </select>
                <select className="border p-1 rounded text-sm outline-none bg-white text-gray-600" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="sender">Sort: By Sender</option>
                </select>
              </div>
              <span className="text-xs text-gray-500 font-medium">{filteredEmails.length} messages saved</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredEmails.map((email) => (
                <div key={email.id} onClick={() => setViewingEmail(email)} className="p-4 border-b border-gray-100 hover:bg-blue-50 transition flex flex-col group cursor-pointer">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center space-x-2"><span className="font-bold text-gray-900 text-sm truncate max-w-md">{email.sender}</span><span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded uppercase">{email.account_email}</span></div>
                    <span className="text-xs text-gray-500 font-medium whitespace-nowrap">{new Date(email.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="flex-1 pr-4"><span className="font-semibold text-gray-800 text-sm mb-1 block">{email.subject}</span><span className="text-sm text-gray-500 line-clamp-1">{email.snippet}</span></div>
                    <button onClick={(e) => { e.stopPropagation(); setTaskModalEmail(email); }} className="opacity-0 group-hover:opacity-100 bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1 rounded text-xs font-bold transition whitespace-nowrap">⚡ Create Task</button>
                  </div>
                </div>
              ))}
              {filteredEmails.length === 0 && <p className="p-8 text-center text-gray-500">Inbox Zero! No emails found.</p>}
            </div>
          </div>
        )}

        {/* READ EMAIL MODAL */}
        {viewingEmail && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b flex justify-between items-start bg-gray-50">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{viewingEmail.subject}</h3>
                  <p className="text-sm text-gray-600"><strong>From:</strong> {viewingEmail.sender}</p>
                  <p className="text-sm text-gray-600"><strong>To:</strong> {viewingEmail.account_email}</p>
                  <p className="text-xs text-gray-400 mt-1">{new Date(viewingEmail.date).toLocaleString()}</p>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => { setTaskModalEmail(viewingEmail); setViewingEmail(null); }} className="bg-orange-100 text-orange-700 px-4 py-2 rounded font-bold text-sm">⚡ Task</button>
                  <button onClick={() => { setComposeTo(viewingEmail.sender.match(/<(.+)>/)?.[1] || viewingEmail.sender); setComposeSubject(`Re: ${viewingEmail.subject}`); setComposeFrom(viewingEmail.account_email); setIsComposing(true); setViewingEmail(null); }} className="bg-blue-100 text-blue-700 px-4 py-2 rounded font-bold text-sm">Reply</button>
                  <button onClick={() => setViewingEmail(null)} className="text-gray-400 hover:text-gray-800 text-2xl ml-4">&times;</button>
                </div>
              </div>
              <div className="p-6 flex-1 overflow-y-auto bg-white">
                {viewingEmail.body_html ? (
                  <div dangerouslySetInnerHTML={{ __html: viewingEmail.body_html }} className="prose max-w-none text-sm" />
                ) : (
                  <p className="text-gray-600 whitespace-pre-wrap text-sm">{viewingEmail.snippet}\n\n(Full HTML body not available for older synced emails. Click 'Sync Now' to pull full bodies for new emails).</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* COMPOSE EMAIL MODAL */}
        {isComposing && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl">
              <h3 className="text-xl font-bold mb-6 text-gray-800">Compose Email</h3>
              <form onSubmit={sendGmail} className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-1">From Account</label><select className="w-full border p-2 rounded outline-none" value={composeFrom} onChange={(e) => setComposeFrom(e.target.value)}>{accounts.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">To</label><input type="email" required className="w-full border p-2 rounded outline-none" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Subject</label><input type="text" required className="w-full border p-2 rounded outline-none" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Message</label><textarea required className="w-full border p-3 rounded-lg outline-none h-48 resize-none" value={composeBody} onChange={(e) => setComposeBody(e.target.value)} /></div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsComposing(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" disabled={isSending} className={`px-6 py-2 rounded font-bold text-white transition shadow-sm ${isSending ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>{isSending ? 'Sending...' : 'Send Email'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CREATE TASK MODAL */}
        {taskModalEmail && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-2 text-gray-800">Convert Email to Task</h3>
              <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-4 text-sm"><p className="font-bold truncate">{taskModalEmail.subject}</p><p className="text-gray-500 text-xs truncate mt-1">From: {taskModalEmail.sender}</p></div>
              <form onSubmit={convertToTask} className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Link to Property (Optional)</label><select className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}><option value="">-- General Task --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div className="flex justify-end space-x-3 pt-4 border-t"><button type="button" onClick={() => setTaskModalEmail(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button><button type="submit" className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded font-bold transition shadow-sm">Create Task</button></div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}