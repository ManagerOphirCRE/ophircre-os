"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import JSZip from 'jszip';
import { useOrg } from '@/app/context/OrgContext';

export default function SettingsPage() {
  const { orgId } = useOrg();
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]); // NEW: Webhooks state
  const [org, setOrg] = useState<any>(null);
  
  const [newEmail, setNewEmail] = useState('');
  const[newRole, setNewRole] = useState('assistant');
  const [userEmail, setUserEmail] = useState('');
  const[pushEnabled, setPushEnabled] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const[isUploadingLogo, setIsUploadingLogo] = useState(false);

  // NEW: Webhook Form State
  const[hookUrl, setHookUrl] = useState('');
  const [hookEvent, setHookEvent] = useState('lease_signed');

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        if (orgId) {
          const { data: orgData } = await supabase.from('organizations').select('*').eq('id', orgId).single();
          if (orgData) { setOrg(orgData); setPrimaryColor(orgData.primary_color || '#2563eb'); }
        }
      }
      const { data: accData } = await supabase.from('chart_of_accounts').select('*').order('account_type', { ascending: true });
      if (accData) setAccounts(accData);
      const { data: teamData } = await supabase.from('user_roles').select('*').order('role', { ascending: true });
      if (teamData) setTeam(teamData);
      const { data: keyData } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
      if (keyData) setApiKeys(keyData);
      
      // Fetch Webhooks
      const { data: hookData } = await supabase.from('outbound_webhooks').select('*').order('created_at', { ascending: false });
      if (hookData) setWebhooks(hookData);

      if ('Notification' in window && Notification.permission === 'granted') setPushEnabled(true);
    }
    if (orgId) fetchData();
  }, [orgId]);

  async function saveBranding() {
    if (!org) return;
    await supabase.from('organizations').update({ primary_color: primaryColor }).eq('id', org.id);
    alert("Brand color updated!");
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
        return [headers, ...rows].join('\n');
      };

      zip.file("properties.csv", toCsv(props || [])); zip.file("tenants.csv", toCsv(tnts ||[]));
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
      await supabase.from('api_keys').insert([{ name, api_key: newKey, organization_id: orgId }]);
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

  // NEW: Save Webhook
  async function saveWebhook(e: any) {
    e.preventDefault();
    try {
      await supabase.from('outbound_webhooks').insert([{ target_url: hookUrl, event_type: hookEvent, organization_id: orgId }]);
      setHookUrl('');
      const { data } = await supabase.from('outbound_webhooks').select('*').order('created_at', { ascending: false });
      if (data) setWebhooks(data);
      alert("Webhook saved! Zapier will now receive payloads for this event.");
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function deleteWebhook(id: string) {
    await supabase.from('outbound_webhooks').delete().eq('id', id);
    const { data } = await supabase.from('outbound_webhooks').select('*').order('created_at', { ascending: false });
    if (data) setWebhooks(data);
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
      await supabase.from('user_roles').insert([{ email: newEmail.toLowerCase(), role: newRole, organization_id: orgId }]);
      await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: newEmail.toLowerCase(), subject: "Welcome to OphirCRE", text: `You have been granted ${newRole.toUpperCase()} access. Log in here: https://app.ophircre.com/portal-login` }) });
      alert("Team member added and Welcome Email sent!"); setNewEmail('');
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

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
  }

  async function enablePushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return alert("Push notifications are not supported on this device/browser.");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return alert("Permission denied.");
      const registration = await navigator.serviceWorker.register('/sw.js');
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) throw new Error("VAPID Public Key missing.");
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicVapidKey) });
      await fetch('/api/save-subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription, email: userEmail }) });
      setPushEnabled(true); alert("Notifications Enabled!");
    } catch (error: any) { alert("Error: " + error.message); }
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
        
        {activeTab === 'branding' && (
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 mt-10">
            <h3 className="font-bold text-2xl text-gray-800 mb-2">White-Label Branding</h3>
            <p className="text-gray-600 mb-8">Customize the look and feel of the Tenant and Vendor portals.</p>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div><h4 className="font-bold text-gray-900">Company Logo</h4></div>
                <div className="flex items-center space-x-4">
                  {org?.logo_url && <img src={org.logo_url} alt="Logo" className="h-12 w-auto object-contain" />}
                  <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold cursor-pointer transition">
                    {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    <input type="file" accept="image/*" className="hidden" onChange={uploadLogo} disabled={isUploadingLogo} />
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div><h4 className="font-bold text-gray-900">Primary Brand Color</h4></div>
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
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* QBO INTEGRATION */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800 flex items-center"><span className="text-green-600 mr-2 text-xl">qb</span> QuickBooks Online</h3>
                <p className="text-sm text-gray-500 mt-1">Connect your QBO account to automatically sync Journal Entries.</p>
              </div>
              <button onClick={() => window.location.href = `/api/qbo-auth?orgId=${orgId}`} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-bold transition shadow-sm">
                Connect QuickBooks
              </button>
            </div>

            {/* ZAPIER WEBHOOKS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-gray-800">Outbound Webhooks (Zapier / Make)</h3>
                  <p className="text-sm text-gray-500">Fire data to external apps when events happen in OphirCRE.</p>
                </div>
              </div>
              <div className="p-6 border-b border-gray-200">
                <form onSubmit={saveWebhook} className="flex space-x-4">
                  <select className="border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={hookEvent} onChange={(e) => setHookEvent(e.target.value)}>
                    <option value="lease_signed">Lease Signed</option>
                    <option value="maintenance_requested">Maintenance Requested</option>
                  </select>
                  <input type="url" required placeholder="https://hooks.zapier.com/..." className="flex-1 border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} />
                  <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded font-bold transition shadow-sm">Add Webhook</button>
                </form>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Event Trigger</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Target URL</th><th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th></tr></thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {webhooks.map(hook => (<tr key={hook.id} className="hover:bg-gray-50"><td className="px-6 py-4 text-sm font-bold text-gray-900">{hook.event_type}</td><td className="px-6 py-4 text-sm text-gray-500 font-mono truncate max-w-xs">{hook.target_url}</td><td className="px-6 py-4 text-right"><button onClick={() => deleteWebhook(hook.id)} className="text-red-500 text-xs font-bold hover:underline">Delete</button></td></tr>))}
                  {webhooks.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No webhooks configured.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* INBOUND API KEYS */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
              <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                <div><h3 className="font-bold text-gray-800">Inbound API Keys</h3><p className="text-sm text-gray-500">Generate secure tokens to push data INTO OphirCRE.</p></div>
                <button onClick={generateApiKey} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-bold transition shadow-sm">+ Generate New Key</button>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Integration Name</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">API Key (Hidden)</th><th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th></tr></thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {apiKeys.map(key => (<tr key={key.id} className="hover:bg-gray-50"><td className="px-6 py-4 text-sm font-bold text-gray-900">{key.name}</td><td className="px-6 py-4 text-sm font-mono text-gray-500">sk_live_••••••••••••••••</td><td className="px-6 py-4 text-right"><button onClick={() => revokeApiKey(key.id)} className="text-red-500 text-xs font-bold hover:underline">Revoke</button></td></tr>))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Accounts and Team tabs remain exactly the same... */}
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
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Staff Email Address</label><input type="email" required className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Security Role</label>
                  <select className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                    <option value="admin">Admin (Full Access)</option><option value="manager">Property Manager (Ops & Leasing)</option><option value="accountant">Accountant (Financials & Reports)</option><option value="assistant">Assistant (General Ops)</option><option value="maintenance">Maintenance (Tasks Only)</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-bold transition">Grant Access</button>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}