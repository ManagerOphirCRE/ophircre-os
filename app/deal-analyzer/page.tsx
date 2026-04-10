"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function DealAnalyzerPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const[omFile, setOmFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Underwriting Assumptions (Global for comparison)
  const [downPaymentPct, setDownPaymentPct] = useState(25);
  const [interestRate, setInterestRate] = useState(6.5);

  useEffect(function loadDeals() {
    async function fetchDeals() {
      const { data } = await supabase.from('deals').select('*').order('created_at', { ascending: false });
      if (data) setDeals(data);
    }
    fetchDeals();
  },[]);

  async function handleScanOM() {
    if (!omFile) return alert("Please select an OM PDF or Image.");
    setIsScanning(true);
    try {
      const formData = new FormData(); formData.append('file', omFile);
      const res = await fetch('/api/scan-deal', { method: 'POST', body: formData });
      const extractedData = await res.json();
      if (!res.ok) throw new Error(extractedData.error);

      await supabase.from('deals').insert([{
        property_name: extractedData.property_name || 'Unknown Property',
        asking_price: Number(extractedData.asking_price || 0),
        noi: Number(extractedData.noi || 0),
        cap_rate: Number(extractedData.cap_rate || 0),
        price_per_sqft: Number(extractedData.price_per_sqft || 0),
        notes: extractedData.notes || ''
      }]);
      
      alert("Deal successfully analyzed!"); setOmFile(null);
      const { data } = await supabase.from('deals').select('*').order('created_at', { ascending: false });
      if (data) setDeals(data);
    } catch (error: any) { alert("AI Error: " + error.message); } finally { setIsScanning(false); }
  }

  async function deleteDeal(id: string) {
    if (!confirm("Remove this deal?")) return;
    await supabase.from('deals').delete().eq('id', id);
    const { data } = await supabase.from('deals').select('*').order('created_at', { ascending: false });
    if (data) setDeals(data);
  }

  // Standard PMT Formula for Annual Debt Service (30 Year Amortization)
  function calculateAnnualDebtService(principal: number, rate: number) {
    if (principal <= 0 || rate <= 0) return 0;
    const monthlyRate = (rate / 100) / 12;
    const numPayments = 360; // 30 years
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    return monthlyPayment * 12;
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Acquisitions & Underwriting</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row items-center justify-between">
          <div className="mb-4 md:mb-0">
            <h3 className="font-bold text-gray-800">Upload Offering Memorandum (OM)</h3>
            <p className="text-sm text-gray-500">Upload a broker PDF or pro-forma image. The AI will extract the financials.</p>
          </div>
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <input type="file" accept=".pdf,image/*" onChange={(e) => setOmFile(e.target.files?.[0] || null)} className="border p-2 rounded-md text-sm w-full md:w-auto" />
            <button onClick={handleScanOM} disabled={isScanning || !omFile} className={`px-6 py-2 rounded-md font-bold text-white transition shadow-sm whitespace-nowrap ${isScanning || !omFile ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
              {isScanning ? '🤖 Analyzing...' : '✨ Analyze OM'}
            </button>
          </div>
        </div>

        {/* Global Underwriting Assumptions */}
        <div className="bg-slate-900 rounded-xl shadow-sm p-6 mb-8 flex space-x-8 text-white">
          <div>
            <h3 className="font-bold text-slate-300 text-sm uppercase tracking-wider mb-2">Financing Assumptions</h3>
            <div className="flex space-x-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Down Payment (%)</label>
                <input type="number" className="bg-slate-800 border border-slate-700 p-2 rounded text-white outline-none w-24" value={downPaymentPct} onChange={(e) => setDownPaymentPct(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Interest Rate (%)</label>
                <input type="number" step="0.1" className="bg-slate-800 border border-slate-700 p-2 rounded text-white outline-none w-24" value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deals.map(deal => {
            const askingPrice = Number(deal.asking_price);
            const noi = Number(deal.noi);
            
            // Underwriting Math
            const downPaymentAmount = askingPrice * (downPaymentPct / 100);
            const loanAmount = askingPrice - downPaymentAmount;
            const annualDebtService = calculateAnnualDebtService(loanAmount, interestRate);
            const netCashFlow = noi - annualDebtService;
            const cashOnCash = downPaymentAmount > 0 ? (netCashFlow / downPaymentAmount) * 100 : 0;

            const isGoodDeal = cashOnCash >= 8.0; // Rule of thumb: 8% CoC is solid

            return (
              <div key={deal.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-800 text-white flex justify-between items-start">
                  <h4 className="font-bold text-lg leading-tight">{deal.property_name}</h4>
                  <button onClick={() => deleteDeal(deal.id)} className="text-slate-400 hover:text-red-400 text-xl leading-none">&times;</button>
                </div>
                
                <div className="p-6 flex-1 space-y-4">
                  <div className="flex justify-between items-end border-b pb-2"><span className="text-sm text-gray-500 font-medium">Asking Price</span><span className="text-xl font-black text-gray-900">${askingPrice.toLocaleString()}</span></div>
                  <div className="flex justify-between items-end border-b pb-2"><span className="text-sm text-gray-500 font-medium">NOI</span><span className="text-lg font-bold text-gray-900">${noi.toLocaleString()}</span></div>
                  <div className="flex justify-between items-end border-b pb-2"><span className="text-sm text-gray-500 font-medium">Cap Rate</span><span className="text-lg font-bold text-gray-900">{deal.cap_rate}%</span></div>
                  
                  {/* LIVE UNDERWRITING RESULTS */}
                  <div className="pt-4 mt-4 border-t-2 border-dashed border-gray-200 space-y-2">
                    <h5 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Pro-Forma (Yr 1)</h5>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Cash Required:</span><span className="font-medium">${downPaymentAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Debt Service:</span><span className="font-medium text-red-600">-${annualDebtService.toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Net Cash Flow:</span><span className="font-bold text-green-600">${netCashFlow.toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
                    
                    <div className={`mt-4 p-3 rounded-lg flex justify-between items-center border ${isGoodDeal ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                      <span className={`text-sm font-bold ${isGoodDeal ? 'text-green-800' : 'text-orange-800'}`}>Cash-on-Cash:</span>
                      <span className={`text-xl font-black ${isGoodDeal ? 'text-green-600' : 'text-orange-600'}`}>{cashOnCash.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

      </main>
    </>
  );
}