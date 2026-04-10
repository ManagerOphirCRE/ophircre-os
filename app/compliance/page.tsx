"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function CompliancePage() {
  const [tenants, setTenants] = useState<any[]>([]);
  const[vendors, setVendors] = useState<any[]>([]);
  const [pendingCOIs, setPendingCOIs] = useState<any[]>([]);
  const [autoApprove, setAutoApprove] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchData(); },[]);

  async function fetchData() {
    const { data: tData } = await supabase.from('tenants').select('*').order('name');
    if (tData) setTenants(tData);
    const { data: vData } = await supabase.from('vendors').select('*').order('company_name');
    if (vData) setVendors(vData);
    const { data: cData } = await supabase.from('coi_submissions').select('*, tenants(name)').eq('status', 'Pending').order('created_at', { ascending: false });
    if (cData) setPendingCOIs(cData);
    const { data: sData } = await supabase.from('system_settings').select('*').eq('id', 1).single();
    if (sData) setAutoApprove(sData.auto_approve_coi);
    setIsLoading(false);
  }

  async function toggleAutoApprove() {
    const newValue = !autoApprove;
    await supabase.from('system_settings').update({ auto_approve_coi: newValue }).eq('id', 1);
    setAutoApprove(newValue);
    alert(newValue ? "AI Auto-Approve is ON. The system will now bypass human review." : "AI Auto-Approve is OFF. Human-in-the-loop required.");
  }

  async function approveCOI(coi: any) {
    try {
      await supabase.from('coi_submissions').update({ status: 'Approved' }).eq('id', coi.id);
      await supabase.from('tenants').update({ coi_expiration: coi.extracted_expiration }).eq('id', coi.tenant_id);
      alert("COI Approved and Tenant Record Updated!");
      fetchData();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function rejectCOI(coi: any) {
    await supabase.from('coi_submissions').update({ status: 'Rejected' }).eq('id', coi.id);
    fetchData();
  }

  function getStatus(dateString: string | null) {
    if (!dateString) return { label: 'Missing COI', color: 'bg-red-100 text-red-800' };
    const expDate = new Date(dateString); const today = new Date();
    const thirtyDaysFromNow = new Date(); thirtyDaysFromNow.setDate(today.getDate() + 30);
    if (expDate < today) return { label: 'Expired', color: 'bg-red-100 text-red-800' };
    if (expDate <= thirtyDaysFromNow) return { label: 'Expiring Soon', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Compliant', color: 'bg-green-100 text-green-800' };
  }

  if (isLoading) return <div className="p-8">Loading compliance data...</div>;

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Compliance & COI Tracker</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm font-bold text-gray-700 cursor-pointer bg-gray-100 p-2 rounded-lg border">
            <input type="checkbox" checked={autoApprove} onChange={toggleAutoApprove} className="w-4 h-4 text-blue-600 rounded" />
            <span>🤖 AI Auto-Approve COIs</span>
          </label>
          <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition">🖨️ Print Report</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        
        {/* PENDING AI REVIEWS */}
        {pendingCOIs.length > 0 && (
          <div className="mb-8 bg-orange-50 rounded-xl shadow-sm border border-orange-200 overflow-hidden">
            <div className="p-4 border-b border-orange-200 flex justify-between items-center">
              <h3 className="font-bold text-orange-900">⚠️ Pending AI COI Reviews ({pendingCOIs.length})</h3>
              <span className="text-xs text-orange-700 font-bold uppercase">Human-in-the-Loop Active</span>
            </div>
            <div className="p-4 space-y-4">
              {pendingCOIs.map(coi => (
                <div key={coi.id} className="bg-white p-4 rounded-lg border border-orange-100 flex justify-between items-center shadow-sm">
                  <div>
                    <h4 className="font-bold text-gray-900">{coi.tenants?.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>AI Extracted Liability:</strong> ${Number(coi.extracted_liability).toLocaleString()} <br/>
                      <strong>AI Extracted Expiration:</strong> {coi.extracted_expiration}
                    </p>
                    <a href={coi.file_url} target="_blank" className="text-xs text-blue-600 hover:underline mt-2 inline-block">📄 View Uploaded Document</a>
                  </div>
                  <div className="space-x-2">
                    <button onClick={() => rejectCOI(coi)} className="px-4 py-2 bg-red-100 text-red-700 rounded font-bold hover:bg-red-200">Reject</button>
                    <button onClick={() => approveCOI(coi)} className="px-4 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700">Approve & Update</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200"><h3 className="font-bold text-gray-800">Tenant Insurance (COI)</h3></div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white"><tr><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tenant Name</th><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Expiration Date</th><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {tenants.map(t => {
                  const status = getStatus(t.coi_expiration);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">{t.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.coi_expiration || 'Not on file'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${status.color}`}>{status.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200"><h3 className="font-bold text-gray-800">Vendor Insurance (COI)</h3></div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white"><tr><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Vendor Name</th><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Expiration Date</th><th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {vendors.map(v => {
                  const status = getStatus(v.coi_expiration);
                  return (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">{v.company_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{v.coi_expiration || 'Not on file'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${status.color}`}>{status.label}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}