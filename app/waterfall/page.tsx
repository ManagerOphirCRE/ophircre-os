"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function WaterfallPage() {
  const [investors, setInvestors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Waterfall Assumptions
  const[distributableCash, setDistributableCash] = useState(100000);
  const[prefReturnPct, setPrefReturnPct] = useState(8.0);
  const [lpSplit, setLpSplit] = useState(70);
  const [gpSplit, setGpSplit] = useState(30);

  // Results
  const [results, setResults] = useState<any[]>([]);
  const[gpTotal, setGpTotal] = useState(0);
  const [lpTotal, setLpTotal] = useState(0);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase.from('investors').select('*').order('is_gp', { ascending: true });
      if (data) setInvestors(data);
      setIsLoading(false);
    }
    fetchData();
  },[]);

  function calculateWaterfall() {
    let remainingCash = distributableCash;
    let totalToLPs = 0;
    let totalToGPs = 0;
    const calcResults: any[] =[];

    // 1. Calculate Total LP Capital
    const lps = investors.filter(i => !i.is_gp);
    const gps = investors.filter(i => i.is_gp);
    const totalLpCapital = lps.reduce((sum, lp) => sum + Number(lp.capital_invested || 0), 0);

    // 2. Tier 1: Preferred Return to LPs
    const totalPrefRequired = totalLpCapital * (prefReturnPct / 100);
    let prefDistributed = 0;

    if (remainingCash >= totalPrefRequired) {
      prefDistributed = totalPrefRequired;
      remainingCash -= totalPrefRequired;
    } else {
      prefDistributed = remainingCash;
      remainingCash = 0;
    }

    // 3. Tier 2: Profit Split (Remaining Cash)
    const lpProfitShare = remainingCash * (lpSplit / 100);
    const gpProfitShare = remainingCash * (gpSplit / 100);

    // 4. Assign to individual LPs based on their pro-rata capital
    lps.forEach(lp => {
      const capital = Number(lp.capital_invested || 0);
      const proRata = totalLpCapital > 0 ? capital / totalLpCapital : 0;
      
      const myPref = prefDistributed * proRata;
      const myProfit = lpProfitShare * proRata;
      const myTotal = myPref + myProfit;
      
      totalToLPs += myTotal;

      calcResults.push({
        name: lp.name,
        type: 'LP',
        capital: capital,
        pref: myPref,
        profit: myProfit,
        total: myTotal
      });
    });

    // 5. Assign to GPs
    gps.forEach(gp => {
      // Assuming GP gets the entire promote split (can be divided if multiple GPs)
      const myTotal = gpProfitShare / (gps.length || 1);
      totalToGPs += myTotal;

      calcResults.push({
        name: gp.name,
        type: 'GP (Sponsor)',
        capital: Number(gp.capital_invested || 0),
        pref: 0,
        profit: myTotal,
        total: myTotal
      });
    });

    setResults(calcResults);
    setLpTotal(totalToLPs);
    setGpTotal(totalToGPs);
  }

  if (isLoading) return <div className="p-8 text-gray-500">Loading Investor Data...</div>;

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center print:hidden">
        <h2 className="text-xl font-semibold text-gray-800">Waterfall Distribution Modeler</h2>
        <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded-md font-medium shadow-sm">🖨️ Print Report</button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100 print:bg-white print:p-0">
        
        <div className="bg-slate-900 rounded-xl shadow-sm p-6 mb-8 flex flex-col md:flex-row md:space-x-8 space-y-4 md:space-y-0 text-white print:hidden">
          <div>
            <h3 className="font-bold text-slate-300 text-sm uppercase tracking-wider mb-2">Distributable Cash</h3>
            <div className="relative">
              <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
              <input type="number" className="bg-slate-800 border border-slate-700 p-2 pl-6 rounded text-white outline-none w-40 font-bold text-green-400" value={distributableCash} onChange={(e) => setDistributableCash(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <h3 className="font-bold text-slate-300 text-sm uppercase tracking-wider mb-2">Tier 1: Pref Return</h3>
            <div className="relative">
              <input type="number" step="0.1" className="bg-slate-800 border border-slate-700 p-2 pr-6 rounded text-white outline-none w-24" value={prefReturnPct} onChange={(e) => setPrefReturnPct(Number(e.target.value))} />
              <span className="absolute right-3 top-2 text-slate-400">%</span>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-slate-300 text-sm uppercase tracking-wider mb-2">Tier 2: Profit Split (LP / GP)</h3>
            <div className="flex items-center space-x-2">
              <input type="number" className="bg-slate-800 border border-slate-700 p-2 rounded text-white outline-none w-20 text-center" value={lpSplit} onChange={(e) => { setLpSplit(Number(e.target.value)); setGpSplit(100 - Number(e.target.value)); }} />
              <span className="text-slate-500 font-bold">/</span>
              <input type="number" className="bg-slate-800 border border-slate-700 p-2 rounded text-white outline-none w-20 text-center" value={gpSplit} readOnly />
            </div>
          </div>
          <div className="flex items-end">
            <button onClick={calculateWaterfall} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold transition shadow-sm h-[42px]">Calculate Splits</button>
          </div>
        </div>

        {results.length > 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total to LPs</p>
                <p className="text-3xl font-black text-blue-600 mt-2">${lpTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
                <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total to GP (Promote)</p>
                <p className="text-3xl font-black text-green-600 mt-2">${gpTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 bg-gray-50 border-b border-gray-200"><h3 className="font-bold text-gray-800">Distribution Schedule</h3></div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Investor</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Class</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Capital Invested</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Pref Return</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Profit Split</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-900 uppercase">Total Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {results.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{r.name}</td>
                      <td className="px-6 py-4 text-sm"><span className={`px-2 py-1 rounded text-xs font-bold ${r.type === 'LP' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{r.type}</span></td>
                      <td className="px-6 py-4 text-sm text-right text-gray-500">${r.capital.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">${r.pref.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">${r.profit.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                      <td className="px-6 py-4 text-sm text-right font-black text-gray-900">${r.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}