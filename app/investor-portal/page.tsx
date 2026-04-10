"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function InvestorPortal() {
  const [investor, setInvestor] = useState<any>(null);
  const[distributions, setDistributions] = useState<any[]>([]);
  const [portfolioStats, setPortfolioStats] = useState({ value: 0, debt: 0, equity: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(function loadSecureInvestor() {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.email) {
        // 1. Fetch Investor Profile
        const { data: invData } = await supabase.from('investors').select('*').ilike('contact_email', session.user.email).single();
        
        if (invData) {
          setInvestor(invData);
          
          // 2. Fetch Distributions
          const { data: distData } = await supabase.from('distributions').select('*').eq('investor_id', invData.id).order('date', { ascending: false });
          if (distData) setDistributions(distData);

          // 3. Calculate Global SREO
          const { data: props } = await supabase.from('properties').select('current_value, mortgage_balance');
          if (props) {
            const val = props.reduce((sum, p) => sum + Number(p.current_value || 0), 0);
            const debt = props.reduce((sum, p) => sum + Number(p.mortgage_balance || 0), 0);
            setPortfolioStats({ value: val, debt: debt, equity: val - debt });
          }
        }
      }
      setIsLoading(false);
    }
    fetchData();
  },[]);

  if (isLoading) return <div className="p-8 text-center text-gray-500">Authenticating secure connection...</div>;
  if (!investor) return <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-red-200 max-w-2xl mx-auto mt-10"><h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2><p className="text-gray-600">Your email is not linked to an active Investor Profile.</p></div>;

  const myEquityValue = portfolioStats.equity * (Number(investor.portfolio_equity_percentage) / 100);
  const totalDistributions = distributions.reduce((sum, d) => sum + Number(d.amount), 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <div className="max-w-5xl w-full space-y-8">
        
        <div className="bg-slate-900 rounded-2xl p-8 text-white shadow-xl flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold mb-1">Investor Dashboard</h2>
            <p className="text-slate-400">Welcome, {investor.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400 uppercase tracking-widest font-bold">Your Ownership</p>
            <p className="text-3xl font-black text-green-400">{Number(investor.portfolio_equity_percentage).toFixed(2)}%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Your Est. Equity Value</h3>
            <p className="text-4xl font-black text-gray-900 mt-2">${myEquityValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            <p className="text-xs text-gray-400 mt-2">Based on current portfolio valuations.</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Total Distributions (YTD)</h3>
            <p className="text-4xl font-black text-blue-600 mt-2">${totalDistributions.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
            <p className="text-xs text-gray-400 mt-2">Cash returned to your account.</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
            <h3 className="text-gray-500 text-sm font-bold uppercase tracking-wider">Tax Documents</h3>
            <button className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-lg font-bold transition flex justify-center items-center">
              <span className="mr-2">📄</span> Download K-1 (2025)
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="p-6 bg-gray-50 border-b border-gray-200"><h3 className="font-bold text-gray-800">Distribution History</h3></div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Memo</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {distributions.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-500">{d.date}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{d.memo}</td>
                  <td className="px-6 py-4 text-sm text-right font-bold text-green-700">${Number(d.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
              {distributions.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No distributions recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}