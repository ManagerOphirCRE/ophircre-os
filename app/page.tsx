"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({ props: 0, tenants: 0, tasks: 0 });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const[chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      const { count: pCount } = await supabase.from('properties').select('*', { count: 'exact', head: true });
      const { count: tCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true });
      const { count: tkCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'Done');
      setStats({ props: pCount || 0, tenants: tCount || 0, tasks: tkCount || 0 });

      const { data: tasks } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(5);
      if (tasks) setRecentTasks(tasks);

      const { data: txns } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(5);
      if (txns) setRecentTxns(txns);

      const { data: srvs } = await supabase.from('tenant_surveys').select('*, tenants(name)').order('created_at', { ascending: false }).limit(5);
      if (srvs && srvs.length > 0) {
        setSurveys(srvs);
        setAvgRating(srvs.reduce((sum, s) => sum + s.rating, 0) / srvs.length);
      }

      const { data: journalEntries } = await supabase.from('journal_entries').select('debit, credit, chart_of_accounts(account_type), transactions(date)').order('transactions(date)', { ascending: true });
      if (journalEntries) {
        const monthlyData: Record<string, { name: string, Revenue: number, Expenses: number }> = {};
        journalEntries.forEach((entry: any) => {
          const dateStr = Array.isArray(entry.transactions) ? entry.transactions[0]?.date : entry.transactions?.date;
          if (!dateStr) return;
          const date = new Date(dateStr);
          const key = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
          if (!monthlyData[key]) monthlyData[key] = { name: key, Revenue: 0, Expenses: 0 };
          const accType = Array.isArray(entry.chart_of_accounts) ? entry.chart_of_accounts[0]?.account_type : entry.chart_of_accounts?.account_type;
          const amount = Math.abs(Number(entry.debit) || Number(entry.credit));
          if (accType?.toLowerCase() === 'revenue') monthlyData[key].Revenue += amount;
          if (accType?.toLowerCase() === 'expense') monthlyData[key].Expenses += amount;
        });
        setChartData(Object.values(monthlyData));
      }
    }
    loadDashboard();
  },[]);

  return (
    <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><h3 className="text-gray-500 text-sm font-medium">Total Properties</h3><p className="text-3xl font-bold text-gray-800 mt-2">{stats.props}</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><h3 className="text-gray-500 text-sm font-medium">Active Tenants</h3><p className="text-3xl font-bold text-gray-800 mt-2">{stats.tenants}</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"><h3 className="text-gray-500 text-sm font-medium">Open Tasks</h3><p className="text-3xl font-bold text-red-600 mt-2">{stats.tasks}</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-96 flex flex-col">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Cash Flow (Revenue vs Expenses)</h3>
          <div className="flex-1 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#888'}} tickFormatter={(value) => `$${value}`} />
                  {/* FIX: Changed (value: number) to (value: any) to satisfy TypeScript */}
                  <Tooltip cursor={{fill: '#f8fafc'}} formatter={(value: any) => `$${Number(value || 0).toLocaleString()}`} />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                  <Bar dataKey="Revenue" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-gray-400 text-sm">No financial data available to chart.</div>}
          </div>
        </div>

        <div className="md:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-y-auto h-96">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">Recent Tasks</h3>
          <div className="space-y-3">
            {recentTasks.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="font-medium text-sm text-gray-800 truncate pr-2">{t.title}</span>
                <span className="text-[10px] px-2 py-1 bg-blue-100 text-blue-800 rounded font-bold uppercase">{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
          <h3 className="text-lg font-semibold text-gray-800">Tenant Satisfaction</h3>
          <div className="flex items-center space-x-2"><span className="text-sm text-gray-500">Average Rating:</span><span className="font-bold text-lg text-yellow-500">⭐ {avgRating.toFixed(1)} / 5.0</span></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {surveys.map(s => (
            <div key={s.id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex justify-between mb-2"><span className="font-bold text-sm text-gray-900">{s.tenants?.name}</span><span className="text-yellow-500 text-sm">{'⭐'.repeat(s.rating)}</span></div>
              <p className="text-sm text-gray-600 italic">"{s.feedback || 'No written feedback provided.'}"</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}