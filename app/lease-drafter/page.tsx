"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

export default function LeaseDrafterPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const[tenants, setTenants] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [spaces, setSpaces] = useState<any[]>([]);

  const[selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const[selectedSpace, setSelectedSpace] = useState<any>(null);
  
  const [rentAmount, setRentAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generatedLease, setGeneratedLease] = useState('');

  const[comps, setComps] = useState<any>(null);
  const [isFetchingComps, setIsFetchingComps] = useState(false);
  
  // Signature States
  const [isSendingFree, setIsSendingFree] = useState(false);
  const [isSendingCertified, setIsSendingCertified] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: tpls } = await supabase.from('lease_templates').select('*');
      if (tpls) setTemplates(tpls);
      const { data: tnts } = await supabase.from('tenants').select('*');
      if (tnts) setTenants(tnts);
      const { data: props } = await supabase.from('properties').select('*');
      if (props) setProperties(props);
      const { data: spcs } = await supabase.from('spaces').select('*');
      if (spcs) setSpaces(spcs);
    }
    fetchData();
  },[]);

  const filteredSpaces = spaces.filter(s => selectedProperty && s.property_id === selectedProperty.id);

  async function getMarketComps(e: any) {
    e.preventDefault();
    if (!selectedProperty || !selectedSpace) return alert("Select a property and space first.");
    setIsFetchingComps(true);
    try {
      const res = await fetch('/api/market-comps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: selectedProperty.address, sqft: selectedSpace.square_footage, type: selectedSpace.space_type })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setComps(data); setRentAmount(data.estimated_monthly_rent);
    } catch (error: any) { alert("Comps Error: " + error.message); } finally { setIsFetchingComps(false); }
  }

  function generateDocument() {
    if (!selectedTemplate) return alert("Please select a template first.");
    let doc = selectedTemplate.body_text;
    doc = doc.replace(/{{TODAY_DATE}}/g, new Date().toLocaleDateString());
    doc = doc.replace(/{{TENANT_NAME}}/g, selectedTenant ? selectedTenant.name : '[TENANT NAME]');
    doc = doc.replace(/{{PROPERTY_ADDRESS}}/g, selectedProperty ? selectedProperty.address : '[PROPERTY ADDRESS]');
    doc = doc.replace(/{{RENT_AMOUNT}}/g, rentAmount || '[RENT AMOUNT]');
    doc = doc.replace(/{{START_DATE}}/g, startDate || '[START DATE]');
    doc = doc.replace(/{{END_DATE}}/g, endDate || '[END DATE]');
    doc = doc.replace(/{{SPACE_NAME}}/g, selectedSpace ? selectedSpace.name : '[SPACE/SUITE]');
    doc = doc.replace(/{{LANDLORD_NAME}}/g, selectedProperty?.landlord_entity_name || 'OphirCRE');
    setGeneratedLease(`<div style="font-family: serif; line-height: 1.6;">${doc.replace(/\n/g, '<br>')}</div>`);
  }

  // OPTION 1: FREE INTERNAL E-SIGNATURE
  async function sendForFreeSignature() {
    if (!selectedTenant || !generatedLease) return alert("Please select a tenant and generate the document first.");
    setIsSendingFree(true);
    try {
      const { data: lease } = await supabase.from('leases').select('id').eq('tenant_id', selectedTenant.id).single();
      if (!lease) throw new Error("No lease found. Approve prospect in Pipeline first.");

      await supabase.from('leases').update({ document_html: generatedLease, status: 'Pending Signature' }).eq('id', lease.id);

      if (selectedTenant.contact_email) {
        await fetch('/api/send-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: selectedTenant.contact_email,
            subject: "ACTION REQUIRED: Sign Your Lease (OphirCRE Portal)",
            text: `Hello ${selectedTenant.name},\n\nYour lease is ready for signature. Log into your secure portal to execute it:\nhttps://app.ophircre.com/portal-login`
          })
        });
      }
      alert("Sent to Tenant Portal for FREE Internal E-Signature!");
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSendingFree(false); }
  }

  // OPTION 2: PAID CERTIFIED E-SIGNATURE (DROPBOX SIGN)
  async function sendForCertifiedSignature() {
    if (!selectedTenant?.contact_email || !generatedLease) return alert("Tenant must have an email address on file to use Certified E-Signatures.");
    setIsSendingCertified(true);
    try {
      const { data: lease } = await supabase.from('leases').select('id').eq('tenant_id', selectedTenant.id).single();
      if (!lease) throw new Error("No lease found. Approve prospect in Pipeline first.");

      // 1. Send to Dropbox Sign API
      const res = await fetch('/api/dropbox-sign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantEmail: selectedTenant.contact_email,
          tenantName: selectedTenant.name,
          documentHtml: generatedLease,
          subject: `Official Lease Agreement - ${selectedProperty?.name || 'OphirCRE'}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 2. Update database to show it's pending via third-party
      await supabase.from('leases').update({ document_html: generatedLease, status: 'Pending Certified Signature' }).eq('id', lease.id);

      alert("Certified Lease dispatched via Dropbox Sign! The tenant will receive an official email from Dropbox.");
    } catch (error: any) { 
      alert("Dropbox Sign API Error: " + error.message + "\n(Note: Add DROPBOX_SIGN_API_KEY to Vercel to activate this feature)."); 
    } finally { 
      setIsSendingCertified(false); 
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `@media print { header, .print-hide { display: none !important; } textarea { border: none !important; box-shadow: none !important; height: auto !important; overflow: visible !important; } body { background-color: white !important; } }`}} />
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center print:hidden">
        <h2 className="text-xl font-semibold text-gray-800">Lease Drafter & Redlining</h2>
        <div className="space-x-3 flex items-center">
          <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">🖨️ Print PDF</button>
          
          {/* THE DUAL BUTTONS */}
          <button onClick={sendForFreeSignature} disabled={isSendingFree || isSendingCertified} className={`px-4 py-2 rounded-md font-medium text-white transition shadow-sm ${isSendingFree ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>
            {isSendingFree ? 'Sending...' : '✍️ Portal E-Sign (Free)'}
          </button>
          
          <button onClick={sendForCertifiedSignature} disabled={isSendingFree || isSendingCertified} className={`px-4 py-2 rounded-md font-medium text-white transition shadow-sm ${isSendingCertified ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {isSendingCertified ? 'Sending...' : '🔐 Dropbox Sign (Paid)'}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0 bg-gray-100 print:bg-white print:p-0 print:m-0 print:block">
        <div className="w-full md:w-1/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit print-hide">
          <h3 className="font-bold text-gray-800 mb-4">Lease Parameters</h3>
          <div className="space-y-4">
            <select className="w-full border p-2 rounded text-sm outline-none" onChange={(e) => setSelectedTemplate(templates.find(t => t.id === e.target.value))}><option value="">-- Choose Template --</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select className="w-full border p-2 rounded text-sm outline-none" onChange={(e) => setSelectedTenant(tenants.find(t => t.id === e.target.value))}><option value="">-- Choose Tenant --</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select className="w-full border p-2 rounded text-sm outline-none" onChange={(e) => { setSelectedProperty(properties.find(p => p.id === e.target.value)); setSelectedSpace(null) }}><option value="">-- Choose Property --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            {selectedProperty && <select className="w-full border p-2 rounded text-sm bg-blue-50 outline-none" onChange={(e) => setSelectedSpace(spaces.find(s => s.id === e.target.value))}><option value="">-- Choose Space / Suite --</option>{filteredSpaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
            
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-xs text-gray-500">Start Date</label><input type="date" className="w-full border p-2 rounded text-sm outline-none" onChange={(e) => setStartDate(e.target.value)} /></div>
              <div><label className="block text-xs text-gray-500">End Date</label><input type="date" className="w-full border p-2 rounded text-sm outline-none" onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>

            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <div className="flex justify-between items-end mb-2">
                <label className="block text-xs font-bold text-gray-700">Monthly Rent ($)</label>
                <button onClick={getMarketComps} disabled={isFetchingComps} className="text-xs text-blue-600 font-bold hover:underline">{isFetchingComps ? 'Analyzing...' : '✨ Get Market Comps'}</button>
              </div>
              <input type="number" className="w-full border p-2 rounded text-sm outline-none font-bold text-green-700" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} />
              {comps && (
                <div className="mt-3 text-xs text-gray-600 border-t pt-2">
                  <p><strong>Est. Market Rate:</strong> ${comps.price_per_sqft_annual}/sqft/yr</p>
                  <p className="mt-1 italic">"{comps.market_trend}"</p>
                </div>
              )}
            </div>

            <button onClick={generateDocument} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium mt-4 transition">Generate Document →</button>
          </div>
        </div>

        <div className="w-full md:w-2/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-6 print:w-full print:border-none print:shadow-none print:p-0 print:m-0">
          <h3 className="font-bold text-gray-800 mb-2 print-hide">Document Editor</h3>
          <textarea 
            className="flex-1 w-full p-4 rounded-lg border border-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-serif text-gray-800 leading-relaxed print:border-none print:p-0"
            style={{ minHeight: '600px' }} 
            value={generatedLease} 
            onChange={(e) => setGeneratedLease(e.target.value)}
            placeholder="Your generated lease will appear here..."
          />
        </div>
      </main>
    </>
  );
}