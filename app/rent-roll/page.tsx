"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { BarChart, Bar, Tooltip, ResponsiveContainer } from 'recharts';

export default function RentRollPage() {
  const [leases, setLeases] = useState<any[]>([]);
  const [totalBaseRent, setTotalBaseRent] = useState(0);
  const [totalEscrows, setTotalEscrows] = useState(0);
  const [walt, setWalt] = useState(0);
  const [expirationData, setExpirationData] = useState<any[]>([]);

  useEffect(function loadRentRoll() {
    fetchRentRoll();
  },[]);

  async function fetchRentRoll() {
    const { data } = await supabase.from('leases').select('*, tenants(name, status, contact_email), spaces(name, square_footage, properties(name))').order('end_date', { ascending: true });
    if (data) {
      const activeLeases = data.filter(l => l.tenants?.status === 'active');
      setLeases(activeLeases);
      setTotalBaseRent(activeLeases.reduce((sum, l) => sum + Number(l.base_rent_amount || 0), 0));
      setTotalEscrows(activeLeases.reduce((sum, l) => sum + Number(l.cam_charge || 0) + Number(l.tax_charge || 0) + Number(l.insurance_charge || 0), 0));

      let totalWeight = 0; let totalSqft = 0; const expMap: Record<string, number> = {};
      const today = new Date();

      activeLeases.forEach(l => {
        const sqft = Number(l.spaces?.square_footage || 0);
        const endDate = new Date(l.end_date);
        const remainingYears = (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (remainingYears > 0 && sqft > 0) { totalWeight += (remainingYears * sqft); totalSqft += sqft; }
        const expYear = endDate.getFullYear().toString();
        if (!expMap[expYear]) expMap[expYear] = 0;
        expMap[expYear] += sqft;
      });
      if (totalSqft > 0) setWalt(totalWeight / totalSqft);
      setExpirationData(Object.keys(expMap).sort().map(year => ({ year, sqft: expMap[year] })));
    }
  }

  // NEW: The 1-Click Renewal Engine
  async function sendRenewalOffer(lease: any) {
    const currentRent = Number(lease.base_rent_amount || 0);
    const suggestedRent = Math.round(currentRent * 1.05); // Default 5% bump
    
    const offerAmount = prompt(`Enter the new monthly rent offer for ${lease.tenants?.name}:\n(Current Rent: $${currentRent} | Suggested 5% Bump: $${suggestedRent})`, suggestedRent.toString());
    if (!offerAmount) return;

    try {
      // 1. Update the lease status
      await supabase.from('leases').update({ renewal_status: 'Offered', renewal_offer_rent: Number(offerAmount) }).eq('id', lease.id);

      // 2. Email the tenant via SendGrid
      if (lease.tenants?.contact_email) {
        await fetch('/api/send-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: lease.tenants.contact_email,
            subject: "ACTION REQUIRED: Lease Renewal Offer",
            text: `Hello ${lease.tenants.name},\n\nYour lease at ${lease.spaces?.properties?.name} is expiring soon.\n\nWe would love to extend your tenancy for another 12 months at a new base rent of $${offerAmount}/mo.\n\nPlease log into your secure portal to review and accept this offer:\nhttps://app.ophircre.com/portal-login\n\nThank you,\nOphirCRE Management`
          })
        });
      }
      alert("Renewal Offer Sent to Tenant Portal!");
      fetchRentRoll();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center print:hidden">
        <h2 className="text-xl font-semibold text-gray-800">Master Rent Roll & Analytics</h2>
        <button onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">🖨️ Print Report</button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100 print:bg-white print:p-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 print:hidden">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Total Monthly Revenue</h3><p className="text-3xl font-black text-green-600 mt-2">${(totalBaseRent + totalEscrows).toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Portfolio WALT</h3><p className="text-3xl font-black text-blue-600 mt-2">{walt.toFixed(2)} Years</p></div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-32"><h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-2">Expiration Schedule (SqFt)</h3><ResponsiveContainer width="100%" height="100%"><BarChart data={expirationData}><Tooltip cursor={{fill: '#f8fafc'}} /><Bar dataKey="sqft" fill="#3b82f6" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
          <div className="p-6 bg-gray-50 border-b flex justify-between items-center"><h3 className="font-bold text-gray-800">Active Leases ({leases.length})</h3></div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Property & Space</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Lease Term</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Base Rent</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase">Total Monthly</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leases.map(l => {
                const escrows = Number(l.cam_charge || 0) + Number(l.tax_charge || 0) + Number(l.insurance_charge || 0);
                const total = Number(l.base_rent_amount || 0) + escrows;
                const isExpiringSoon = new Date(l.end_date) < new Date(new Date().setDate(new Date().getDate() + 90));

                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-bold text-blue-600">{l.tenants?.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{l.spaces?.properties?.name} <br/><span className="text-gray-500 text-xs">{l.spaces?.name}</span></td>
                    <td className="px-6 py-4 text-sm text-gray-500">{l.start_date} to <span className={isExpiringSoon ? 'text-red-600 font-bold' : ''}>{l.end_date}</span></td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">${Number(l.base_rent_amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-green-700">${total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    <td className="px-6 py-4 text-right print:hidden">
                      {isExpiringSoon && l.renewal_status === 'None' && (
                        <button onClick={() => sendRenewalOffer(l)} className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded font-bold transition shadow-sm">Offer Renewal</button>
                      )}
                      {l.renewal_status === 'Offered' && <span className="text-xs text-orange-600 font-bold">Offer Pending</span>}
                      {l.renewal_status === 'Accepted' && <span className="text-xs text-green-600 font-bold">Renewed ✓</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}