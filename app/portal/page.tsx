"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function TenantPortal() {
  const [tenant, setTenant] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const[ticketTitle, setTicketTitle] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketFile, setTicketFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [surveySent, setSurveySent] = useState(false);

  useEffect(function loadSecureTenant() {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const { data: tData } = await supabase.from('tenants').select('*, leases(*, spaces(name, properties(name)))').ilike('contact_email', session.user.email).single();
        if (tData) {
          setTenant(tData);
          // Fetch their invoices
          const { data: iData } = await supabase.from('tenant_invoices').select('*').eq('tenant_id', tData.id).order('due_date', { ascending: false });
          if (iData) setInvoices(iData);
        }
      }
      setIsLoading(false);
    }
    fetchData();
  },[]);

  async function submitTicket(e: any) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let photoUrl = '';
      if (ticketFile) {
        const fileExt = ticketFile.name.split('.').pop();
        const fileName = `ticket_${Math.random().toString(36).substring(2)}.${fileExt}`;
        await supabase.storage.from('documents').upload(fileName, ticketFile);
        const { data } = supabase.storage.from('documents').getPublicUrl(fileName);
        photoUrl = `\n\nAttached Photo: ${data.publicUrl}`;
      }
      await supabase.from('tasks').insert([{ title: `TENANT TICKET: ${ticketTitle}`, description: ticketDesc + photoUrl, tenant_id: tenant.id, status: 'New' }]);
      alert("Ticket submitted securely!"); setTicketTitle(''); setTicketDesc(''); setTicketFile(null);
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSubmitting(false); }
  }

  async function submitSurvey(e: any) {
    e.preventDefault();
    await supabase.from('tenant_surveys').insert([{ tenant_id: tenant.id, rating, feedback }]);
    setSurveySent(true);
  }

  if (isLoading) return <div className="p-8 text-center text-gray-500">Authenticating secure connection...</div>;
  if (!tenant) return <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-red-200 max-w-2xl mx-auto mt-10"><h2 className="text-2xl font-bold text-red-600 mb-2">Account Not Linked</h2><p className="text-gray-600">Your email address is not currently linked to an active tenant profile.</p></div>;

  const activeLease = tenant.leases?.[0];
  const unpaidBalance = invoices.filter(i => i.status !== 'Paid').reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <div className="space-y-8">
      <div className="bg-blue-600 rounded-2xl p-8 text-white shadow-md">
        <h2 className="text-3xl font-bold mb-2">Welcome back, {tenant.name}</h2>
        <p className="text-blue-100">Manage your lease, pay rent, and request maintenance here.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-8">
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-gray-500 font-medium mb-2">Current Balance</h3>
            <p className={`text-4xl font-bold mb-4 ${unpaidBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ${unpaidBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
            </p>
            <button onClick={() => alert("In Phase 6, this will open the Stripe Credit Card / ACH checkout portal!")} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition">
              Make a Payment
            </button>
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

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl shadow-sm text-white">
            <h3 className="font-bold mb-2">How are we doing?</h3>
            {surveySent ? <p className="text-green-400 text-sm font-medium">Thank you for your feedback!</p> : (
              <form onSubmit={submitSurvey} className="space-y-3">
                <select className="w-full p-2 rounded text-slate-900 text-sm outline-none" value={rating} onChange={(e)=>setRating(Number(e.target.value))}>
                  <option value="5">⭐⭐⭐⭐⭐ Excellent</option>
                  <option value="4">⭐⭐⭐⭐ Good</option>
                  <option value="3">⭐⭐⭐ Average</option>
                  <option value="2">⭐⭐ Poor</option>
                  <option value="1">⭐ Terrible</option>
                </select>
                <textarea placeholder="Any comments?" className="w-full p-2 rounded text-slate-900 text-sm h-16 resize-none outline-none" value={feedback} onChange={(e)=>setFeedback(e.target.value)}></textarea>
                <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-bold text-sm transition">Submit Survey</button>
              </form>
            )}
          </div>
        </div>

        <div className="md:col-span-2 space-y-8">
          
          {/* NEW: INVOICE HISTORY */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 bg-gray-50 border-b border-gray-200"><h3 className="font-bold text-gray-800">Billing History</h3></div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Due Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map(inv => (
                  <tr key={inv.id} className="bg-white">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.description}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{inv.due_date}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">${Number(inv.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{inv.status}</span>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No invoices on file.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Request Maintenance</h3>
            <form onSubmit={submitTicket} className="space-y-4 mt-6">
              <input type="text" required placeholder="Issue Title" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={ticketTitle} onChange={(e) => setTicketTitle(e.target.value)} />
              <textarea required placeholder="Detailed Description..." className="w-full border p-3 rounded-lg h-32 outline-none resize-none focus:ring-2 focus:ring-blue-500" value={ticketDesc} onChange={(e) => setTicketDesc(e.target.value)} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attach Photo (Optional)</label>
                <input type="file" accept="image/*" onChange={(e) => setTicketFile(e.target.files?.[0] || null)} className="w-full border p-2 rounded-lg text-sm" />
              </div>
              <button type="submit" disabled={isSubmitting} className={`w-full py-3 rounded-lg font-bold text-white transition shadow-sm mt-4 ${isSubmitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSubmitting ? 'Submitting...' : 'Submit Work Order'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}