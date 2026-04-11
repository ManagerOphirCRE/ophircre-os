"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const[selectedTask, setSelectedTask] = useState<any>(null);
  
  const[selectedVendorId, setSelectedVendorId] = useState('');
  const [taskBids, setTaskBids] = useState<any[]>([]);

  // NEW: Chat State
  const [chatMessage, setChatMessage] = useState('');
  const[chatHistory, setChatHistory] = useState<any[]>([]);

  useEffect(function loadData() {
    fetchData();
  },[]);

  async function fetchData() {
    const { data: tData } = await supabase.from('tasks').select('*, tenants(name), properties(name)').order('created_at', { ascending: false });
    if (tData) setTasks(tData);
    const { data: vData } = await supabase.from('vendors').select('*').order('company_name');
    if (vData) setVendors(vData);
  }

  async function fetchBids(taskId: string) {
    const { data } = await supabase.from('task_bids').select('*, vendors(company_name)').eq('task_id', taskId).order('bid_amount', { ascending: true });
    if (data) setTaskBids(data);
  }

  function openTask(task: any) {
    setSelectedTask(task);
    setChatHistory(task.comments ||[]); // Load existing chat history
    fetchBids(task.id);
  }

  async function addTask() {
    if (!newTaskTitle) return;
    await supabase.from('tasks').insert([{ title: newTaskTitle, status: 'To Do' }]);
    setNewTaskTitle(''); fetchData();
  }

  async function moveTask(id: string, newStatus: string) {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
    fetchData(); setSelectedTask(null);
  }

  async function deleteTask(id: string) {
    if(!confirm("Delete this task?")) return;
    await supabase.from('tasks').delete().eq('id', id);
    fetchData(); setSelectedTask(null);
  }
