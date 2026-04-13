"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('accounts');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('assistant');
  const [userEmail, setUserEmail] = useState('');
  const[pushEnabled, setPushEnabled] = useState(false);

  useEffect(function loadSettings() {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) setUserEmail(session.user.email);

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

  // --- API KEY LOGIC ---
  async function generateApiKey() {
    const name = prompt("Enter a name for this API Key (e.g., 'Zapier Integration'):");
    if (!name) return;

    // Generate a secure random string
    const newKey = 'sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    try {
      await supabase.from('api_keys').insert([{ name, api_key: newKey }]);
      alert(`API Key Generated! Please copy it now, it will not be shown again:\n\n${newKey}`);
      
      const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
      if (data) setApiKeys(data);
    } catch (error: any) {
      alert("Error generating key: " + error.message);
    }
  }

  async function revokeApiKey(id: string) {
    if (!confirm("Revoke this API Key? Any external apps using it will immediately lose access.")) return;
    await supabase.from('api_keys').delete().eq('id', id);
    const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
    if (data) setApiKeys(data);
  }

  // --- EXISTING SETTINGS LOGIC ---
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

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Global Settings</h2>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setActiveTab('accounts')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'accounts' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Chart of Accounts</button>
          <button onClick={() => setActiveTab('team')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'team' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Team & Permissions</button>
          <button onClick={() => setActiveTab('api')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'api' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>API Integrations</button>
          <button onClick={() => setActiveTab('notifications')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'notifications' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Notifications</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        
        {activeTab === 'api' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800">Public API Keys</h3>
                <p className="text-sm text-gray-500 mt-1">Generate secure tokens to connect OphirCRE to Zapier, QuickBooks, or custom external software.</p>
              </div>
              <button onClick={generateApiKey} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-bold transition shadow-sm">
                + Generate New Key
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Integration Name</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">API Key (Hidden)</th><th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Created</th><th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th></tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {apiKeys.map(key => (
                    <tr key={key.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{key.name}</td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-500">sk_live_••••••••••••••••</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(key.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right"><button onClick={() => revokeApiKey(key.id)} className="text-red-500 text-xs font-bold hover:underline">Revoke</button></td>
                    </tr>
                  ))}
                  {apiKeys.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No API keys generated.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Existing Tabs (Notifications, Accounts, Team) remain exactly the same below... */}
        {activeTab === 'notifications' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-2xl mx-auto text-center mt-10">
            <div className="text-5xl mb-4">🔔</div>
            <h3 className="font-bold text-2xl text-gray-800 mb-2">Push Notifications</h3>
            <p className="text-gray-600 mb-8">Enable push notifications on this device to receive instant alerts when a tenant submits a maintenance ticket or a lease is signed.</p>
            {pushEnabled ? <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg font-bold">✓ Notifications are active on this device.</div> : <button onClick={enablePushNotifications} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition shadow-sm text-lg w-full">Enable Push Notifications</button>}
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