"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('pnl');
  const [properties, setProperties] = useState<any[]>([]);
  const[selectedPropertyId, setSelectedPropertyId] = useState('ALL');
  
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [revenue, setRevenue] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const[totalRev, setTotalRev] = useState(0);
  const [totalExp, setTotalExp] = useState(0);

  const [t12Months, setT12Months] = useState<string[]>([]);
  const[t12Data, setT12Data] = useState<any>({ rev: {}, exp: {}, totals: {} });

  useEffect(() => { fetchProperties(); },[]);

  useEffect(() => {
    if (activeTab === 'pnl') generatePnL();
    if (activeTab === 't12') generateT12();
  },[selectedPropertyId, year, activeTab]);

  async function fetchProperties() {
    const { data } = await supabase.from('properties').select('*').order('name');
    if (data) setProperties(data);
  }

  async function generatePnL() {
    const startDate = `${year}-01-01`; const endDate = `${year}-12-31`;
    let query = supabase.from('journal_entries').select('debit, credit, chart_of_accounts(name, account_type), transactions(date)').gte('transactions.date', startDate).lte('transactions.date', endDate);
    if (selectedPropertyId !== 'ALL') query = query.eq('property_id', selectedPropertyId);
    
    const { data } = await query;
    if (data) {
      const revMap: Record<string, number> = {}; const expMap: Record<string, number> = {};
      data.forEach((entry: any) => {
        const accName = Array.isArray(entry.chart_of_accounts) ? entry.chart_of_accounts[0]?.name : entry.chart_of_accounts?.name;
        const accType = Array.isArray(entry.chart_of_accounts) ? entry.chart_of_accounts[0]?.account_type : entry.chart_of_accounts?.account_type;
        const amount = Math.abs(Number(entry.debit) || Number(entry.credit));
        if (accType?.toLowerCase() === 'revenue') revMap[accName] = (revMap[accName] || 0) + amount;
        else if (accType?.toLowerCase() === 'expense') expMap[accName] = (expMap[accName] || 0) + amount;
      });
      const revArray = Object.keys(revMap).map(k => ({ name: k, amount: revMap[k] }));
      const expArray = Object.keys(expMap).map(k => ({ name: k, amount: expMap[k] }));
      setRevenue(revArray); setExpenses(expArray);
      setTotalRev(revArray.reduce((sum, item) => sum + item.amount, 0));
      setTotalExp(expArray.reduce((sum, item) => sum + item.amount, 0));
    }
  }

  async function generateT12() {
    const months: string[] =[];
    const d = new Date();
    d.setDate(1); 
    for (let i = 11; i >= 0; i--) {
      const pastDate = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push(pastDate.toLocaleString('default', { month: 'short', year: 'numeric' }));
    }
    setT12Months(months);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    oneYearAgo.setDate(1);
    const startDate = oneYearAgo.toISOString().split('T')[0];

    let query = supabase.from('journal_entries').select('debit, credit, chart_of_accounts(name, account_type), transactions(date)').gte('transactions.date', startDate);
    if (selectedPropertyId !== 'ALL') query = query.eq('property_id', selectedPropertyId);
    
    const { data } = await query;
    if (data) {
      const revData: any = {}; const expData: any = {}; const monthlyTotals: any = {};
      months.forEach(m => monthlyTotals[m] = { rev: 0, exp: 0, noi: 0 });

      data.forEach((entry: any) => {
        const dateStr = Array.isArray(entry.transactions) ? entry.transactions[0]?.date : entry.transactions?.date;
        if (!dateStr) return;
        
        const entryDate = new Date(dateStr);
        const monthKey = entryDate.toLocaleString('default', { month: 'short', year: 'numeric' });
        if (!months.includes(monthKey)) return;

        const accName = Array.isArray(entry.chart_of_accounts) ? entry.chart_of_accounts[0]?.name : entry.chart_of_accounts?.name;
        const accType = Array.isArray(entry.chart_of_accounts) ? entry.chart_of_accounts[0]?.account_type : entry.chart_of_accounts?.account_type;
        const amount = Math.abs(Number(entry.debit) || Number(entry.credit));

        if (accType?.toLowerCase() === 'revenue') {
          if (!revData[accName]) revData[accName] = {};
          revData[accName][monthKey] = (revData[accName][monthKey] || 0) + amount;
          monthlyTotals[monthKey].rev += amount;
        } else if (accType?.toLowerCase() === 'expense') {
          if (!expData[accName]) expData[accName] = {};
          expData[accName][monthKey] = (expData[accName][monthKey] || 0) + amount;
          monthlyTotals[monthKey].exp += amount;
        }
        monthlyTotals[monthKey].noi = monthlyTotals[monthKey].rev - monthlyTotals[monthKey].exp;
      });

      setT12Data({ rev: revData, exp: expData, totals: monthlyTotals });
    }
  }

  const portfolioValue = properties.reduce((sum, p) => sum + Number(p.current_value || 0), 0);
  const portfolioDebt = properties.reduce((sum, p) => sum + Number(p.mortgage_balance || 0), 0);
  const portfolioEquity = portfolioValue - portfolioDebt;

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center print:hidden">
        <h2 className="text-xl font-semibold text-gray-800">Financial Reporting</h2>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setActiveTab('pnl')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'pnl' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Profit & Loss</button>
          <button onClick={() => setActiveTab('t12')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 't12' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>T12 Matrix</button>
          <button onClick={() => setActiveTab('sreo')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'sreo' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>SREO</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100 print:bg-white print:p-0">
        
        {/* P&L TAB */}
        {activeTab === 'pnl' && (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-end mb-6 print:hidden">
              <div className="flex space-x-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Property</label><select className="border p-2 rounded outline-none w-64" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}><option value="ALL">Entire Portfolio</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label><input type="number" className="border p-2 rounded outline-none w-32" value={year} onChange={(e) => setYear(e.target.value)} /></div>
              </div>
              <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded-md font-medium">🖨️ Print PDF</button>
            </div>

            <div className="bg-white p-10 rounded-xl shadow-sm border border-gray-200 print:shadow-none print:border-none">
              <div className="text-center mb-10 border-b pb-6"><h1 className="text-3xl font-serif font-bold text-gray-900">OphirCRE</h1><h2 className="text-xl font-serif text-gray-600 mt-1">Profit & Loss Statement</h2><p className="text-sm text-gray-500 mt-2">{selectedPropertyId === 'ALL' ? 'Consolidated Portfolio' : properties.find(p => p.id === selectedPropertyId)?.name} <br/>For the Year Ending Dec 31, {year}</p></div>
              <div className="mb-8"><h3 className="font-bold text-lg text-gray-800 border-b border-gray-300 pb-1 mb-3">Operating Revenue</h3>{revenue.map((item, i) => (<div key={i} className="flex justify-between py-1 text-gray-700"><span>{item.name}</span><span>${item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>))}<div className="flex justify-between py-2 mt-2 font-bold text-gray-900 bg-gray-50 px-2 rounded"><span>Total Operating Revenue</span><span>${totalRev.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div></div>
              <div className="mb-8"><h3 className="font-bold text-lg text-gray-800 border-b border-gray-300 pb-1 mb-3">Operating Expenses</h3>{expenses.map((item, i) => (<div key={i} className="flex justify-between py-1 text-gray-700"><span>{item.name}</span><span>${item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>))}<div className="flex justify-between py-2 mt-2 font-bold text-gray-900 bg-gray-50 px-2 rounded border-b border-gray-300"><span>Total Operating Expenses</span><span>${totalExp.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div></div>
              <div className="flex justify-between py-4 mt-6 font-black text-xl text-gray-900 border-t-4 border-double border-gray-800"><span>Net Operating Income (NOI)</span><span className={totalRev - totalExp >= 0 ? 'text-green-700' : 'text-red-600'}>${(totalRev - totalExp).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
            </div>
          </div>
        )}

        {/* T12 TAB */}
        {activeTab === 't12' && (
          <div className="max-w-[1400px] mx-auto">
            <div className="flex justify-between items-end mb-6 print:hidden">
              <div className="flex space-x-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Property</label><select className="border p-2 rounded outline-none w-64" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}><option value="ALL">Entire Portfolio</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              </div>
              <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded-md font-medium">🖨️ Print T12</button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 overflow-x-auto print:shadow-none print:border-none print:p-0">
              <div className="text-center mb-6"><h1 className="text-2xl font-serif font-bold text-gray-900">Trailing 12-Month (T12) Statement</h1><p className="text-sm text-gray-500">{selectedPropertyId === 'ALL' ? 'Consolidated Portfolio' : properties.find(p => p.id === selectedPropertyId)?.name}</p></div>
              <table className="min-w-full divide-y divide-gray-300 text-sm">
                <thead className="bg-gray-800 text-white">
                  <tr><th className="px-4 py-2 text-left">Account</th>{t12Months.map(m => <th key={m} className="px-4 py-2 text-right whitespace-nowrap">{m}</th>)}<th className="px-4 py-2 text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  <tr className="bg-gray-100 font-bold"><td colSpan={14} className="px-4 py-2">REVENUE</td></tr>
                  {Object.keys(t12Data.rev).map(acc => {
                    const rowTotal = t12Months.reduce((sum, m) => sum + (t12Data.rev[acc][m] || 0), 0);
                    return (
                      <tr key={acc} className="hover:bg-gray-50"><td className="px-4 py-2 font-medium">{acc}</td>{t12Months.map(m => <td key={m} className="px-4 py-2 text-right">${(t12Data.rev[acc][m] || 0).toLocaleString()}</td>)}<td className="px-4 py-2 text-right font-bold bg-gray-50">${rowTotal.toLocaleString()}</td></tr>
                    )
                  })}
                  <tr className="bg-green-50 font-bold text-green-800"><td className="px-4 py-2">TOTAL REVENUE</td>{t12Months.map(m => <td key={m} className="px-4 py-2 text-right">${t12Data.totals[m]?.rev.toLocaleString()}</td>)}<td className="px-4 py-2 text-right">${t12Months.reduce((sum, m) => sum + t12Data.totals[m]?.rev, 0).toLocaleString()}</td></tr>
                  
                  <tr className="bg-gray-100 font-bold"><td colSpan={14} className="px-4 py-2">EXPENSES</td></tr>
                  {Object.keys(t12Data.exp).map(acc => {
                    const rowTotal = t12Months.reduce((sum, m) => sum + (t12Data.exp[acc][m] || 0), 0);
                    return (
                      <tr key={acc} className="hover:bg-gray-50"><td className="px-4 py-2 font-medium">{acc}</td>{t12Months.map(m => <td key={m} className="px-4 py-2 text-right">${(t12Data.exp[acc][m] || 0).toLocaleString()}</td>)}<td className="px-4 py-2 text-right font-bold bg-gray-50">${rowTotal.toLocaleString()}</td></tr>
                    )
                  })}
                  <tr className="bg-red-50 font-bold text-red-800"><td className="px-4 py-2">TOTAL EXPENSES</td>{t12Months.map(m => <td key={m} className="px-4 py-2 text-right">${t12Data.totals[m]?.exp.toLocaleString()}</td>)}<td className="px-4 py-2 text-right">${t12Months.reduce((sum, m) => sum + t12Data.totals[m]?.exp, 0).toLocaleString()}</td></tr>
                  
                  <tr className="bg-gray-800 text-white font-black text-base"><td className="px-4 py-3">NET OPERATING INCOME</td>{t12Months.map(m => <td key={m} className="px-4 py-3 text-right">${t12Data.totals[m]?.noi.toLocaleString()}</td>)}<td className="px-4 py-3 text-right">${t12Months.reduce((sum, m) => sum + t12Data.totals[m]?.noi, 0).toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SREO TAB */}
        {activeTab === 'sreo' && (
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center"><p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total Est. Value</p><p className="text-3xl font-black text-gray-900 mt-2">${portfolioValue.toLocaleString()}</p></div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center"><p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total Debt</p><p className="text-3xl font-black text-red-600 mt-2">${portfolioDebt.toLocaleString()}</p></div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center"><p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Total Equity</p><p className="text-3xl font-black text-green-600 mt-2">${portfolioEquity.toLocaleString()}</p></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-800 text-white"><tr><th className="px-4 py-3 text-left text-xs font-bold uppercase">Property Name</th><th className="px-4 py-3 text-right text-xs font-bold uppercase">Current Value</th><th className="px-4 py-3 text-right text-xs font-bold uppercase">Mortgage Bal.</th><th className="px-4 py-3 text-right text-xs font-bold uppercase">Equity</th></tr></thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {properties.map(p => {
                    const equity = Number(p.current_value || 0) - Number(p.mortgage_balance || 0);
                    return (
                      <tr key={p.id} className="hover:bg-gray-50"><td className="px-4 py-3 text-sm font-bold text-blue-600">{p.name}</td><td className="px-4 py-3 text-sm text-right font-medium text-gray-900">${Number(p.current_value || 0).toLocaleString()}</td><td className="px-4 py-3 text-sm text-right text-red-600">${Number(p.mortgage_balance || 0).toLocaleString()}</td><td className="px-4 py-3 text-sm text-right font-bold text-green-600">${equity.toLocaleString()}</td></tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}