async function dispatchToVendor() {
    if (!selectedVendorId) return alert("Select a vendor first.");
    const vendor = vendors.find(v => v.id === selectedVendorId);
    
    try {
      // 1. Update the task status
      await moveTask(selectedTask.id, 'In Progress');

      // 2. Send SMS via Twilio
      if (vendor.contact_phone) {
        // Format phone number to E.164 format (+1...)
        const formattedPhone = vendor.contact_phone.startsWith('+') ? vendor.contact_phone : `+1${vendor.contact_phone.replace(/\D/g,'')}`;
        
        await fetch('/api/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: formattedPhone,
            body: `WORK ORDER: ${selectedTask.title} at ${selectedTask.properties?.name || 'the property'}. Please log into your vendor portal to submit your invoice when complete: https://app.ophircre.com/vendor-portal`
          })
        });
      }

      alert(`Work Order Dispatched! An SMS text message has been sent to ${vendor.company_name}.`);
    } catch (error: any) {
      alert("Dispatch Error: " + error.message + "\n(Note: Make sure your Twilio keys are in Vercel!)");
    }
  }
  // --- VENDOR BIDDING LOGIC ---
  async function requestBid() {
    if (!selectedVendorId) return alert("Select a vendor first.");
    try {
      const existing = taskBids.find(b => b.vendor_id === selectedVendorId);
      if (existing) return alert("You already requested a bid from this vendor.");
      await supabase.from('task_bids').insert([{ task_id: selectedTask.id, vendor_id: selectedVendorId, status: 'Pending' }]);
      alert("Bid requested!"); fetchBids(selectedTask.id);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function awardJob(bidId: string) {
    if (!confirm("Award the job to this vendor?")) return;
    try {
      await supabase.from('task_bids').update({ status: 'Awarded' }).eq('id', bidId);
      await supabase.from('task_bids').update({ status: 'Rejected' }).eq('task_id', selectedTask.id).neq('id', bidId);
      await supabase.from('tasks').update({ status: 'In Progress' }).eq('id', selectedTask.id);
      alert("Job Awarded!"); fetchBids(selectedTask.id); fetchData();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  // --- NEW: CHAT LOGIC ---
  async function sendChatMessage(e: any) {
    e.preventDefault();
    if (!chatMessage) return;

    const newMessage = {
      sender: 'Management',
      text: chatMessage,
      timestamp: new Date().toISOString()
    };

    const updatedHistory = [...chatHistory, newMessage];

    try {
      await supabase.from('tasks').update({ comments: updatedHistory }).eq('id', selectedTask.id);
      setChatHistory(updatedHistory);
      setChatMessage('');
      fetchData(); // Refresh main list so data stays in sync
    } catch (error: any) {
      alert("Error sending message: " + error.message);
    }
  }

  const todoTasks = tasks.filter(t => t.status === 'To Do' || t.status === 'New');
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress');
  const doneTasks = tasks.filter(t => t.status === 'Done');

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Task Board</h2>
        <div className="flex space-x-2">
          <input type="text" placeholder="Quick add task..." className="border p-2 rounded-md text-sm w-64 outline-none focus:ring-2 focus:ring-blue-500" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} />
          <button onClick={addTask} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">Add</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative bg-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-bold text-gray-700 mb-4">To Do ({todoTasks.length})</h3>
            <div className="space-y-3">
              {todoTasks.map(task => (
                <div key={task.id} onClick={() => openTask(task)} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:border-blue-500 transition">
                  <p className="font-medium text-gray-800">{task.title}</p>
                  {task.tenants && <p className="text-xs text-blue-600 mt-1 font-bold">{task.tenants.name}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-4">In Progress ({inProgressTasks.length})</h3>
            <div className="space-y-3">
              {inProgressTasks.map(task => (
                <div key={task.id} onClick={() => openTask(task)} className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 cursor-pointer hover:border-blue-500 transition">
                  <p className="font-medium text-gray-800">{task.title}</p>
                  {task.tenants && <p className="text-xs text-blue-600 mt-1 font-bold">{task.tenants.name}</p>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <h3 className="font-bold text-green-800 mb-4">Done ({doneTasks.length})</h3>
            <div className="space-y-3">
              {doneTasks.map(task => (
                <div key={task.id} onClick={() => openTask(task)} className="bg-white p-4 rounded-lg shadow-sm border border-green-200 opacity-60 cursor-pointer hover:opacity-100 transition">
                  <p className="font-medium text-gray-800 line-through">{task.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TASK DETAILS MODAL */}
        {selectedTask && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
              
              <div className="flex justify-between items-start mb-4 border-b pb-4">
                <h3 className="text-xl font-bold text-gray-800 pr-4">{selectedTask.title}</h3>
                <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded text-xs font-bold uppercase tracking-wider whitespace-nowrap">{selectedTask.status}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto mb-6 flex flex-col md:flex-row md:space-x-8 space-y-6 md:space-y-0">
                
                {/* LEFT COLUMN: Details & Bidding */}
                <div className="w-full md:w-1/2 space-y-4 text-sm pr-2">
                  {selectedTask.tenants && <p><strong className="text-gray-700">Linked Tenant:</strong> <span className="text-blue-600 font-bold">{selectedTask.tenants.name}</span></p>}
                  {selectedTask.properties && <p><strong className="text-gray-700">Linked Property:</strong> {selectedTask.properties.name}</p>}
                  <div>
                    <strong className="text-gray-700">Description / Notes:</strong>
                    <p className="mt-2 p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 whitespace-pre-wrap font-mono text-xs leading-relaxed">
                      {selectedTask.description || 'No description provided.'}
                    </p>
                  </div>

                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 mt-4">
                    <strong className="text-orange-800 block mb-2">Vendor Bidding (RFP)</strong>
                    <div className="flex space-x-2 mb-4">
                      <select className="flex-1 border p-2 rounded outline-none" value={selectedVendorId} onChange={(e) => setSelectedVendorId(e.target.value)}>
                        <option value="">-- Select Vendor --</option>
                        {vendors.map(v => <option key={v.id} value={v.id}>{v.company_name} ({v.trade})</option>)}
                      </select>
                      <button onClick={requestBid} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-bold transition">Request Quote</button>
                    </div>

                    {taskBids.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-500 uppercase">Incoming Bids</p>
                        {taskBids.map(bid => (
                          <div key={bid.id} className="bg-white p-3 rounded border flex justify-between items-center">
                            <div>
                              <p className="font-bold text-gray-800">{bid.vendors?.company_name}</p>
                              <p className="text-xs text-gray-500">{bid.notes || 'No notes provided.'}</p>
                            </div>
                            <div className="text-right flex items-center space-x-4">
                              <span className="font-black text-green-700">${Number(bid.bid_amount).toLocaleString()}</span>
                              {bid.status === 'Pending' && <button onClick={() => awardJob(bid.id)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-700">Award Job</button>}
                              {bid.status === 'Awarded' && <span className="text-green-600 font-bold text-xs uppercase">✓ Awarded</span>}
                              {bid.status === 'Rejected' && <span className="text-red-500 font-bold text-xs uppercase">Rejected</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: Live Chat */}
                <div className="w-full md:w-1/2 flex flex-col border-l pl-8">
                  <strong className="text-gray-700 mb-2">Live Chat with Tenant</strong>
                  
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-y-auto space-y-3 mb-4 h-64">
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex flex-col ${msg.sender === 'Management' ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-gray-400 font-bold uppercase mb-1">{msg.sender} • {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        <div className={`px-4 py-2 rounded-lg text-sm max-w-[85%] ${msg.sender === 'Management' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {chatHistory.length === 0 && <p className="text-center text-gray-400 text-sm mt-10">No messages yet.</p>}
                  </div>

                  <form onSubmit={sendChatMessage} className="flex space-x-2">
                    <input type="text" placeholder="Type a message..." className="flex-1 border p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} />
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition">Send</button>
                  </form>
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
  );
}