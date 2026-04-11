"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/app/utils/supabase";

export default function SuperAdminPage() {
  const[orgs, setOrgs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const[isAuthorized, setIsAuthorized] = useState(false);

  const checkAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user?.email === 'manager@ophircre.com') {
      setIsAuthorized(true);
      const { data } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
      if (data) setOrgs(data);
    }
    setIsLoading(false);
  };

  useEffect(() => { checkAccess(); },[ /* mount */ ]);

  if (isLoading) return <div className="p-8 text-slate-500">Verifying Super Admin credentials...</div>;
  
  if (!isAuthorized) return (
    <div className="p-12 text-center mt-10">
      <h2 className="text-3xl font-black text-red-600 mb-2">Access Denied</h2>
      <p className="text-slate-600">This dashboard is restricted to the platform founder.</p>
    </div>
  );

  const activeOrgs = orgs.filter(o => o.subscription_status === 'active' || o.subscription_status === 'lifetime_admin');
  const mrr = activeOrgs.length * 299;

  return (
    <main className="flex-1 overflow-y-auto p-8 bg-slate-50">
      <header className="mb-8">
        <h2 className="text-3xl font-black text-slate-900">Super Admin Dashboard</h2>
        <p className="text-slate-500">OphirCRE OS - SaaS Management</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-bold uppercase">Total Organizations</h3>
          <p className="text-4xl font-black text-slate-900 mt-2">{orgs.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-slate-500 text-sm font-bold uppercase">Active Subscriptions</h3>
          <p className="text-4xl font-black text-blue-600 mt-2">{activeOrgs.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-green-500">
          <h3 className="text-slate-500 text-sm font-bold uppercase">Monthly Recurring Revenue (MRR)</h3>
          <p className="text-4xl font-black text-green-600 mt-2">${mrr.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
          <h3 className="font-bold">Registered Companies</h3>
        </div>
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Company Name</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Owner Email</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {orgs.map(org => (
              <tr key={org.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-bold text-blue-600">{org.company_name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{org.owner_email}</td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${org.subscription_status === 'active' || org.subscription_status === 'lifetime_admin' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {org.subscription_status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{new Date(org.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {orgs.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No organizations registered yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>
  );
}