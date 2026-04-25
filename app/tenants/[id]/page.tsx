"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useParams } from 'next/navigation';

export default function TenantProfilePage() {
  const params = useParams(); 
  const tenantId = params?.id as string;

  const[tenant, setTenant] = useState<any>(null); 
  const [lease, setLease] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false); 
  const[isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState('lease');
  
  const [invoices, setInvoices] = useState<any[]>([]); 
  const[comms, setComps] = useState<any[]>([]); 
  const [tasks, setTasks] = useState<any[]>([]);

  const [coiDate, setCoiDate] = useState(''); 
  const [baseRent, setBaseRent] = useState(0);
  const [camCharge, setCamCharge] = useState(0); 
  const [taxCharge, setTaxCharge] = useState(0); 
  const[insCharge, setInsCharge] = useState(0);
  
  const [escalationDate, setEscalationDate] = useState(''); 
  const[escalationType, setEscalationType] = useState('percentage');
  const[escalationPct, setEscalationPct] = useState(0); 
  const[escalationFixed, setEscalationFixed] = useState(0);

  const [gracePeriod, setGracePeriod] = useState(5);
  const [lateFeeType, setLateFeeType] = useState('percentage');
  const[lateFeeAmount, setLateFeeAmount] = useState(5.0);

  // NEW: Co-Tenant / Split Billing State
  const[coTenants, setCoTenants] = useState<any[]>([]);

  const[isEscalationModalOpen, setIsEscalationModalOpen] = useState(false);
  const[suggestedNewRent, setSuggestedNewRent] = useState('');
  const [escalationEmailBody, setEscalationEmailBody] = useState('');

  const [leaseQuestion, setLeaseQuestion] = useState('');
  const [leaseAnswer, setLeaseAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const[isOnboarding, setIsOnboarding] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const[fetchError, setFetchError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function fetchTenantData() {
      if (!tenantId) return;
      setIsLoading(true); setFetchError('');

      try {
        const { data: tData, error: tErr } = await supabase.from('tenants').select('*').eq('id', tenantId).single();
        if (tErr) throw new Error(`Tenant Error: ${tErr.message}`);
        if (!tData) throw new Error("Tenant not found.");
        
        if (isMounted) { setTenant(tData); setCoiDate(tData.coi_expiration || ''); }

        const { data: lData, error: lErr } = await supabase.from('leases').select('*, spaces(name, properties(name))').eq('tenant_id', tenantId).maybeSingle();
        if (lErr && lErr.code !== 'PGRST116') console.error(lErr);
        
        if (lData && isMounted) {
          setLease(lData); setBaseRent(lData.base_rent_amount || 0); setCamCharge(lData.cam_charge || 0);
          setTaxCharge(lData.tax_charge || 0); setInsCharge(lData.insurance_charge || 0);
          setEscalationDate(lData.next_escalation_date || ''); setEscalationType(lData.escalation_type || 'percentage');
          setEscalationPct(lData.escalation_percentage || 0); setEscalationFixed(lData.escalation_fixed_amount || 0);
          setGracePeriod(lData.grace_period_days || 5); setLateFeeType(lData.late_fee_type || 'percentage'); setLateFeeAmount(lData.late_fee_amount || 5.0);
          
          // Load Co-Tenants
          setCoTenants(lData.co_tenants || []);
        }

        const[invRes, commsRes, tasksRes] = await Promise.all([
          supabase.from('tenant_invoices').select('*').eq('tenant_id', tenantId).order('due_date', { ascending: false }),
          supabase.from('communications').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
          supabase.from('tasks').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
        ]);

        if (isMounted) {
          if (invRes.data) setInvoices(invRes.data);
          if (commsRes.data) setComps(commsRes.data);
          if (tasksRes.data) setTasks(tasksRes.data);
          setIsLoading(false);
        }
      } catch (error: any) {
        if (isMounted) { setFetchError(error.message); setIsLoading(false); }
      }
    }
    fetchTenantData();
    return () => { isMounted = false; };
  }, [tenantId]);

  async function saveProfile() {
    setIsSaving(true);
    try {
      await supabase.from('tenants').update({ coi_expiration: coiDate || null }).eq('id', tenantId);
      if (lease) {
        // Validate Co-Tenant Percentages
        const totalPct = coTenants.reduce((sum, ct) => sum + Number(ct.split_percentage || 0), 0);
        if (coTenants.length > 0 && totalPct !== 100) {
          throw new Error("Co-Tenant split percentages must equal exactly 100%.");
        }

        await supabase.from('leases').update({
          base_rent_amount: baseRent, cam_charge: camCharge, tax_charge: taxCharge, insurance_charge: insCharge,
          next_escalation_date: escalationDate || null, escalation_type: escalationType,
          escalation_percentage: escalationType === 'percentage' ? escalationPct : 0,
          escalation_fixed_amount: escalationType === 'fixed' ? escalationFixed : 0,
          grace_period_days: gracePeriod, late_fee_type: lateFeeType, late_fee_amount: lateFeeAmount,
          co_tenants: coTenants // Save the JSON array
        }).eq('id', lease.id);
      }
      alert("Profile and Financials Updated!");
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSaving(false); }
  }

  // --- CO-TENANT LOGIC ---
  function addCoTenant() {
    setCoTenants([...coTenants, { id: Math.random().toString(), name: '', email: '', split_percentage: 0 }]);
  }

  function updateCoTenant(index: number, field: string, value: string) {
    const newCoTenants = [...coTenants];
    newCoTenants[index] = { ...newCoTenants[index], [field]: value };
    setCoTenants(newCoTenants);
  }

  function removeCoTenant(index: number) {
    const newCoTenants = [...coTenants];
    newCoTenants.splice(index, 1);
    setCoTenants(newCoTenants);
  }

  async function onboardTenant() {
    if (!confirm("Generate Move-In Invoices and send Welcome Packet?")) return;
    setIsOnboarding(true);
    try {
      const totalMonthly = Number(baseRent) + Number(camCharge) + Number(taxCharge) + Number(insCharge);
      if (totalMonthly <= 0) throw new Error("Please save the Lease Financials first.");
      const today = new Date(); const startDate = new Date(lease.start_date);
      const daysInMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate();
      const daysActive = daysInMonth - startDate.getDate() + 1;
      const proratedRent = totalMonthly * (daysActive / daysInMonth);
      const depositAmount = Number(lease.security_deposit || totalMonthly);

      const newInvoices =[
        { tenant_id: tenant.id, lease_id: lease.id, amount: depositAmount, description: 'Security Deposit', due_date: today.toISOString().split('T')[0], status: 'Unpaid', organization_id: lease.organization_id },
        { tenant_id: tenant.id, lease_id: lease.id, amount: proratedRent, description: `Prorated First Month Rent (${daysActive} days)`, due_date: today.toISOString().split('T')[0], status: 'Unpaid', organization_id: lease.organization_id }
      ];
      await supabase.from('tenant_invoices').insert(newInvoices);
      await supabase.from('leases').update({ is_onboarded: true, security_deposit: depositAmount }).eq('id', lease.id);

      if (tenant.contact_email) {
        const welcomeText = `Welcome to ${lease.spaces?.properties?.name}!\n\nYour Move-In invoices have been generated:\n- Security Deposit: $${depositAmount.toFixed(2)}\n- Prorated First Month: $${proratedRent.toFixed(2)}\n\nPlease log into your secure Tenant Portal to submit payment: https://app.ophircre.com/portal-login`;
        await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: tenant.contact_email, subject: "Welcome to OphirCRE! (Action Required)", text: welcomeText }) });
        await supabase.from('communications').insert([{ tenant_id: tenant.id, subject: 'Welcome Packet & Move-In Invoices', body: welcomeText, type: 'Email', status: 'Sent', organization_id: lease.organization_id }]);
      }
      alert("Tenant successfully onboarded!"); window.location.reload();
    } catch (error: any) { alert("Onboarding Error: " + error.message); } finally { setIsOnboarding(false); }
  }

  function openEscalationModal() {
    const currentRent = Number(baseRent); let newRent = currentRent;
    if (escalationType === 'percentage') newRent = currentRent + (currentRent * (Number(escalationPct) / 100));
    else if (escalationType === 'fixed') newRent = Number(escalationFixed);
    setSuggestedNewRent(newRent.toFixed(2));
    setEscalationEmailBody(`Hello ${tenant?.name},\n\nPer the terms of your agreement, your monthly Base Rent is scheduled to escalate on ${escalationDate}.\n\nYour new Base Rent amount will be $${newRent.toFixed(2)}.\n\nThank you,\nOphirCRE Management`);
    setIsEscalationModalOpen(true);
  }

  async function executeEscalation() {
    setIsExecuting(true);
    try {
      const finalRent = Number(suggestedNewRent);
      await supabase.from('leases').update({ base_rent_amount: finalRent, next_escalation_date: null }).eq('id', lease.id);
      if (tenant.contact_email) {
        await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: tenant.contact_email, subject: "Official Notice: Rent Escalation", text: escalationEmailBody }) });
        await supabase.from('communications').insert([{ tenant_id: tenant.id, subject: 'Official Notice: Rent Escalation', body: escalationEmailBody, type: 'Email', status: 'Sent', organization_id: lease.organization_id }]);
      }
      alert(`Escalation Executed! Rent increased to $${finalRent.toFixed(2)}.`);
      setBaseRent(finalRent); setEscalationDate(''); setIsEscalationModalOpen(false);
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsExecuting(false); }
  }

  async function askLeaseQuestion(e: any) {
    e.preventDefault(); if (!leaseQuestion || !lease?.id) return;
    setIsAsking(true); setLeaseAnswer('');
    try {
      const res = await fetch('/api/chat-lease', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leaseId: lease.id, question: leaseQuestion }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLeaseAnswer(data.answer);
    } catch (error: any) { alert("AI Error: " + error.message); } finally { setIsAsking(false); }
  }

  if (isLoading) return <div className="p-8 text-gray-500 font-bold">Loading Tenant 360 Profile...</div>;
  if (fetchError) return <div className="p-8 m-8 bg-red-50 border-l-4 border-red-600 rounded-r-lg shadow-sm"><h3 className="text-red-800 font-bold text-lg">Database Error</h3><p className="text-red-600 font-mono mt-2">{fetchError}</p></div>;
  if (!tenant) return <div className="p-8 text-gray-500">Tenant not found.</div>;

  const unpaidBalance = invoices.filter(i => i.status !== 'Paid').reduce((sum, i) => sum + Number(i.amount), 0);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <div><a href="/tenants" className="text-sm text-blue-600 hover:underline mb-1 inline-block">← Back to Directory</a><h2 className="text-2xl font-bold text-gray-800">{tenant.name}</h2></div>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setActiveTab('lease')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'lease' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Profile & Lease</button>
          <button onClick={() => setActiveTab('ledger')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'ledger' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Billing Ledger</button>
          <button onClick={() => setActiveTab('comms')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'comms' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Comms & Tickets</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100 relative">
        {lease && !lease.is_onboarded && lease.status === 'Active' && (
          <div className="mb-6 bg-green-600 rounded-xl p-6 text-white shadow-md flex justify-between items-center">
            <div><h3 className="text-xl font-bold mb-1">New Tenant Ready for Onboarding</h3><p className="text-green-100 text-sm">Generate prorated rent, security deposit, and send Welcome Packet.</p></div>
            <button onClick={onboardTenant} disabled={isOnboarding} className="bg-white text-green-700 px-6 py-3 rounded-lg font-bold shadow-sm hover:bg-gray-50 transition">{isOnboarding ? 'Onboarding...' : '🚀 1-Click Onboard Tenant'}</button>
          </div>
        )}

        {activeTab === 'lease' && (
          <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0">
            <div className="w-full md:w-1/3 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Contact & Compliance</h3>
                <div className="space-y-3 text-sm mb-4"><p><span className="text-gray-500 block">Email:</span> <span className="font-medium">{tenant.contact_email || 'N/A'}</span></p><p><span className="text-gray-500 block">Phone:</span> <span className="font-medium">{tenant.contact_phone || 'N/A'}</span></p></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">COI Expiration Date</label><input type="date" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={coiDate} onChange={(e) => setCoiDate(e.target.value)} /></div>
              </div>
              {lease && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Location</h3>
                  <div className="space-y-3 text-sm"><p><span className="text-gray-500 block">Property:</span> <span className="font-bold text-blue-600">{lease.spaces?.properties?.name}</span></p><p><span className="text-gray-500 block">Space:</span> <span className="font-medium">{lease.spaces?.name}</span></p><p><span className="text-gray-500 block">Term:</span> <span className="font-medium">{lease.start_date} to {lease.end_date}</span></p></div>
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h4 className="font-bold text-purple-800 mb-2 flex items-center"><span className="mr-2">🤖</span> AI Lease Assistant</h4>
                    <form onSubmit={askLeaseQuestion} className="flex space-x-2"><input type="text" placeholder="e.g., Who pays for HVAC?" className="flex-1 border p-2 rounded text-sm outline-none focus:ring-2 focus:ring-purple-500" value={leaseQuestion} onChange={(e) => setLeaseQuestion(e.target.value)} /><button type="submit" disabled={isAsking} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded font-bold text-sm transition">{isAsking ? '...' : 'Ask'}</button></form>
                    {leaseAnswer && <div className="mt-3 p-3 bg-purple-50 rounded border border-purple-100 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{leaseAnswer}</div>}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full md:w-2/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
              <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Lease Financials & Rules</h3>
              {lease ? (
                <div className="space-y-6 max-w-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Monthly Charges</h4>
                      <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Base Rent</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right font-bold" value={baseRent} onChange={(e) => setBaseRent(Number(e.target.value))} /></div></div>
                      <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">CAM Escrow</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={camCharge} onChange={(e) => setCamCharge(Number(e.target.value))} /></div></div>
                      <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Tax Escrow</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={taxCharge} onChange={(e) => setTaxCharge(Number(e.target.value))} /></div></div>
                      <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Insurance Escrow</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={insCharge} onChange={(e) => setInsCharge(Number(e.target.value))} /></div></div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Late Fee Policy</h4>
                      <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Grace Period (Days)</label><input type="number" className="border p-2 rounded w-24 outline-none" value={gracePeriod} onChange={(e) => setGracePeriod(Number(e.target.value))} /></div>
                      <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Fee Type</label><select className="border p-2 rounded w-32 outline-none text-sm" value={lateFeeType} onChange={(e) => setLateFeeType(e.target.value)}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed Amount ($)</option></select></div>
                      <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Penalty Amount</label><input type="number" step="0.1" className="border p-2 rounded w-24 text-right outline-none" value={lateFeeAmount} onChange={(e) => setLateFeeAmount(Number(e.target.value))} /></div>
                    </div>
                  </div>

                  {/* NEW: CO-TENANT SPLIT BILLING */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Co-Tenants / Split Billing</h4>
                      <button onClick={addCoTenant} className="text-xs text-blue-600 font-bold hover:underline">+ Add Co-Tenant</button>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">If added, the Auto-Biller will split the total monthly charges based on these percentages and email separate invoices.</p>
                    
                    {coTenants.length > 0 && (
                      <div className="space-y-2">
                        {coTenants.map((ct, idx) => (
                          <div key={ct.id} className="flex space-x-2 items-center bg-gray-50 p-2 rounded border">
                            <input type="text" placeholder="Name" className="flex-1 border p-1 rounded text-sm outline-none" value={ct.name} onChange={(e) => updateCoTenant(idx, 'name', e.target.value)} />
                            <input type="email" placeholder="Email" className="flex-1 border p-1 rounded text-sm outline-none" value={ct.email} onChange={(e) => updateCoTenant(idx, 'email', e.target.value)} />
                            <div className="relative w-20"><input type="number" className="w-full border p-1 pr-4 rounded text-sm outline-none text-right" value={ct.split_percentage} onChange={(e) => updateCoTenant(idx, 'split_percentage', e.target.value)} /><span className="absolute right-1 top-1 text-xs text-gray-500">%</span></div>
                            <button onClick={() => removeCoTenant(idx)} className="text-red-500 font-bold px-2">&times;</button>
                          </div>
                        ))}
                        <div className="text-right text-xs font-bold mt-2">
                          Total Split: <span className={coTenants.reduce((sum, ct) => sum + Number(ct.split_percentage || 0), 0) === 100 ? 'text-green-600' : 'text-red-600'}>
                            {coTenants.reduce((sum, ct) => sum + Number(ct.split_percentage || 0), 0)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Rent Escalation Rules</h4>
                    <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Next Bump Date</label><input type="date" className="border p-2 rounded w-40 outline-none" value={escalationDate} onChange={(e) => setEscalationDate(e.target.value)} /></div>
                    <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Bump Type</label><select className="border p-2 rounded w-40 outline-none text-sm" value={escalationType} onChange={(e) => setEscalationType(e.target.value)}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed Amount ($)</option></select></div>
                    {escalationType === 'percentage' ? <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Increase By</label><div className="relative"><input type="number" step="0.1" className="border p-2 pr-6 rounded w-32 text-right outline-none" value={escalationPct} onChange={(e) => setEscalationPct(Number(e.target.value))} /><span className="absolute right-3 top-2 text-gray-500">%</span></div></div> : <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">New Total Base Rent</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right outline-none" value={escalationFixed} onChange={(e) => setEscalationFixed(Number(e.target.value))} /></div></div>}
                    {escalationDate && <button onClick={openEscalationModal} className="w-full mt-2 py-2 rounded font-bold text-white bg-orange-500 hover:bg-orange-600 transition shadow-sm">⚡ Review & Execute Escalation</button>}
                  </div>
                  <button onClick={saveProfile} disabled={isSaving} className="w-full mt-6 py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm">{isSaving ? 'Saving...' : 'Save Financials & Rules'}</button>
                </div>
              ) : <div className="p-4 bg-yellow-50 text-yellow-800 rounded border border-yellow-200 text-sm">No active lease attached.</div>}
            </div>
          </div>
        )}

        {/* Ledger and Comms Tabs remain unchanged below... */}
        {activeTab === 'ledger' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Billing History</h3>
              <span className="text-sm font-medium text-gray-600">Outstanding Balance: <span className={`font-bold ${unpaidBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>${unpaidBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></span>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Due Date</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Description</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Amount</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-500">{inv.due_date}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.description}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900">${Number(inv.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{inv.status}</span></td>
                  </tr>
                ))}
                {invoices.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No invoices on file.</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'comms' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px]">
              <div className="p-4 bg-gray-50 border-b border-gray-200"><h3 className="font-bold text-gray-800">Communication History</h3></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {comms.map(msg => (
                  <div key={msg.id} className="p-4 border border-gray-100 rounded-lg shadow-sm bg-white">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${msg.type === 'SMS' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{msg.type}</span>
                      <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleDateString()}</span>
                    </div>
                    <h4 className="font-semibold text-gray-900">{msg.subject}</h4>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-3">{msg.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[600px]">
              <div className="p-4 bg-gray-50 border-b border-gray-200"><h3 className="font-bold text-gray-800">Maintenance Tickets & Tasks</h3></div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {tasks.map(task => (
                  <div key={task.id} className="p-4 border border-gray-100 rounded-lg shadow-sm bg-white">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-gray-900">{task.title}</h4>
                      <span className="text-xs font-bold px-2 py-1 bg-gray-100 text-gray-800 rounded uppercase">{task.status}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{task.description}</p>
                    <span className="text-xs text-gray-400 block mt-2">{new Date(task.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ESCALATION PREVIEW MODAL */}
        {isEscalationModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl">
              <h3 className="text-xl font-bold mb-2 text-gray-800">Review Rent Escalation</h3>
              <div className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 flex justify-between items-center">
                  <span className="font-bold text-orange-800">Calculated New Base Rent:</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 font-bold">$</span>
                    <input type="number" className="border-2 border-orange-300 p-2 pl-6 rounded w-32 text-right font-black text-orange-900 outline-none" value={suggestedNewRent} onChange={(e) => setSuggestedNewRent(e.target.value)} />
                  </div>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Notice Email to Tenant</label><textarea className="w-full border p-3 rounded-lg outline-none h-48 resize-none text-sm font-serif" value={escalationEmailBody} onChange={(e) => setEscalationEmailBody(e.target.value)} /></div>
              </div>
              <div className="flex justify-end space-x-3 pt-6 mt-4 border-t">
                <button onClick={() => setIsEscalationModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                <button onClick={executeEscalation} disabled={isExecuting} className={`px-6 py-2 rounded font-bold text-white transition shadow-sm ${isExecuting ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>Confirm & Send Notice</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}