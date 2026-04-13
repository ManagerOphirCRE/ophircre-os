"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import JSZip from 'jszip';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(null);
  
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('assistant');
  const [userEmail, setUserEmail] = useState('');
  const[pushEnabled, setPushEnabled] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Branding State
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        // Fetch Organization for Branding
        const { data: roleData } = await supabase.from('user_roles').select('organization_id').eq('email', session.user.email).single();
        if (roleData?.organization_id) {
          const { data: orgData } = await supabase.from('organizations').select('*').eq('id', roleData.organization_id).single();
          if (orgData) {
            setOrg(orgData);
            setPrimaryColor(orgData.primary_color || '#2563eb');
          }
        }
      }

      const { data: accData } = await supabase.from('chart_of_accounts').select('*').order('account_type', { ascending: true });
      if (accData) setAccounts(accData);
      const { data: teamData } = await supabase.from('user_roles').select('*').order('role', { ascending: true });
      if (teamData) setTeam(teamData);
      const { data: keyData } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
      if (keyData) setApiKeys(keyData);
      if ('Notification' in window && Notification.permission === 'granted') setPushEnabled(true);
    }
    fetchData();
  },[]);

  async function saveBranding() {
    if (!org) return;
    await supabase.from('organizations').update({ primary_color: primaryColor }).eq('id', org.id);
    alert("Brand color updated! This will reflect on your Tenant and Vendor portals.");
  }

  async function uploadLogo(e: any) {
    if (!org) return;
    setIsUploadingLogo(true);
    try {
      const file = e.target.files[0]; if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${org.id}.${fileExt}`;
      await supabase.storage.from('marketing').upload(fileName, file, { upsert: true });
      const { data } = supabase.storage.from('marketing').getPublicUrl(fileName);
      await supabase.from('organizations').update({ logo_url: data.publicUrl }).eq('id', org.id);
      setOrg({ ...org, logo_url: data.publicUrl });
      alert("Logo uploaded successfully!");
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsUploadingLogo(false); }
  }

  async function exportGlobalData() {
    setIsExporting(true);
    try {
      const zip = new JSZip();
      const { data: props } = await supabase.from('properties').select('*');
      const { data: tnts } = await supabase.from('tenants').select('*');
      const { data: lses } = await supabase.from('leases').select('*');
      const { data: txns } = await supabase.from('transactions').select('*');

      const toCsv = (data: any[]) => {
        if (!data || data.length === 0) return '';
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
        return[headers, ...rows].join('\n');
      };

      zip.file("properties.csv", toCsv(props ||[])); zip.file("tenants.csv", toCsv(tnts ||[]));
      zip.file("leases.csv", toCsv(lses ||[])); zip.file("transactions.csv", toCsv(txns ||[]));

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a"); link.href = URL.createObjectURL(content);
      link.download = `OphirCRE_Global_Backup_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (error: any) { alert("Export Error: " + error.message); } finally { setIsExporting(false); }
  }

  async function generateApiKey() {
    const name = prompt("Enter a name for this API Key:"); if (!name) return;
    const newKey = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    try {
      await supabase.from('api_keys').insert([{ name, api_key: newKey }]);
      alert(`API Key Generated! Copy it now:\n\n${newKey}`);
      const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
      if (data) setApiKeys(data);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function revokeApiKey(id: string) {
    if (!confirm("Revoke this API Key?")) return;
    await supabase.from('api_keys').delete().eq('id', id);
    const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
    if (data) setApiKeys(data);
  }

  async function deleteAccount(id: string) {
    if (!confirm("Are you sure?")) return;
    await supabase.from('chart_of_accounts').delete().eq('id', id);
    const { data } = await supabase.from('chart_of_accounts').select('*').order('account_type', { ascending: true });
    if (data) setAccounts(data);
  }

  async function addTeamMember(e: any) {
    e.preventDefault(); if (!newEmail) return;
    try {
      await supabase.from('user_roles').insert([{ email: newEmail.toLowerCase(), role: newRole }]);
      await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: newEmail.toLowerCase(), subject: "Welcome to OphirCRE", text: `You have been granted ${newRole.toUpperCase()} access. Log in here: https://app.ophircre.com/portal-login` }) });
      alert("Team member added!"); setNewEmail('');
      const { data } = await supabase.from('user_roles').select('*').order('role', { ascending: true });
      if (data) setTeam(data);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function removeTeamMember(email: string) {
    if (email === 'manager@ophircre.com') return alert("Cannot remove primary admin.");
    if (!confirm("Revoke access?")) return;
    await supabase.from('user_roles').delete().eq('email', email);
    const { data } = await supabase.from('user_roles').select('*').order('role', { ascending: true });
    if (data) setTeam(data);
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Global Settings</h2>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setActiveTab('accounts')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'accounts' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Chart of Accounts</button>
          <button onClick={() => setActiveTab('team')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'team' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Team & Permissions</button>
          <button onClick={() => setActiveTab('branding')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'branding' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>SaaS Branding</button>
          <button onClick={() => setActiveTab('api')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'api' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>API Integrations</button>
          <button onClick={() => setActiveTab('export')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'export' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Data Export</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        
        {/* NEW: SAAS BRANDING TAB */}
        {activeTab === 'branding' && (
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 mt-10">
            <h3 className="font-bold text-2xl text-gray-800 mb-2">White-Label Branding</h3>
            <p className="text-gray-600 mb-8">Customize the look and feel of the Tenant and Vendor portals so they match your company's brand identity.</p>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <h4 className="font-bold text-gray-900">Company Logo</h4>
                  <p className="text-xs text-gray-500">Displayed at the top of all public portals.</p>
                </div>
                <div className="flex items-center space-x-4">
                  {org?.logo_url && <img src={org.logo_url} alt="Logo" className="h-12 w-auto object-contain" />}
                  <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold cursor-pointer transition">
                    {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} disabled={isUploadingLogo} />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <h4 className="font-bold text-gray-900">Primary Brand Color</h4>
                  <p className="text-xs text-gray-500">Used for buttons and banners.</p>
                </div>
                <div className="flex items-center space-x-4">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-10 rounded cursor-pointer" />
                  <button onClick={saveBranding} className="bg-gray-800 text-white px-4 py-2 rounded font-bold">Save Color</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'export' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-2xl mx-auto text-center mt-10">
            <div className="text-5xl mb-4">📦</div><h3 className="font-bold text-2xl text-gray-800 mb-2">Global Data Takeout</h3>
            <p className="text-gray-600 mb-8">Download a complete, offline backup of your entire portfolio.</p>
            <button onClick={exportGlobalData} disabled={isExporting} className={`w-full py-4 rounded-lg font-bold text-white transition shadow-sm text-lg ${isExporting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{isExporting ? 'Bundling Data...' : 'Download Master ZIP File'}</button>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex justify-between items-center">
              <div><h3 className="font-bold text-gray-800">Public API Keys</h3><p className="text-sm text-gray-500 mt-1">Generate secure tokens to connect OphirCRE to Zapier.</p></div>
              <button onClick={generateApiKey} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-bold transition shadow-sm">+ Generate New Key</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Integration Name</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">API Key (Hidden)</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Created</th><th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th></tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {apiKeys.map(key => (<tr key={key.id} className="hover:bg-gray-50"><td className="px-6 py-4 text-sm font-bold text-gray-900">{key.name}</td><td className="px-6 py-4 text-sm font-mono text-gray-500">sk_live_••••••••••••••••</td><td className="px-6 py-4 text-sm text-gray-500">{new Date(key.created_at).toLocaleDateString()}</td><td className="px-6 py-4 text-right"><button onClick={() => revokeApiKey(key.id)} className="text-red-500 text-xs font-bold hover:underline">Revoke</button></td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'accounts' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-3xl">
            <h3 className="font-bold text-gray-800 mb-4">Chart of Accounts Manager</h3>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th><th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {accounts.map(acc => <tr key={acc.id}><td className="px-4 py-2 text-sm font-medium">{acc.name}</td><td className="px-4 py-2 text-sm text-gray-500">{acc.account_type}</td><td className="px-4 py-2 text-right"><button onClick={() => deleteAccount(acc.id)} className="text-red-500 text-xs hover:underline">Delete</button></td></tr>)}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-gray-800 mb-4">Active Team Members</h3>
              <div className="space-y-3">
                {team.map(member => (
                  <div key={member.email} className="flex justify-between items-center p-3 bg-gray-50 border rounded-lg">
                    <div><p className="font-bold text-gray-900 text-sm">{member.email}</p><p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{member.role}</p></div>
                    {member.email !== 'manager@ophircre.com' && <button onClick={() => removeTeamMember(member.email)} className="text-red-500 text-xs font-bold hover:underline">Revoke Access</button>}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-fit">
              <h3 className="font-bold text-gray-800 mb-4">Invite New Staff</h3>
              <form onSubmit={addTeamMember} className="space-y-4">
                <input type="email" required placeholder="Staff Email Address" className="w-full border p-2 rounded outline-none" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                <select className="w-full border p-2 rounded outline-none" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="admin">Admin (Full Access)</option><option value="manager">Property Manager (Ops & Leasing)</option><option value="accountant">Accountant (Financials & Reports)</option><option value="assistant">Assistant (General Ops)</option><option value="maintenance">Maintenance (Tasks Only)</option>
                </select>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-bold transition">Grant Access</button>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}