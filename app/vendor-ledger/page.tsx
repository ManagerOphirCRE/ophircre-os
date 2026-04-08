"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function VendorLedgerPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchVendorData();
  }, [year]);

  async function fetchVendorData() {
    setIsLoading(true);
    try {
      // 1. Fetch all vendors
      const { data: vData } = await supabase.from('vendors').select('*').order('company_name');
      if (!vData) return;

      // 2. Fetch all invoices for the selected year
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      
      const { data: iData } = await supabase
        .from('vendor_submissions')
        .select('*')
        .eq('submission_type', 'Invoice')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // 3. Calculate YTD Paid and Outstanding Balance for each vendor
      const vendorStats = vData.map(vendor => {
        const vendorInvoices = iData?.filter(i => i.vendor_id === vendor.id) ||[];
        
        const ytdPaid = vendorInvoices
          .filter(i => i.status === 'Paid')
          .reduce((sum, i) => sum + Number(i.amount || 0), 0);
          
        const outstandingBalance = vendorInvoices
          .filter(i => i.status !== 'Paid')
          .reduce((sum, i) => sum + Number(i.amount || 0), 0);

        return {
          ...vendor,
          ytdPaid,
          outstandingBalance,
          invoiceCount: vendorInvoices.length
        };
      });

      setVendors(vendorStats);
    } catch (error: any) {
      alert("Error fetching vendor data: " + error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleW9(id: string, currentValue: boolean) {
    await supabase.from('vendors').update({ w9_on_file: !currentValue }).eq('id', id);
    fetchVendorData();
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center print:hidden">
        <h2 className="text-xl font-semibold text-gray-800">Vendor Ledger & 1099 Tracking</h2>
        <div className="flex space-x-4 items-center">
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Fiscal Year:</label>
            <input type="number" className="border p-2 rounded outline-none w-24 text-sm" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
            🖨️ Print 1099 Report
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100 print:bg-white print:p-0">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
          <div className="p-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center print:bg-white print:border-b-2 print:border-gray-800">
            <h3 className="font-bold text-gray-800">Vendor Payment Summary ({year})</h3>
            <p className="text-sm text-gray-500 print:hidden">Track YTD payments to ensure 1099 compliance.</p>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-500">Loading vendor ledger...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Vendor Name</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Trade</th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">W9 on File</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Invoices ({year})</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Outstanding Balance</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase">YTD Paid</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vendors.map(v => {
                  // Highlight vendors who have been paid > $600 but don't have a W9
                  const needs1099Warning = v.ytdPaid >= 600 && !v.w9_on_file;

                  return (
                    <tr key={v.id} className={`hover:bg-gray-50 ${needs1099Warning ? 'bg-red-50 print:bg-white' : ''}`}>
                      <td className="px-6 py-4 text-sm font-bold text-blue-600">
                        {v.company_name}
                        {needs1099Warning && <span className="ml-2 text-xs text-red-600 font-bold print:hidden">⚠️ W9 REQUIRED</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{v.trade || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => toggleW9(v.id, v.w9_on_file)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition ${v.w9_on_file ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >
                          {v.w9_on_file ? 'Yes' : 'No'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-500">{v.invoiceCount}</td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-orange-600">
                        ${v.outstandingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-bold text-green-700">
                        ${v.ytdPaid.toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </td>
                    </tr>
                  )
                })}
                {vendors.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No vendors found.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}