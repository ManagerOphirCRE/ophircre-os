"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function VendorPortal() {
  const [vendor, setVendor] = useState<any>(null);
  const[properties, setProperties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('submit'); // 'submit' or 'bids'
  
  // Submission State
  const [propertyId, setPropertyId] = useState('');
  const[submissionType, setSubmissionType] = useState('Invoice');
  const [amount, setAmount] = useState('');
  const[notes, setNotes] = useState('');
  const [attestation, setAttestation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Bidding State
  const [bids, setBids] = useState<any[]>([]);

  useEffect(function loadSecureVendor() {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const { data: vData } = await supabase.from('vendors').select('*').ilike('contact_email', session.user.email).single();
        if (vData) {
          setVendor(vData);
          // Fetch their bids
          const { data: bData } = await supabase.from('task_bids').select('*, tasks(title, description, status)').eq('vendor_id', vData.id).order('created_at', { ascending: false });
          if (bData) setBids(bData);
        }
      }
      const { data: pData } = await supabase.from('properties').select('*').order('name');
      if (pData) setProperties(pData);
      setIsLoading(false);
    }
    fetchData();
  },[]);

  async function handleSubmit(e: any) {
    e.preventDefault();
    if (!propertyId) return alert("Select a property.");
    if (submissionType === 'Inspection Report' && !attestation) return alert("You must check the attestation box.");
    setIsSubmitting(true);
    try {
      await supabase.from('vendor_submissions').insert([{ vendor_id: vendor.id, property_id: propertyId, submission_type: submissionType, amount: amount ? Number(amount) : null, notes, attestation_agreed: attestation }]);
      const propertyName = properties.find(p => p.id === propertyId)?.name || 'a property';
      await supabase.from('tasks').insert([{ title: `REVIEW: ${submissionType} from ${vendor.company_name}`, description: `Vendor submitted a ${submissionType} for ${propertyName}. Notes: ${notes}`, status: 'To Do' }]);
      alert("Successfully submitted!");
      setPropertyId(''); setAmount(''); setNotes(''); setAttestation(false);
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSubmitting(false); }
  }

  async function submitBid(bidId: string) {
    const bidAmount = prompt("Enter your total bid amount ($):");
    if (!bidAmount) return;
    const bidNotes = prompt("Enter any notes or conditions for this bid:");
    
    try {
      await supabase.from('task_bids').update({ bid_amount: Number(bidAmount), notes: bidNotes || '' }).eq('id', bidId);
      alert("Bid submitted successfully!");
      const { data: bData } = await supabase.from('task_bids').select('*, tasks(title, description, status)').eq('vendor_id', vendor.id).order('created_at', { ascending: false });
      if (bData) setBids(bData);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  if (isLoading) return <div className="p-8 text-center">Authenticating secure connection...</div>;
  if (!vendor) return <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-red-200 max-w-2xl mx-auto mt-10"><h2 className="text-2xl font-bold text-red-600 mb-2">Vendor Account Not Linked</h2><p className="text-gray-600">Your email address is not linked to an approved vendor profile.</p></div>;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      <div className="bg-slate-900 p-6 border-b border-slate-800 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Vendor Portal</h2>
          <p className="text-slate-400 mt-1">Welcome, <span className="font-semibold text-white">{vendor.company_name}</span></p>
        </div>
        <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg">
          <button onClick={() => setActiveTab('submit')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'submit' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'}`}>Submit Work</button>
          <button onClick={() => setActiveTab('bids')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'bids' ? 'bg-white text-slate-900' : 'text-slate-300 hover:text-white'}`}>Job Bidding (RFPs)</button>
        </div>
      </div>

      {activeTab === 'submit' && (
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="block text-sm font-semibold text-slate-700 mb-2">Property Serviced *</label><select required className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">-- Select Property --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="block text-sm font-semibold text-slate-700 mb-2">Submission Type *</label><select className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={submissionType} onChange={(e) => setSubmissionType(e.target.value)}><option value="Invoice">Bill / Invoice</option><option value="Inspection Report">Inspection Report / Attestation</option><option value="Routine Photo">Routine Photos</option></select></div>
          </div>
          {submissionType === 'Invoice' && <div><label className="block text-sm font-semibold text-slate-700 mb-2">Invoice Amount ($) *</label><input type="number" required step="0.01" className="w-full md:w-1/2 border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>}
          <div><label className="block text-sm font-semibold text-slate-700 mb-2">Notes / Description of Work</label><textarea required className="w-full border border-slate-300 p-3 rounded-lg h-24 outline-none resize-none focus:ring-2 focus:ring-blue-500" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          {submissionType === 'Inspection Report' && <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start space-x-3"><input type="checkbox" id="attest" className="mt-1 w-5 h-5 text-amber-600 rounded" checked={attestation} onChange={(e) => setAttestation(e.target.checked)} /><label htmlFor="attest" className="text-sm text-amber-900 font-medium cursor-pointer"><strong>Legal Attestation:</strong> I certify that the inspection/work was completed according to local code and property standards.</label></div>}
          <button type="submit" disabled={isSubmitting} className={`w-full py-4 rounded-lg font-bold text-white transition shadow-md text-lg ${isSubmitting ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{isSubmitting ? 'Submitting...' : 'Submit to Property Management'}</button>
        </form>
      )}

      {activeTab === 'bids' && (
        <div className="p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-6">Open Requests for Proposals (RFPs)</h3>
          <div className="space-y-4">
            {bids.map(bid => (
              <div key={bid.id} className="border border-gray-200 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center bg-gray-50">
                <div className="flex-1 pr-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <h4 className="font-bold text-lg text-gray-900">{bid.tasks?.title}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${bid.status === 'Awarded' ? 'bg-green-100 text-green-800' : bid.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{bid.status}</span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{bid.tasks?.description}</p>
                  {bid.bid_amount > 0 && <p className="text-sm text-gray-500 mt-2"><strong>Your Submitted Bid:</strong> ${bid.bid_amount} ({bid.notes})</p>}
                </div>
                <div className="mt-4 md:mt-0">
                  {bid.status === 'Pending' && bid.bid_amount === 0 && (
                    <button onClick={() => submitBid(bid.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition shadow-sm whitespace-nowrap">Submit Quote</button>
                  )}
                  {bid.status === 'Pending' && bid.bid_amount > 0 && <span className="text-gray-500 font-bold italic">Quote Under Review</span>}
                </div>
              </div>
            ))}
            {bids.length === 0 && <p className="text-center text-gray-500 py-8">No open job requests.</p>}
          </div>
        </div>
      )}
    </div>
  );
}