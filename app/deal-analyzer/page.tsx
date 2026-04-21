"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function DealAnalyzerPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [omFile, setOmFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const[downPaymentPct, setDownPaymentPct] = useState(25);
  const [interestRate, setInterestRate] = useState(6.5);
  const [rentGrowth, setRentGrowth] = useState(3.0); // 3% annual growth
  const [exitCapRate, setExitCapRate] = useState(6.5); // Year 5 Exit

  useEffect(() => {
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

  async function acquireDeal(deal: any) {
    if (!confirm(`Acquire ${deal.property_name}?`)) return;
    try {
      await supabase.from('properties').insert([{ name: deal.property_name, purchase_price: deal.asking_price, current_value: deal.asking_price }]);
      await supabase.from('deals').delete().eq('id', deal.id);
      alert("Asset Acquired!");
      const { data } = await supabase.from('deals').select('*').order('created_at', { ascending: false });
      if (data) setDeals(data);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  function calculateAnnualDebtService(principal: number, rate: number) {
    if (principal <= 0 || rate <= 0) return 0;
    const monthlyRate = (rate / 100) / 12;
    return (principal * (monthlyRate * Math.pow(1 + monthlyRate, 360)) / (Math.pow(1 + monthlyRate, 360) - 1)) * 12;
  }

  function printProForma(deal: any, downPmt: number, loan: number, ads: number, y1Noi: number, y5Noi: number, exitValue: number, equityMult: number) {
    let html = `<html><head><title>Pro-Forma - ${deal.property_name}</title><style>body{font-family:sans-serif;padding:40px;color:#333;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border-bottom:1px solid #ddd;padding:12px;text-align:left;} th{background:#f9fafb;} .header{text-align:center;margin-bottom:40px;border-bottom:2px solid #1e293b;padding-bottom:20px;} .highlight{background:#f0fdf4;font-weight:bold;}</style></head><body>`;
    html += `<div class="header"><h2>OphirCRE Acquisitions</h2><h1>5-Year DCF Pro-Forma</h1><p><strong>Asset:</strong> ${deal.property_name}</p></div>`;
    html += `<h3>Executive Summary</h3><p>${deal.notes}</p>`;
    html += `<table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody><tr><td>Asking Price</td><td>$${Number(deal.asking_price).toLocaleString()}</td></tr><tr><td>Going-In Cap Rate</td><td>${deal.cap_rate}%</td></tr></tbody></table>`;
    html += `<h3 style="margin-top:40px;">5-Year Projection (Assumes ${rentGrowth}% Annual Growth)</h3>`;
    html += `<table><thead><tr><th>Year</th><th>Projected NOI</th><th>Debt Service</th><th>Net Cash Flow</th></tr></thead><tbody>`;
    let currentNoi = y1Noi;
    for(let i=1; i<=5; i++) {
      html += `<tr><td>Year ${i}</td><td>$${currentNoi.toLocaleString(undefined,{maximumFractionDigits:0})}</td><td style="color:red;">-$${ads.toLocaleString(undefined,{maximumFractionDigits:0})}</td><td style="color:green;">$${(currentNoi - ads).toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>`;
      currentNoi = currentNoi * (1 + (rentGrowth/100));
    }
    html += `</tbody></table>`;
    html += `<h3 style="margin-top:40px;">Exit Analysis (Year 5)</h3>`;
    html += `<table><tbody><tr><td>Exit Cap Rate</td><td>${exitCapRate}%</td></tr><tr><td>Projected Sale Price</td><td>$${exitValue.toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr><tr class="highlight"><td>Equity Multiple</td><td style="color:green;">${equityMult.toFixed(2)}x</td></tr></tbody></table></body></html>`;
    const printWindow = window.open('', '_blank'); printWindow?.document.write(html); printWindow?.document.close(); printWindow?.print();
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Acquisitions & 5-Year DCF Modeler</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row items-center justify-between">
          <div className="mb-4 md:mb-0"><h3 className="font-bold text-gray-800">Upload Offering Memorandum (OM)</h3><p className="text-sm text-gray-500">Upload a broker PDF. The AI will extract the financials.</p></div>
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <input type="file" accept=".pdf,image/*" onChange={(e) => setOmFile(e.target.files?.[0] || null)} className="border p-2 rounded-md text-sm w-full md:w-auto" />
            <button onClick={handleScanOM} disabled={isScanning || !omFile} className={`px-6 py-2 rounded-md font-bold text-white transition shadow-sm whitespace-nowrap ${isScanning || !omFile ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
              {isScanning ? '🤖 Analyzing...' : '✨ Analyze OM'}
            </button>
          </div>
        </div>

        <div className="bg-slate-900 rounded-xl shadow-sm p-6 mb-8 flex flex-col md:flex-row md:space-x-8 space-y-4 md:space-y-0 text-white">
          <div><h3 className="font-bold text-slate-300 text-sm uppercase tracking-wider mb-2">Financing</h3><div className="flex space-x-4"><div><label className="block text-xs text-slate-400 mb-1">Down Payment (%)</label><input type="number" className="bg-slate-800 border border-slate-700 p-2 rounded text-white outline-none w-24" value={downPaymentPct} onChange={(e) => setDownPaymentPct(Number(e.target.value))} /></div><div><label className="block text-xs text-slate-400 mb-1">Interest Rate (%)</label><input type="number" step="0.1" className="bg-slate-800 border border-slate-700 p-2 rounded text-white outline-none w-24" value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))} /></div></div></div>
          <div><h3 className="font-bold text-slate-300 text-sm uppercase tracking-wider mb-2">Projections</h3><div className="flex space-x-4"><div><label className="block text-xs text-slate-400 mb-1">Rent Growth (%)</label><input type="number" step="0.1" className="bg-slate-800 border border-slate-700 p-2 rounded text-white outline-none w-24" value={rentGrowth} onChange={(e) => setRentGrowth(Number(e.target.value))} /></div><div><label className="block text-xs text-slate-400 mb-1">Exit Cap Rate (%)</label><input type="number" step="0.1" className="bg-slate-800 border border-slate-700 p-2 rounded text-white outline-none w-24" value={exitCapRate} onChange={(e) => setExitCapRate(Number(e.target.value))} /></div></div></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deals.map(deal => {
            const askingPrice = Number(deal.asking_price);
            const y1Noi = Number(deal.noi);
            const downPaymentAmount = askingPrice * (downPaymentPct / 100);
            const loanAmount = askingPrice - downPaymentAmount;
            const ads = calculateAnnualDebtService(loanAmount, interestRate);
            
            // 5-Year DCF Math
            let totalCashFlow = 0;
            let currentNoi = y1Noi;
            for(let i=0; i<5; i++) { totalCashFlow += (currentNoi - ads); currentNoi = currentNoi * (1 + (rentGrowth/100)); }
            
            const y5Noi = currentNoi;
            const exitValue = y5Noi / (exitCapRate / 100);
            const loanPayoff = loanAmount; // Simplified: Assumes interest-only or minimal principal paydown for quick modeling
            const totalReturn = totalCashFlow + (exitValue - loanPayoff);
            const equityMult = downPaymentAmount > 0 ? (totalReturn / downPaymentAmount) : 0;

            return (
              <div key={deal.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-800 text-white flex justify-between items-start">
                  <h4 className="font-bold text-lg leading-tight">{deal.property_name}</h4>
                  <button onClick={() => deleteDeal(deal.id)} className="text-slate-400 hover:text-red-400 text-xl leading-none">&times;</button>
                </div>
                <div className="p-6 flex-1 space-y-4">
                  <div className="flex justify-between items-end border-b pb-2"><span className="text-sm text-gray-500 font-medium">Asking Price</span><span className="text-xl font-black text-gray-900">${askingPrice.toLocaleString()}</span></div>
                  <div className="flex justify-between items-end border-b pb-2"><span className="text-sm text-gray-500 font-medium">NOI (Yr 1)</span><span className="text-lg font-bold text-green-600">${y1Noi.toLocaleString()}</span></div>
                  <div className="flex justify-between items-end border-b pb-2"><span className="text-sm text-gray-500 font-medium">Going-In Cap</span><span className="text-lg font-bold text-gray-900">{deal.cap_rate}%</span></div>
                  
                  <div className="pt-4 mt-4 border-t-2 border-dashed border-gray-200 space-y-2">
                    <h5 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">5-Year DCF Projection</h5>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Cash Required:</span><span className="font-medium">${downPaymentAmount.toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Exit Value (Yr 5):</span><span className="font-medium">${exitValue.toLocaleString(undefined, {maximumFractionDigits:0})}</span></div>
                    <div className={`mt-4 p-3 rounded-lg flex justify-between items-center border ${equityMult >= 2.0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                      <span className={`text-sm font-bold ${equityMult >= 2.0 ? 'text-green-800' : 'text-orange-800'}`}>Equity Multiple:</span>
                      <span className={`text-xl font-black ${equityMult >= 2.0 ? 'text-green-600' : 'text-orange-600'}`}>{equityMult.toFixed(2)}x</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex space-x-2">
                  <button onClick={() => printProForma(deal, downPaymentAmount, loanAmount, ads, y1Noi, y5Noi, exitValue, equityMult)} className="bg-gray-800 hover:bg-black text-white px-3 py-2 rounded font-bold transition shadow-sm">🖨️ PDF</button>
                  <button onClick={() => acquireDeal(deal)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold transition shadow-sm">Acquire Asset ✓</button>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </>
  );
}