"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'
import { useParams } from 'next/navigation'

export default function TenantProfilePage() {
  const params = useParams()
  const tenantId = params.id

  const [tenant, setTenant] = useState<any>(null)
  const [lease, setLease] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('lease')
  const [invoices, setInvoices] = useState<any[]>([])
  const [comms, setComps] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])

  const[coiDate, setCoiDate] = useState('')
  const [baseRent, setBaseRent] = useState(0)
  const [camCharge, setCamCharge] = useState(0)
  const [taxCharge, setTaxCharge] = useState(0)
  const [insCharge, setInsCharge] = useState(0)
  
  const [escalationDate, setEscalationDate] = useState('')
  const[escalationType, setEscalationType] = useState('percentage')
  const[escalationPct, setEscalationPct] = useState(0)
  const [escalationFixed, setEscalationFixed] = useState(0)

  // NEW: Escalation Preview Modal State
  const [isEscalationModalOpen, setIsEscalationModalOpen] = useState(false)
  const [suggestedNewRent, setSuggestedNewRent] = useState('')
  const[escalationEmailBody, setEscalationEmailBody] = useState('')
  const[isExecuting, setIsExecuting] = useState(false)

  useEffect(() => {
    async function fetchTenantData() {
      const { data: tData } = await supabase.from('tenants').select('*').eq('id', tenantId).single()
      if (tData) { setTenant(tData); setCoiDate(tData.coi_expiration || ''); }

      const { data: lData } = await supabase.from('leases').select('*, spaces(name, properties(name))').eq('tenant_id', tenantId).single()
      if (lData) {
        setLease(lData); setBaseRent(lData.base_rent_amount || 0); setCamCharge(lData.cam_charge || 0);
        setTaxCharge(lData.tax_charge || 0); setInsCharge(lData.insurance_charge || 0);
        setEscalationDate(lData.next_escalation_date || ''); 
        setEscalationType(lData.escalation_type || 'percentage');
        setEscalationPct(lData.escalation_percentage || 0);
        setEscalationFixed(lData.escalation_fixed_amount || 0);
      }

      const { data: iData } = await supabase.from('tenant_invoices').select('*').eq('tenant_id', tenantId).order('due_date', { ascending: false })
      if (iData) setInvoices(iData)
      const { data: cData } = await supabase.from('communications').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
      if (cData) setComps(cData)
      const { data: tkData } = await supabase.from('tasks').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
      if (tkData) setTasks(tkData)
    }
    fetchTenantData()
  },[tenantId])

  async function saveProfile() {
    setIsSaving(true)
    try {
      await supabase.from('tenants').update({ coi_expiration: coiDate || null }).eq('id', tenantId)
      if (lease) {
        await supabase.from('leases').update({
          base_rent_amount: baseRent, cam_charge: camCharge, tax_charge: taxCharge, insurance_charge: insCharge,
          next_escalation_date: escalationDate || null, escalation_type: escalationType,
          escalation_percentage: escalationType === 'percentage' ? escalationPct : 0,
          escalation_fixed_amount: escalationType === 'fixed' ? escalationFixed : 0
        }).eq('id', lease.id)
      }
      alert("Profile and Financials Updated!")
    } catch (error: any) { alert("Error: " + error.message) } finally { setIsSaving(false) }
  }

  // NEW: Opens the modal, calculates the math, and drafts the email
  function openEscalationModal() {
    const currentRent = Number(baseRent);
    let newRent = currentRent;

    if (escalationType === 'percentage') {
      newRent = currentRent + (currentRent * (Number(escalationPct) / 100));
    } else if (escalationType === 'fixed') {
      newRent = Number(escalationFixed);
    }

    setSuggestedNewRent(newRent.toFixed(2));

    const draftEmail = `Hello ${tenant?.name},\n\nThis is an official notice regarding your lease at ${lease?.spaces?.properties?.name}.\n\nPer the terms of your agreement, your monthly Base Rent is scheduled to escalate on ${escalationDate}.\n\nYour new Base Rent amount will be $${newRent.toFixed(2)}.\n\nThis new amount will be reflected on your next invoice. You can view your ledger at any time in your secure portal: https://app.ophircre.com/portal-login\n\nThank you,\nOphirCRE Management`;
    
    setEscalationEmailBody(draftEmail);
    setIsEscalationModalOpen(true);
  }

  // NEW: Executes the final approved numbers
  async function executeEscalation() {
    setIsExecuting(true);
    try {
      const finalRent = Number(suggestedNewRent);

      // 1. Update the database
      await supabase.from('leases').update({
        base_rent_amount: finalRent,
        next_escalation_date: null // Clear it so it doesn't fire again
      }).eq('id', lease.id);

      // 2. Email the Tenant
      if (tenant.contact_email) {
        await fetch('/api/send-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: tenant.contact_email,
            subject: "Official Notice: Rent Escalation",
            text: escalationEmailBody
          })
        });
        
        // Log communication
        await supabase.from('communications').insert([{ tenant_id: tenant.id, subject: 'Official Notice: Rent Escalation', body: escalationEmailBody, type: 'Email', status: 'Sent' }]);
      }

      alert(`Escalation Executed! Rent increased to $${finalRent.toFixed(2)}.`);
      setBaseRent(finalRent);
      setEscalationDate('');
      setIsEscalationModalOpen(false);
    } catch (error: any) {
      alert("Error executing escalation: " + error.message);
    } finally {
      setIsExecuting(false);
    }
  }

  if (!tenant) return <div className="p-8 text-gray-500">Loading Tenant 360 Profile...</div>

  const unpaidBalance = invoices.filter(i => i.status !== 'Paid').reduce((sum, i) => sum + Number(i.amount), 0)

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <div>
          <a href="/tenants" className="text-sm text-blue-600 hover:underline mb-1 inline-block">← Back to Directory</a>
          <h2 className="text-2xl font-bold text-gray-800">{tenant.name}</h2>
        </div>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setActiveTab('lease')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'lease' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Profile & Lease</button>
          <button onClick={() => setActiveTab('ledger')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'ledger' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Billing Ledger</button>
          <button onClick={() => setActiveTab('comms')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'comms' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Comms & Tickets</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100 relative">
        {activeTab === 'lease' && (
          <div className="flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0">
            <div className="w-full md:w-1/3 space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Contact & Compliance</h3>
                <div className="space-y-3 text-sm mb-4">
                  <p><span className="text-gray-500 block">Email:</span> <span className="font-medium">{tenant.contact_email || 'N/A'}</span></p>
                  <p><span className="text-gray-500 block">Phone:</span> <span className="font-medium">{tenant.contact_phone || 'N/A'}</span></p>
                </div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">COI Expiration Date</label><input type="date" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={coiDate} onChange={(e) => setCoiDate(e.target.value)} /></div>
              </div>
              {lease && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                  <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Location</h3>
                  <div className="space-y-3 text-sm">
                    <p><span className="text-gray-500 block">Property:</span> <span className="font-bold text-blue-600">{lease.spaces?.properties?.name}</span></p>
                    <p><span className="text-gray-500 block">Space / Suite:</span> <span className="font-medium">{lease.spaces?.name}</span></p>
                    <p><span className="text-gray-500 block">Lease Term:</span> <span className="font-medium">{lease.start_date} to {lease.end_date}</span></p>
                  </div>
                </div>
              )}
            </div>

            <div className="w-full md:w-2/3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
              <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Lease Financials & Escalations</h3>
              {lease ? (
                <div className="space-y-6 max-w-md">
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Monthly Charges</h4>
                    <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Base Rent</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right font-bold" value={baseRent} onChange={(e) => setBaseRent(Number(e.target.value))} /></div></div>
                    <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">CAM Escrow</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={camCharge} onChange={(e) => setCamCharge(Number(e.target.value))} /></div></div>
                    <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Tax Escrow</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={taxCharge} onChange={(e) => setTaxCharge(Number(e.target.value))} /></div></div>
                    <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Insurance Escrow</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right" value={insCharge} onChange={(e) => setInsCharge(Number(e.target.value))} /></div></div>
                  </div>
                  
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Rent Escalation Rules</h4>
                    <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Next Bump Date</label><input type="date" className="border p-2 rounded w-40 outline-none focus:ring-2 focus:ring-blue-500" value={escalationDate} onChange={(e) => setEscalationDate(e.target.value)} /></div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Bump Type</label>
                      <select className="border p-2 rounded w-40 outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={escalationType} onChange={(e) => setEscalationType(e.target.value)}>
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount ($)</option>
                      </select>
                    </div>
                    {escalationType === 'percentage' ? (
                      <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">Increase By</label><div className="relative"><input type="number" step="0.1" className="border p-2 pr-6 rounded w-32 text-right outline-none focus:ring-2 focus:ring-blue-500" value={escalationPct} onChange={(e) => setEscalationPct(Number(e.target.value))} /><span className="absolute right-3 top-2 text-gray-500">%</span></div></div>
                    ) : (
                      <div className="flex items-center justify-between"><label className="text-sm font-medium text-gray-700">New Total Base Rent</label><div className="relative"><span className="absolute left-3 top-2 text-gray-500">$</span><input type="number" className="border p-2 pl-6 rounded w-32 text-right outline-none focus:ring-2 focus:ring-blue-500" value={escalationFixed} onChange={(e) => setEscalationFixed(Number(e.target.value))} /></div></div>
                    )}
                    
                    {escalationDate && (
                      <button onClick={openEscalationModal} className="w-full mt-2 py-2 rounded font-bold text-white bg-orange-500 hover:bg-orange-600 transition shadow-sm">
                        ⚡ Review & Execute Escalation
                      </button>
                    )}
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

        {/* NEW: ESCALATION PREVIEW MODAL */}
        {isEscalationModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl">
              <h3 className="text-xl font-bold mb-2 text-gray-800">Review Rent Escalation</h3>
              <p className="text-sm text-gray-500 mb-6">The system has calculated the new rent based on the lease rules. You can amend the final amount or the notice email below before sending.</p>
              
              <div className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 flex justify-between items-center">
                  <span className="font-bold text-orange-800">Calculated New Base Rent:</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 font-bold">$</span>
                    <input 
                      type="number" 
                      className="border-2 border-orange-300 p-2 pl-6 rounded w-32 text-right font-black text-orange-900 outline-none focus:ring-2 focus:ring-orange-500 bg-white" 
                      value={suggestedNewRent} 
                      onChange={(e) => setSuggestedNewRent(e.target.value)} 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Notice Email to Tenant</label>
                  <textarea 
                    className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-48 resize-none text-sm font-serif" 
                    value={escalationEmailBody} 
                    onChange={(e) => setEscalationEmailBody(e.target.value)} 
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6 mt-4 border-t">
                <button onClick={() => setIsEscalationModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                <button onClick={executeEscalation} disabled={isExecuting} className={`px-6 py-2 rounded font-bold text-white transition shadow-sm ${isExecuting ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>
                  {isExecuting ? 'Executing...' : 'Confirm & Send Notice'}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  )
}