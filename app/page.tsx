"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({ props: 0, tenants: 0, tasks: 0, occupancy: 0, arrears: 0 });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const[avgRating, setAvgRating] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadDashboard() {
      const { count: pCount } = await supabase.from('properties').select('*', { count: 'exact', head: true });
      const { count: tCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active');
      const { count: tkCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'Done');
      
      const { data: spaces } = await supabase.from('spaces').select('id, square_footage');
      const { data: activeLeases } = await supabase.from('leases').select('space_id').eq('status', 'Active');
      
      let totalSqft = 0; let leasedSqft = 0;
      if (spaces && activeLeases) {
        const leasedSpaceIds = activeLeases.map(l => l.space_id);
        spaces.forEach(space => {
          const sqft = Number(space.square_footage || 0);
          totalSqft += sqft;
          if (leasedSpaceIds.includes(space.id)) leasedSqft += sqft;
        });
      }
      const occupancyRate = totalSqft > 0 ? (leasedSqft / totalSqft) * 100 : 0;

      const { data: invoices } = await supabase.from('tenant_invoices').select('amount').in('status',['Unpaid', 'Overdue']);
      const totalArrears = invoices?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;

      if (mounted) setStats({ props: pCount || 0, tenants: tCount || 0, tasks: tkCount || 0, occupancy: occupancyRate, arrears: totalArrears });

      const { data: tasks } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(5);
      if (tasks && mounted) setRecentTasks(tasks);

      const { data: txns } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(5);
      if (txns && mounted) setRecentTxns(txns);

      const { data: srvs } = await supabase.from('tenant_surveys').select('*, tenants(name)').order('created_at', { ascending: false }).limit(5);
      if (srvs && srvs.length > 0 && mounted) {
        setSurveys(srvs);
        setAvgRating(srvs.reduce((sum, s) => sum + s.rating, 0) / srvs.length);
      }

      const { data: journalEntries } = await supabase.from('journal_entries').select('debit, credit, chart_of_accounts(account_type), transactions(date)').order('transactions(date)', { ascending: true });
      if (journalEntries && mounted) {
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
    return () => { mounted = false; };
  },[]);

  return (
    <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><h3 className="text-gray-500 text-xs font-bold uppercase">Properties</h3><p className="text-2xl font-bold text-gray-800 mt-1">{stats.props}</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><h3 className="text-gray-500 text-xs font-bold uppercase">Active Tenants</h3><p className="text-2xl font-bold text-gray-800 mt-1">{stats.tenants}</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 border-l-4 border-l-blue-500"><h3 className="text-gray-500 text-xs font-bold uppercase">Occupancy Rate</h3><p className="text-2xl font-black text-blue-600 mt-1">{stats.occupancy.toFixed(1)}%</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 border-l-4 border-l-red-500"><h3 className="text-gray-500 text-xs font-bold uppercase">Total Arrears</h3><p className="text-2xl font-black text-red-600 mt-1">${stats.arrears.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><h3 className="text-gray-500 text-xs font-bold uppercase">Open Tasks</h3><p className="text-2xl font-bold text-gray-800 mt-1">{stats.tasks}</p></div>
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
            {recentTasks.length === 0 && <p className="text-center text-gray-500 text-sm mt-10">No open tasks.</p>}
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
          {surveys.length === 0 && <p className="text-center text-gray-500 text-sm col-span-3 py-4">No surveys submitted yet.</p>}
        </div>
      </div>
    </main>
  );
}