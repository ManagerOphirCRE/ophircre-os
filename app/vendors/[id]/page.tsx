"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useParams } from 'next/navigation';

export default function VendorProfilePage() {
  const params = useParams();
  const vendorId = params.id;

  const[vendor, setVendor] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [trade, setTrade] = useState('');
  const [email, setEmail] = useState('');
  const[coiDate, setCoiDate] = useState('');
  const [w9OnFile, setW9OnFile] = useState(false);

  useEffect(function loadVendor360() {
    async function fetchData() {
      const { data: vData } = await supabase.from('vendors').select('*').eq('id', vendorId).single();
      if (vData) {
        setVendor(vData);
        setCompanyName(vData.company_name || '');
        setTrade(vData.trade || '');
        setEmail(vData.contact_email || '');
        setCoiDate(vData.coi_expiration || '');
        setW9OnFile(vData.w9_on_file || false);
      }

      const { data: iData } = await supabase.from('vendor_submissions').select('*, properties(name)').eq('vendor_id', vendorId).order('created_at', { ascending: false });
      if (iData) setInvoices(iData);
    }
    fetchData();
  }, [vendorId]);

  async function saveProfile() {
    setIsSaving(true);
    try {
      await supabase.from('vendors').update({
        company_name: companyName, trade, contact_email: email, coi_expiration: coiDate || null, w9_on_file: w9OnFile
      }).eq('id', vendorId);
      alert("Vendor Profile Updated!");
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSaving(false); }
  }

  if (!vendor) return <div className="p-8 text-gray-500">Loading Vendor Profile...</div>;

  const ytdPaid = invoices.filter(i => i.status === 'Paid').reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <div>
          <a href="/vendors" className="text-sm text-blue-600 hover:underline mb-1 inline-block">← Back to Directory</a>
          <h2 className="text-2xl font-bold text-gray-800">{vendor.company_name}</h2>
        </div>
        <button onClick={saveProfile} disabled={isSaving} className={`px-6 py-2 rounded-md font-bold text-white transition shadow-sm ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
          {isSaving ? 'Saving...' : 'Save Profile'}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex flex-col md:flex-row md:space-x-6 space-y-6 md:space-y-0 bg-gray-100">
        
        {/* LEFT COLUMN: Profile & Compliance */}
        <div className="w-full md:w-1/3 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Vendor Details</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label><input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Trade / Specialty</label><input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={trade} onChange={(e) => setTrade(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Portal Email</label><input type="email" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Compliance (1099 & COI)</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                <span className="text-sm font-bold text-gray-700">W9 Form on File?</span>
                <input type="checkbox" className="w-5 h-5 text-blue-600 rounded cursor-pointer" checked={w9OnFile} onChange={(e) => setW9OnFile(e.target.checked)} />
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">COI Expiration Date</label><input type="date" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={coiDate} onChange={(e) => setCoiDate(e.target.value)} /></div>
              <div className="pt-4 border-t mt-4">
                <span className="text-sm text-gray-500 block">YTD Paid (1099 Threshold: $600)</span>
                <span className={`text-2xl font-black ${ytdPaid >= 600 ? 'text-orange-600' : 'text-green-600'}`}>${ytdPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Submission History */}
        <div className="w-full md:w-2/3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
          <div className="p-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Submission & Invoice History</h3>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Property</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.properties?.name || 'General'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{inv.submission_type}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-gray-900">{inv.amount ? `$${Number(inv.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === 'Paid' || inv.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{inv.status}</span>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No submissions found.</td></tr>}
            </tbody>
          </table>
        </div>

      </main>
    </>
  );
}