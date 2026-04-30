"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useOrg } from '@/app/context/OrgContext';

export default function CustomViewsPage() {
  const { orgId } = useOrg();
  const [views, setViews] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<any>(null);
  const[isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // UI Toggles
  const [isFocusMode, setIsFocusMode] = useState(false);
  const[isCompact, setIsCompact] = useState(false);

  // Widget Data States
  const[emails, setEmails] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const[comms, setComms] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // Interactive Modals State
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [viewingEmail, setViewingEmail] = useState<any>(null);

  const [viewName, setViewName] = useState('');
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>([]);

  const AVAILABLE_WIDGETS =[
    { id: 'inbox', name: '📧 Gmail Inbox', desc: 'Recent unread emails' },
    { id: 'tasks', name: '✅ Task Board', desc: 'Open maintenance & ops tasks' },
    { id: 'calendar', name: '📅 Upcoming Calendar', desc: 'Tours & expiring leases' },
    { id: 'files', name: '📁 Google Drive / Files', desc: 'Recently uploaded documents' },
    { id: 'sms', name: '💬 Twilio SMS / Voice', desc: 'Recent text messages' }
  ];

  useEffect(() => { if (orgId) { fetchViews(); fetchWidgetData(); } }, [orgId]);

  async function fetchViews() {
    const { data } = await supabase.from('custom_views').select('*').order('created_at', { ascending: true });
    if (data) { setViews(data); if (data.length > 0 && !activeView) setActiveView(data[0]); }
    setIsLoading(false);
  }

  async function fetchWidgetData() {
    const[emailRes, taskRes, fileRes, commsRes, leaseRes, tourRes] = await Promise.all([
      supabase.from('email_inbox').select('*').order('date', { ascending: false }).limit(15),
      supabase.from('tasks').select('*, properties(name), tenants(name)').neq('status', 'Done').order('created_at', { ascending: false }).limit(15),
      supabase.storage.from('documents').list(),
      supabase.from('communications').select('*, tenants(name)').eq('type', 'SMS').order('created_at', { ascending: false }).limit(15),
      supabase.from('leases').select('*, tenants(name)').order('end_date', { ascending: true }).limit(10),
      supabase.from('tours').select('*, properties(name)').gte('tour_date', new Date().toISOString()).order('tour_date', { ascending: true }).limit(10)
    ]);

    if (emailRes.data) setEmails(emailRes.data);
    if (taskRes.data) setTasks(taskRes.data);
    if (fileRes.data) setFiles(fileRes.data.filter(f => f.name !== '.emptyFolderPlaceholder').slice(0, 15));
    if (commsRes.data) setComms(commsRes.data);

    const calData: any[] =[];
    leaseRes.data?.forEach(l => calData.push({ title: `Lease Expiry: ${l.tenants?.name}`, date: l.end_date, type: 'lease' }));
    tourRes.data?.forEach(t => calData.push({ title: `Tour: ${t.prospect_name} at ${t.properties?.name}`, date: t.tour_date, type: 'tour' }));
    calData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setCalendarEvents(calData);
  }

  // --- INTERACTIVITY FUNCTIONS ---
  async function moveTask(id: string, newStatus: string) {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
    setSelectedTask(null); fetchWidgetData();
  }

  async function handleEmailAction(action: string) {
    if (!viewingEmail) return;
    try {
      const res = await fetch('/api/google-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, emailAccount: viewingEmail.account_email, messageId: viewingEmail.message_id, action })
      });
      if (!res.ok) throw new Error("Action failed");
      if (action === 'archive' || action === 'trash') {
        setEmails(emails.filter(e => e.id !== viewingEmail.id));
        setViewingEmail(null);
      } else { alert("Marked as read!"); }
    } catch (error: any) { alert("Error: " + error.message); }
  }

  function toggleWidgetSelection(widgetId: string) {
    if (selectedWidgets.includes(widgetId)) setSelectedWidgets(selectedWidgets.filter(id => id !== widgetId));
    else setSelectedWidgets([...selectedWidgets, widgetId]);
  }

  async function saveView(e: any) {
    e.preventDefault();
    if (!viewName || selectedWidgets.length === 0) return alert("Enter a name and select widgets.");
    try {
      const { data, error } = await supabase.from('custom_views').insert([{ name: viewName, widgets: selectedWidgets, organization_id: orgId }]).select().single();
      if (error) throw error;
      setIsModalOpen(false); setViewName(''); setSelectedWidgets([]); fetchViews(); setActiveView(data);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function deleteView(id: string) {
    if (!confirm("Delete this custom view?")) return;
    await supabase.from('custom_views').delete().eq('id', id);
    setActiveView(null); fetchViews();
  }

  if (isLoading) return <div className="p-8 text-gray-500">Loading Custom Workspaces...</div>;

  // Dynamic CSS classes based on Compact Mode
  const pClass = isCompact ? 'p-2' : 'p-4';
  const textClass = isCompact ? 'text-xs' : 'text-sm';
  const titleClass = isCompact ? 'text-sm font-bold' : 'text-base font-bold';

  return (
    <div className={isFocusMode ? "fixed inset-0 z-[100] bg-gray-100 overflow-y-auto flex flex-col" : "flex-1 flex flex-col h-full overflow-hidden"}>
      
      {!isFocusMode && (
        <>
          <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">Custom Workspaces</h2>
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">+ Create New View</button>
          </header>
          <div className="bg-white border-b border-gray-200 px-8 py-2 flex space-x-2 overflow-x-auto">
            {views.map(view => (
              <button key={view.id} onClick={() => setActiveView(view)} className={`px-4 py-2 rounded-md text-sm font-bold transition whitespace-nowrap ${activeView?.id === view.id ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {view.name}
              </button>
            ))}
          </div>
        </>
      )}

      <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-100">
        {activeView ? (
          <div className="space-y-4">
            
            {/* VIEW CONTROLS (Focus & Compact) */}
            <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-gray-200">
              <div className="flex items-center space-x-4">
                <h3 className="text-xl font-black text-gray-800">{activeView.name}</h3>
                {!isFocusMode && <button onClick={() => deleteView(activeView.id)} className="text-red-500 text-xs font-bold hover:underline">Delete View</button>}
              </div>
              <div className="flex space-x-2">
                <button onClick={() => setIsCompact(!isCompact)} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded text-xs font-bold transition">
                  {isCompact ? '🔍 Normal Font' : '🔍 Compact Font'}
                </button>
                <button onClick={() => setIsFocusMode(!isFocusMode)} className="bg-slate-800 hover:bg-black text-white px-3 py-1.5 rounded text-xs font-bold transition shadow-sm">
                  {isFocusMode ? '⤡ Exit Focus Mode' : '⤢ Full Screen Focus'}
                </button>
              </div>
            </div>

            {/* DYNAMIC WIDGET GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              
              {activeView.widgets.includes('inbox') && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
                  <div className={`${pClass} bg-blue-50 border-b border-blue-100 flex justify-between items-center rounded-t-xl`}>
                    <h4 className="font-bold text-blue-900">📧 Gmail Inbox</h4>
                    <a href="/workspace" className="text-xs text-blue-600 hover:underline">Open Full</a>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {emails.map(e => (
                      <div key={e.id} onClick={() => setViewingEmail(e)} className={`${pClass} border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition`}>
                        <div className="flex justify-between"><p className={`${titleClass} text-gray-900 truncate`}>{e.sender}</p><span className="text-[10px] text-gray-400">{new Date(e.date).toLocaleDateString()}</span></div>
                        <p className={`${textClass} font-semibold text-gray-800 truncate`}>{e.subject}</p>
                        <p className={`${textClass} text-gray-500 truncate`}>{e.snippet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeView.widgets.includes('tasks') && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
                  <div className={`${pClass} bg-green-50 border-b border-green-100 flex justify-between items-center rounded-t-xl`}>
                    <h4 className="font-bold text-green-900">✅ Active Tasks</h4>
                    <a href="/tasks" className="text-xs text-green-600 hover:underline">Open Full</a>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {tasks.map(t => (
                      <div key={t.id} onClick={() => setSelectedTask(t)} className={`${pClass} border-b border-gray-100 hover:bg-green-50 cursor-pointer transition`}>
                        <div className="flex justify-between items-start"><p className={`${titleClass} text-gray-900 truncate pr-2`}>{t.title}</p><span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded uppercase font-bold">{t.status}</span></div>
                        <p className={`${textClass} text-gray-500 truncate mt-1`}>{t.properties?.name || 'General'} {t.tenants && `• ${t.tenants.name}`}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeView.widgets.includes('calendar') && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
                  <div className={`${pClass} bg-purple-50 border-b border-purple-100 flex justify-between items-center rounded-t-xl`}>
                    <h4 className="font-bold text-purple-900">📅 Upcoming Events</h4>
                    <a href="/calendar" className="text-xs text-purple-600 hover:underline">Open Full</a>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {calendarEvents.map((c, i) => (
                      <div key={i} className={`${pClass} border-b border-gray-100 hover:bg-purple-50 flex items-start`}>
                        <span className="text-xl mr-3">{c.type === 'tour' ? '🚶' : '📄'}</span>
                        <div>
                          <p className={`${titleClass} text-gray-900`}>{c.title}</p>
                          <p className={`${textClass} font-bold mt-1 ${c.type === 'lease' ? 'text-red-600' : 'text-orange-600'}`}>{new Date(c.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeView.widgets.includes('sms') && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
                  <div className={`${pClass} bg-orange-50 border-b border-orange-100 flex justify-between items-center rounded-t-xl`}>
                    <h4 className="font-bold text-orange-900">💬 Twilio SMS</h4>
                    <a href="/communications" className="text-xs text-orange-600 hover:underline">Open Full</a>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {comms.map(c => (
                      <div key={c.id} className={`${pClass} border-b border-gray-100 hover:bg-orange-50`}>
                        <p className={`${titleClass} text-gray-900`}>To: {c.tenants?.name || 'Unknown'}</p>
                        <p className={`${textClass} text-gray-600 mt-1 line-clamp-2`}>{c.body}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{new Date(c.created_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeView.widgets.includes('files') && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[500px]">
                  <div className={`${pClass} bg-slate-100 border-b border-slate-200 flex justify-between items-center rounded-t-xl`}>
                    <h4 className="font-bold text-slate-900">📁 Recent Files</h4>
                    <a href="/documents" className="text-xs text-slate-600 hover:underline">Open Full</a>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {files.map((f, i) => (
                      <div key={i} className={`${pClass} border-b border-gray-100 hover:bg-slate-50 flex justify-between items-center`}>
                        <p className={`${titleClass} text-gray-900 truncate pr-4`}>📄 {f.name}</p>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{(f.metadata.size / 1024).toFixed(0)} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-6xl mb-4">🖥️</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">No Custom Views</h3>
            <p className="text-gray-500">Click "Create New View" to build a custom dashboard.</p>
          </div>
        )}

        {/* INTERACTIVE TASK MODAL */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4">
            <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-lg flex flex-col">
              <div className="flex justify-between items-start mb-4 border-b pb-4">
                <h3 className="text-lg font-bold text-gray-800 pr-4">{selectedTask.title}</h3>
                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold uppercase">{selectedTask.status}</span>
              </div>
              <div className="flex-1 overflow-y-auto mb-6 text-sm space-y-3">
                {selectedTask.tenants && <p><strong className="text-gray-700">Tenant:</strong> <span className="text-blue-600 font-bold">{selectedTask.tenants.name}</span></p>}
                {selectedTask.properties && <p><strong className="text-gray-700">Property:</strong> {selectedTask.properties.name}</p>}
                <div className="p-3 bg-gray-50 rounded border text-gray-800 whitespace-pre-wrap font-mono text-xs">{selectedTask.description || 'No description.'}</div>
              </div>
              <div className="flex justify-between border-t pt-4">
                <button onClick={() => setSelectedTask(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm font-bold">Close</button>
                <div className="space-x-2">
                  {selectedTask.status !== 'In Progress' && <button onClick={() => moveTask(selectedTask.id, 'In Progress')} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md text-sm font-bold">Start</button>}
                  {selectedTask.status !== 'Done' && <button onClick={() => moveTask(selectedTask.id, 'Done')} className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-bold">Done ✓</button>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INTERACTIVE EMAIL MODAL */}
        {viewingEmail && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b flex justify-between items-start bg-gray-50">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{viewingEmail.subject}</h3>
                  <p className="text-xs text-gray-600">From: {viewingEmail.sender}</p>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => handleEmailAction('archive')} className="bg-gray-200 text-gray-700 px-3 py-1 rounded font-bold text-xs">Archive</button>
                  <button onClick={() => setViewingEmail(null)} className="text-gray-400 hover:text-gray-800 text-xl ml-2">&times;</button>
                </div>
              </div>
              <div className="p-6 flex-1 overflow-y-auto bg-white">
                {viewingEmail.body_html ? <div dangerouslySetInnerHTML={{ __html: viewingEmail.body_html }} className="prose max-w-none text-sm" /> : <p className="text-gray-600 whitespace-pre-wrap text-sm">{viewingEmail.snippet}</p>}
              </div>
            </div>
          </div>
        )}

        {/* CREATE VIEW MODAL */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-6 text-gray-800">Create Custom View</h3>
              <form onSubmit={saveView} className="space-y-4">
                <input type="text" required placeholder="View Name (e.g. Morning Routine)" className="w-full border p-3 rounded-lg outline-none" value={viewName} onChange={(e) => setViewName(e.target.value)} />
                <div className="space-y-2 max-h-64 overflow-y-auto p-2 border rounded-lg bg-gray-50">
                  {AVAILABLE_WIDGETS.map(w => (
                    <label key={w.id} className="flex items-start space-x-3 cursor-pointer p-2 hover:bg-white rounded">
                      <input type="checkbox" checked={selectedWidgets.includes(w.id)} onChange={() => toggleWidgetSelection(w.id)} className="mt-1 w-4 h-4 text-blue-600" />
                      <div><p className="font-bold text-sm text-gray-900">{w.name}</p><p className="text-xs text-gray-500">{w.desc}</p></div>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded font-bold">Save View</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}