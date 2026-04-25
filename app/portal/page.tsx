"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function TenantPortal() {
  const [tenant, setTenant] = useState<any>(null);
  const[invoices, setInvoices] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  
  const [ticketTitle, setTicketTitle] = useState('');
  const[ticketDesc, setTicketDesc] = useState('');
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const[isSubmitting, setIsSubmitting] = useState(false);
  
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [surveySent, setSurveySent] = useState(false);
  const [signature, setSignature] = useState('');
  const[redlineNotes, setRedlineNotes] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const[uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(function loadSecureTenant() {
    async function fetchData() {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('success') === 'true') {
        alert(`Payment of $${urlParams.get('amount')} received successfully!`);
        window.history.replaceState(null, '', '/portal');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const { data: tData } = await supabase.from('tenants').select('*, leases(*, spaces(name, properties(name)))').ilike('contact_email', session.user.email).single();
        if (tData) {
          setTenant(tData);
          const { data: iData } = await supabase.from('tenant_invoices').select('*').eq('tenant_id', tData.id).order('due_date', { ascending: false });
          if (iData) setInvoices(iData);
          const { data: tkData } = await supabase.from('tasks').select('*').eq('tenant_id', tData.id).order('created_at', { ascending: false });
          if (tkData) setMyTasks(tkData);
        }
      }
      setIsLoading(false);
    }
    fetchData();
  },[]);

  async function uploadProspectDoc(event: any, docType: string) {
    try {
      setUploadingDoc(true);
      const file = event.target.files[0]; if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenant.name.replace(/\s+/g, '_')}_${docType}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error } = await supabase.storage.from('documents').upload(fileName, file);
      if (error) throw error;
      await supabase.from('tasks').insert([{ title: `DOCUMENT UPLOADED: ${tenant.name}`, description: `Prospect uploaded their ${docType}.`, tenant_id: tenant.id, status: 'To Do', organization_id: tenant.organization_id }]);
      alert(`${docType} uploaded successfully!`);
    } catch (error: any) { alert('Error: ' + error.message); } finally { setUploadingDoc(false); }
  }

  async function signLease() {
    if (!signature || signature.toLowerCase() !== tenant.name.toLowerCase()) return alert(`Type your exact legal name: ${tenant.name}`);
    setIsSigning(true);
    try {
      await supabase.from('leases').update({ tenant_signature: signature, signed_at: new Date().toISOString(), status: 'Active' }).eq('id', tenant.leases[0].id);
      alert("Lease executed!"); window.location.reload();
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSigning(false); }
  }

  async function requestChanges() {
    if (!redlineNotes) return alert("Explain the changes.");
    setIsSigning(true);
    try {
      await supabase.from('tasks').insert([{ title: `REDLINE REQUEST: ${tenant.name}`, description: `Changes requested:\n\n${redlineNotes}`, tenant_id: tenant.id, status: 'To Do', organization_id: tenant.organization_id }]);
      alert("Changes sent to management."); setRedlineNotes('');
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSigning(false); }
  }

  async function acceptRenewal(lease: any) {
    if (!confirm(`Agree to extend lease for 12 months at $${lease.renewal_offer_rent}/mo?`)) return;
    setIsRenewing(true);
    try {
      const currentEndDate = new Date(lease.end_date); currentEndDate.setFullYear(currentEndDate.getFullYear() + 1);
      const newEndDate = currentEndDate.toISOString().split('T')[0];
      await supabase.from('leases').update({ end_date: newEndDate, base_rent_amount: lease.renewal_offer_rent, renewal_status: 'Accepted' }).eq('id', lease.id);
      await supabase.from('tasks').insert([{ title: `RENEWAL ACCEPTED: ${tenant.name}`, description: `Lease extended to ${newEndDate} at $${lease.renewal_offer_rent}/mo.`, tenant_id: tenant.id, status: 'To Do', organization_id: tenant.organization_id }]);
      alert("Lease renewed!"); window.location.reload();
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsRenewing(false); }
  }

  async function handlePayment(amountDue: number) {
    if (amountDue <= 0) return alert("Balance is zero!");
    setIsPaying(true);
    try {
      const res = await fetch('/api/stripe-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amountDue, tenantName: tenant.name, tenantId: tenant.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (error: any) { alert("Payment Error: " + error.message); setIsPaying(false); }
  }

  // THIS IS THE FUNCTION WITH THE PUSH NOTIFICATION FIX!
  async function submitTicket(e: any) {
    e.preventDefault(); setIsSubmitting(true);
    try {
      let photoUrl = '';
      if (ticketFile) {
        const fileExt = ticketFile.name.split('.').pop();
        const fileName = `ticket_${Math.random().toString(36).substring(2)}.${fileExt}`;
        await supabase.storage.from('documents').upload(fileName, ticketFile);
        const { data } = supabase.storage.from('documents').getPublicUrl(fileName);
        photoUrl = `\n\nAttached Photo: ${data.publicUrl}`;
      }
      
      await supabase.from('tasks').insert([{ 
        title: `TENANT TICKET: ${ticketTitle}`, 
        description: ticketDesc + photoUrl, 
        tenant_id: tenant.id, 
        status: 'New',
        organization_id: tenant.organization_id
      }]);

      // Trigger the Push Notification to the Admin's phone
      fetch('/api/trigger-push', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orgId: tenant.organization_id, 
          title: `New Ticket: ${tenant.name}`, 
          body: ticketTitle,
          url: '/tasks'
        })
      }).catch(e => console.error("Push failed", e));

      alert("Ticket submitted securely!"); setTicketTitle(''); setTicketDesc(''); setTicketFile(null);
      const { data: tkData } = await supabase.from('tasks').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
      if (tkData) setMyTasks(tkData);
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSubmitting(false); }
  }

  async function submitSurvey(e: any) {
    e.preventDefault();
    await supabase.from('tenant_surveys').insert([{ tenant_id: tenant.id, rating, feedback, organization_id: tenant.organization_id }]);
    setSurveySent(true);
  }

  function printLease() {
    const leaseHtml = tenant.leases?.[0]?.document_html;
    if (!leaseHtml) return alert("Lease document not found.");
    const printWindow = window.open('', '_blank');
    printWindow?.document.write(`<html><head><title>Lease Agreement</title></head><body style="font-family: serif; padding: 40px;">${leaseHtml}</body></html>`);
    printWindow?.document.close();
    printWindow?.print();
  }

  if (isLoading) return <div className="p-8 text-center text-gray-500">Authenticating secure connection...</div>;
  if (!tenant) return <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-red-200 max-w-2xl mx-auto mt-10"><h2 className="text-2xl font-bold text-red-600 mb-2">Account Not Linked</h2><p className="text-gray-600">Your email address is not linked to an active profile.</p></div>;

  const activeLease = tenant.leases?.[0];

  if (tenant.status.startsWith('prospect') && tenant.status !== 'prospect_negotiation') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-md text-center"><h2 className="text-3xl font-bold mb-2">Application Under Review</h2><p className="text-slate-300">Welcome, {tenant.name}. Please upload required documents.</p></div>
        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
          <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Required Documents</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"><div><h4 className="font-bold text-gray-900">Government Issued ID</h4></div><label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold cursor-pointer">{uploadingDoc ? 'Uploading...' : 'Upload'}<input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => uploadProspectDoc(e, 'ID')} disabled={uploadingDoc} /></label></div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"><div><h4 className="font-bold text-gray-900">Bank Statements</h4></div><label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold cursor-pointer">{uploadingDoc ? 'Uploading...' : 'Upload'}<input type="file" className="hidden" accept=".pdf" onChange={(e) => uploadProspectDoc(e, 'Bank_Statements')} disabled={uploadingDoc} /></label></div>
          </div>
        </div>
      </div>
    );
  }

  if (activeLease?.status === 'Pending Signature') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-md text-center"><h2 className="text-3xl font-bold mb-2">Action Required: Sign Your Lease</h2></div>
        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200">
          <div className="border border-gray-300 p-6 h-[500px] overflow-y-auto mb-6 bg-gray-50 rounded font-serif text-sm whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: activeLease.document_html }} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-gray-200">
            <div><label className="block text-xs text-gray-500 mb-1">Type legal name to sign: <strong>{tenant.name}</strong></label><input type="text" className="w-full border-2 border-blue-200 p-3 rounded-lg outline-none mb-3" value={signature} onChange={(e) => setSignature(e.target.value)} /><button onClick={signLease} disabled={isSigning} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">{isSigning ? 'Processing...' : 'Sign & Execute'}</button></div>
            <div className="border-l pl-8"><label className="block text-xs text-gray-500 mb-1">Need changes? (Redline)</label><textarea className="w-full border p-3 rounded-lg outline-none h-20 resize-none mb-3" value={redlineNotes} onChange={(e) => setRedlineNotes(e.target.value)} /><button onClick={requestChanges} disabled={isSigning} className="w-full bg-gray-800 text-white py-2 rounded-lg font-bold">Submit Changes</button></div>
          </div>
        </div>
      </div>
    );
  }

  const unpaidBalance = invoices.filter(i => i.status !== 'Paid').reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="space-y-8">
      {activeLease?.renewal_status === 'Offered' && (
        <div className="bg-orange-500 rounded-2xl p-8 text-white shadow-lg flex flex-col md:flex-row justify-between items-center border-4 border-orange-400">
          <div><h2 className="text-2xl font-black mb-1">⚠️ Your Lease is Expiring Soon</h2><p className="text-orange-100 font-medium">Renew for 12 months at <strong>${activeLease.renewal_offer_rent}/mo</strong>.</p></div>
          <button onClick={() => acceptRenewal(activeLease)} disabled={isRenewing} className="mt-4 md:mt-0 bg-white text-orange-600 px-6 py-3 rounded-lg font-black shadow-md hover:bg-gray-100">{isRenewing ? 'Processing...' : 'Accept & Renew Now'}</button>
        </div>
      )}

      <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-md">
        <h2 className="text-3xl font-bold mb-2">Welcome back, {tenant.name}</h2>
        <p className="text-blue-100">Manage your lease, pay rent, and request maintenance here.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-gray-500 font-medium mb-2">Current Balance</h3>
            <p className={`text-4xl font-bold mb-4 ${unpaidBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>${unpaidBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            <button onClick={() => handlePayment(unpaidBalance)} disabled={isPaying || unpaidBalance <= 0} className={`w-full py-3 rounded-lg font-bold text-white transition ${isPaying || unpaidBalance <= 0 ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700 shadow-sm'}`}>{isPaying ? 'Connecting...' : unpaidBalance > 0 ? 'Pay Balance Now' : 'Balance Paid'}</button>
          </div>

          {activeLease && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Lease Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Property</span><span className="font-medium text-gray-900 text-right">{activeLease.spaces?.properties?.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Suite</span><span className="font-medium text-gray-900">{activeLease.spaces?.name}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Expires</span><span className="font-medium text-gray-900">{activeLease.end_date}</span></div>
              </div>
            </div>
          )}

          {activeLease && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">My Documents</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded border">
                  <span className="font-medium text-gray-800">📄 Active Lease Agreement</span>
                  <button onClick={printLease} className="text-blue-600 font-bold hover:underline">Download</button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl shadow-sm text-white">
            <h3 className="font-bold mb-2">How are we doing?</h3>
            {surveySent ? <p className="text-green-400 text-sm font-medium">Thank you for your feedback!</p> : (
              <form onSubmit={submitSurvey} className="space-y-3">
                <select className="w-full p-2 rounded text-slate-900 text-sm outline-none" value={rating} onChange={(e)=>setRating(Number(e.target.value))}><option value="5">⭐⭐⭐⭐⭐ Excellent</option><option value="4">⭐⭐⭐⭐ Good</option><option value="3">⭐⭐⭐ Average</option><option value="2">⭐⭐ Poor</option><option value="1">⭐ Terrible</option></select>
                <textarea placeholder="Any comments?" className="w-full p-2 rounded text-slate-900 text-sm h-16 resize-none outline-none" value={feedback} onChange={(e)=>setFeedback(e.target.value)}></textarea>
                <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-bold text-sm transition">Submit Survey</button>
              </form>
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 bg-gray-50 border-b border-gray-200"><h3 className="font-bold text-gray-800">Billing History</h3></div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Description</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Due Date</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Amount</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map(inv => (
                  <tr key={inv.id} className="bg-white">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.description}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{inv.due_date}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">${Number(inv.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === 'Paid' ? 'bg-green-100 text-green-800' : inv.status === 'Overdue' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{inv.status}</span></td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No invoices on file.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Request Maintenance</h3>
              <form onSubmit={submitTicket} className="space-y-4 mt-6">
                <input type="text" required placeholder="Issue Title" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} />
                <textarea required placeholder="Detailed Description..." className="w-full border p-3 rounded-lg h-32 outline-none resize-none focus:ring-2 focus:ring-blue-500" value={ticketDesc} onChange={(e) => setTicketDesc(e.target.value)} />
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Attach Photo (Optional)</label><input type="file" accept="image/*" onChange={(e) => setTicketFile(e.target.files?.[0] || null)} className="w-full border p-2 rounded-lg text-sm" /></div>
                <button type="submit" disabled={isSubmitting} className={`w-full py-3 rounded-lg font-bold text-white transition shadow-sm mt-4 ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{isSubmitting ? 'Submitting...' : 'Submit Work Order'}</button>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[500px]">
              <div className="p-6 bg-gray-50 border-b border-gray-200"><h3 className="font-bold text-gray-800">My Tickets & Messages</h3></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {myTasks.map(task => (
                  <div key={task.id} className="p-4 border border-gray-200 rounded-xl shadow-sm bg-white">
                    <div className="flex justify-between items-start mb-2 border-b pb-2">
                      <h4 className="font-semibold text-gray-900 text-sm">{task.title}</h4>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${task.status === 'Done' ? 'bg-green-100 text-green-800' : task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{task.status}</span>
                    </div>
                    <p className="text-xs text-gray-600 mb-4 whitespace-pre-wrap">{task.description}</p>
                    
                    <div className="bg-gray-50 rounded-lg p-3 space-y-3 mb-3 border border-gray-100 max-h-48 overflow-y-auto">
                      {(task.comments ||[]).map((msg: any, idx: number) => (
                        <div key={idx} className={`flex flex-col ${msg.sender === 'Tenant' ? 'items-end' : 'items-start'}`}>
                          <span className="text-[9px] text-gray-400 font-bold uppercase mb-1">{msg.sender === 'Tenant' ? 'You' : 'Management'} • {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          <div className={`px-3 py-2 rounded-lg text-xs max-w-[90%] ${msg.sender === 'Tenant' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>{msg.text}</div>
                        </div>
                      ))}
                      {(!task.comments || task.comments.length === 0) && <p className="text-center text-gray-400 text-xs italic py-2">No messages yet.</p>}
                    </div>

                    <form onSubmit={async (e: any) => {
                      e.preventDefault();
                      const input = e.target.elements.message;
                      if (!input.value) return;
                      const newMsg = { sender: 'Tenant', text: input.value, timestamp: new Date().toISOString() };
                      const updatedHistory = [...(task.comments || []), newMsg];
                      try {
                        await supabase.from('tasks').update({ comments: updatedHistory }).eq('id', task.id);
                        input.value = '';
                        const { data: tkData } = await supabase.from('tasks').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false });
                        if (tkData) setMyTasks(tkData);
                      } catch (err: any) { alert("Error: " + err.message); }
                    }} className="flex space-x-2">
                      <input type="text" name="message" placeholder="Reply to management..." className="flex-1 border p-2 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" />
                      <button type="submit" className="bg-gray-800 hover:bg-black text-white px-3 py-1 rounded-lg font-bold text-xs transition">Send</button>
                    </form>
                  </div>
                ))}
                {myTasks.length === 0 && <p className="text-center text-gray-500 mt-10 text-sm">No recent tickets.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}