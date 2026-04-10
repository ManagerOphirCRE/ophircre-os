"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function InvestorManagementPage() {
  const [investors, setInvestors] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Distribution State
  const [isDistModalOpen, setIsDistModalOpen] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<any>(null);
  const[distAmount, setDistAmount] = useState('');
  const [distMemo, setDistMemo] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // NEW: Capital Call State
  const[isCapCallModalOpen, setIsCapCallModalOpen] = useState(false);
  const[capCallAmount, setCapCallAmount] = useState('');
  const [capCallMemo, setCapCallMemo] = useState('');
  const[wiringInstructions, setWiringInstructions] = useState('');
  const [isSendingCapCall, setIsSendingCapCall] = useState(false);

  useEffect(() => { fetchData(); },[]);

  async function fetchData() {
    const { data: invData } = await supabase.from('investors').select('*').order('name');
    if (invData) setInvestors(invData);
    const { data: accData } = await supabase.from('chart_of_accounts').select('*');
    if (accData) setAccounts(accData);
    setIsLoading(false);
  }

  function openDistributionModal(investor: any) {
    setSelectedInvestor(investor);
    setDistMemo(`Q${Math.floor((new Date().getMonth() + 3) / 3)} Distribution`);
    setIsDistModalOpen(true);
  }

  async function recordDistribution(e: any) {
    e.preventDefault();
    setIsProcessing(true);
    try {
      await supabase.from('distributions').insert([{ investor_id: selectedInvestor.id, amount: Number(distAmount), date: new Date().toISOString().split('T')[0], memo: distMemo }]);
      const equityAcc = accounts.find(a => a.account_type === 'Equity')?.id;
      const { data: txnData, error: txnErr } = await supabase.from('transactions').insert([{ date: new Date().toISOString().split('T')[0], description: `Investor Distribution - ${selectedInvestor.name}`, total_amount: Number(distAmount), status: 'Approved' }]).select().single();
      if (txnErr) throw txnErr;
      await supabase.from('journal_entries').insert([{ transaction_id: txnData.id, account_id: equityAcc, description: distMemo, debit: Number(distAmount), credit: 0 }]);
      alert("Distribution recorded and synced to Ledger!");
      setIsDistModalOpen(false); setDistAmount('');
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsProcessing(false); }
  }

  async function uploadK1(event: any, investorId: string) {
    const file = event.target.files[0]; if (!file) return;
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `K1_${investorId}_${new Date().getFullYear()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('documents').getPublicUrl(fileName);
      await supabase.from('investors').update({ k1_document_url: data.publicUrl }).eq('id', investorId);
      alert("K-1 Tax Document uploaded securely!"); fetchData();
    } catch (error: any) { alert("Upload Error: " + error.message); }
  }

  // NEW: Capital Call Engine
  async function sendCapitalCall(e: any) {
    e.preventDefault();
    if (!confirm(`Are you sure you want to issue a $${Number(capCallAmount).toLocaleString()} Capital Call to all investors?`)) return;
    setIsSendingCapCall(true);

    try {
      const totalCall = Number(capCallAmount);
      let emailsSent = 0;

      for (const inv of investors) {
        const equityPct = Number(inv.portfolio_equity_percentage || 0);
        if (equityPct > 0 && inv.contact_email) {
          const investorShare = totalCall * (equityPct / 100);
          
          const emailBody = `Hello ${inv.name},\n\nOphirCRE is issuing a formal Capital Call for the following purpose:\n${capCallMemo}\n\nTotal Fund Raise: $${totalCall.toLocaleString(undefined, {minimumFractionDigits: 2})}\nYour Ownership Stake: ${equityPct.toFixed(2)}%\n\nYOUR REQUIRED CONTRIBUTION: $${investorShare.toLocaleString(undefined, {minimumFractionDigits: 2})}\n\nPlease wire your contribution using the instructions below within 10 business days:\n\n${wiringInstructions}\n\nThank you for your continued partnership,\nOphirCRE Management`;

          // Send Email
          await fetch('/api/send-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: inv.contact_email, subject: "URGENT: Official Capital Call Notice", text: emailBody })
          });

          // Log to Communications
          await supabase.from('communications').insert([{ tenant_id: null, subject: `Capital Call: ${inv.name}`, body: emailBody, type: 'Email', status: 'Sent' }]);
          emailsSent++;
        }
      }

      alert(`Capital Call successfully dispatched to ${emailsSent} investors!`);
      setIsCapCallModalOpen(false); setCapCallAmount(''); setCapCallMemo(''); setWiringInstructions('');
    } catch (error: any) {
      alert("Error sending Capital Call: " + error.message);
    } finally {
      setIsSendingCapCall(false);
    }
  }

  if (isLoading) return <div className="p-8 text-gray-500">Loading Investor Data...</div>;

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Investor & Fund Management</h2>
        <div className="space-x-3">
          <button onClick={() => setIsCapCallModalOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
            📢 Issue Capital Call
          </button>
          <button onClick={() => alert("In Phase 6, this opens the Add LP form.")} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
            + Add Investor
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-800">Limited Partners (LPs)</h3>
            <p className="text-sm text-gray-500">Manage equity, distributions, and tax documents.</p>
          </div>
          
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Investor Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Contact Email</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Fund Equity %</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Tax Docs (K-1)</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {investors.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-bold text-blue-600">{inv.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{inv.contact_email}</td>
                  <td className="px-6 py-4 text-sm text-center font-bold text-gray-900">{Number(inv.portfolio_equity_percentage).toFixed(2)}%</td>
                  <td className="px-6 py-4 text-center">
                    {inv.k1_document_url ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold">Uploaded ✓</span>
                    ) : (
                      <label className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded font-bold cursor-pointer transition">
                        Upload K-1
                        <input type="file" accept=".pdf" className="hidden" onChange={(e) => uploadK1(e, inv.id)} />
                      </label>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openDistributionModal(inv)} className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded font-bold transition shadow-sm">
                      Record Distribution
                    </button>
                  </td>
                </tr>
              ))}
              {investors.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No investors found.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* DISTRIBUTION MODAL */}
        {isDistModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-2 text-gray-800">Record Distribution</h3>
              <p className="text-sm text-gray-500 mb-6">Log a dividend payment to <strong>{selectedInvestor?.name}</strong>.</p>
              <form onSubmit={recordDistribution} className="space-y-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Distribution Amount ($)</label><input type="number" step="0.01" required className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-green-700" value={distAmount} onChange={(e) => setDistAmount(e.target.value)} /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-1">Memo / Period</label><input type="text" required className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={distMemo} onChange={(e) => setDistMemo(e.target.value)} /></div>
                <div className="flex justify-end space-x-3 pt-4 mt-2 border-t">
                  <button type="button" onClick={() => setIsDistModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" disabled={isProcessing} className={`px-6 py-2 rounded font-bold text-white transition shadow-sm ${isProcessing ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>{isProcessing ? 'Processing...' : 'Record & Sync Ledger'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* NEW: CAPITAL CALL MODAL */}
        {isCapCallModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl">
              <h3 className="text-2xl font-bold mb-2 text-orange-600">Issue Capital Call</h3>
              <p className="text-sm text-gray-600 mb-6">This will calculate each investor's pro-rata share based on their equity percentage and email them a formal funding request.</p>
              
              <form onSubmit={sendCapitalCall} className="space-y-4">
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <label className="block text-sm font-bold text-orange-900 mb-1">Total Target Raise Amount ($)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-orange-700 font-bold">$</span>
                    <input type="number" required className="w-full border-2 border-orange-300 p-3 pl-8 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 font-black text-orange-900 text-lg bg-white" placeholder="e.g., 1000000" value={capCallAmount} onChange={(e) => setCapCallAmount(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Purpose of Capital Call</label>
                  <input type="text" required placeholder="e.g., Acquisition of Main Street Plaza" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={capCallMemo} onChange={(e) => setCapCallMemo(e.target.value)} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Wiring Instructions</label>
                  <textarea required placeholder="Bank Name: Chase&#10;Routing: 123456789&#10;Account: 987654321" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 h-32 resize-none font-mono text-sm" value={wiringInstructions} onChange={(e) => setWiringInstructions(e.target.value)} />
                </div>

                <div className="flex justify-end space-x-3 pt-4 mt-2 border-t">
                  <button type="button" onClick={() => setIsCapCallModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" disabled={isSendingCapCall} className={`px-6 py-2 rounded font-bold text-white transition shadow-sm ${isSendingCapCall ? 'bg-orange-400' : 'bg-orange-600 hover:bg-orange-700'}`}>
                    {isSendingCapCall ? 'Dispatching...' : 'Dispatch Capital Call Emails'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}