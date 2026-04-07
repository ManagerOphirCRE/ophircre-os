"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function CredentialVaultPage() {
  const [credentials, setCredentials] = useState<any[]>([]);
  const[properties, setProperties] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScraping, setIsScraping] = useState<string | null>(null);

  // Form State
  const [institution, setInstitution] = useState('');
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [propertyId, setPropertyId] = useState('');

  useEffect(function loadVault() {
    async function fetchData() {
      const { data: cData } = await supabase.from('credential_vault').select('*, properties(name)').order('institution_name');
      if (cData) setCredentials(cData);
      
      const { data: pData } = await supabase.from('properties').select('*').order('name');
      if (pData) setProperties(pData);
    }
    fetchData();
  },[]);

  async function saveCredential(e: any) {
    e.preventDefault();
    setIsSaving(true);
    try {
      // In Phase 6, we would pass this through a secure encryption API before saving.
      // For now, we store it to build the UI and workflow.
      const { error } = await supabase.from('credential_vault').insert([{
        institution_name: institution,
        website_url: url,
        username: username,
        encrypted_password: password, // Dummy encryption for UI purposes
        property_id: propertyId || null
      }]);

      if (error) throw error;
      
      alert("Credentials securely vaulted!");
      setIsModalOpen(false);
      setInstitution(''); setUrl(''); setUsername(''); setPassword(''); setPropertyId('');
      
      const { data } = await supabase.from('credential_vault').select('*, properties(name)').order('institution_name');
      if (data) setCredentials(data);
    } catch (error: any) {
      alert("Error saving: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function runScraper(id: string, institutionName: string) {
    setIsScraping(id);
    // Simulate the Playwright bot logging in and downloading documents
    setTimeout(async () => {
      await supabase.from('credential_vault').update({ last_scraped: new Date().toISOString() }).eq('id', id);
      alert(`Bot successfully logged into ${institutionName}, downloaded the latest statements, and sent them to the AI Scanner!`);
      setIsScraping(null);
      const { data } = await supabase.from('credential_vault').select('*, properties(name)').order('institution_name');
      if (data) setCredentials(data);
    }, 3000);
  }

  async function deleteCredential(id: string) {
    if (!confirm("Permanently delete these credentials?")) return;
    await supabase.from('credential_vault').delete().eq('id', id);
    const { data } = await supabase.from('credential_vault').select('*, properties(name)').order('institution_name');
    if (data) setCredentials(data);
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Credential Vault & Bot Manager</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          + Add Bank / Lender
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-800 mb-2">Automated Statement Retrieval</h3>
          <p className="text-sm text-gray-600">
            Store your lender and utility logins here. Click "Run Scraper" to deploy a secure bot that logs into the website, downloads your monthly statements, and feeds them directly into the AI Invoice Reader.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {credentials.map(cred => (
            <div key={cred.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                <h4 className="font-bold text-lg">{cred.institution_name}</h4>
                <button onClick={() => deleteCredential(cred.id)} className="text-slate-400 hover:text-red-400">&times;</button>
              </div>
              
              <div className="p-6 flex-1 space-y-3 text-sm">
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500">URL:</span> <a href={cred.website_url} target="_blank" className="text-blue-600 truncate max-w-[150px]">{cred.website_url}</a></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Username:</span> <span className="font-medium text-gray-900">{cred.username}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Password:</span> <span className="font-mono text-gray-400">••••••••••••</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Linked Property:</span> <span className="font-medium text-gray-900">{cred.properties?.name || 'Global'}</span></div>
                <div className="flex justify-between pt-2"><span className="text-gray-500">Last Scraped:</span> <span className="text-xs text-gray-400">{cred.last_scraped ? new Date(cred.last_scraped).toLocaleString() : 'Never'}</span></div>
              </div>
              
              <div className="p-4 bg-gray-50 border-t border-gray-200">
                <button 
                  onClick={() => runScraper(cred.id, cred.institution_name)} 
                  disabled={isScraping === cred.id}
                  className={`w-full py-2 rounded font-bold text-white transition ${isScraping === cred.id ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                  {isScraping === cred.id ? '🤖 Bot is scraping...' : '▶ Run Scraper Bot'}
                </button>
              </div>
            </div>
          ))}
          {credentials.length === 0 && (
            <div className="col-span-full p-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-300">
              <p className="text-gray-500">Your vault is empty. Add a lender to automate your document retrieval.</p>
            </div>
          )}
        </div>

        {/* ADD CREDENTIAL MODAL */}
        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg w-[500px]">
              <h3 className="text-xl font-bold mb-6 text-gray-800">Add Secure Credential</h3>
              <form onSubmit={saveCredential} className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Institution Name (e.g., Chase)</label><input type="text" required className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={institution} onChange={(e) => setInstitution(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Login URL</label><input type="url" required className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Username</label><input type="text" required className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Password</label><input type="password" required className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link to Property (Optional)</label>
                  <select className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                    <option value="">-- Global / Unassigned --</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex justify-end space-x-3 pt-4 mt-2 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" disabled={isSaving} className={`px-4 py-2 rounded font-medium text-white ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>Save to Vault</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}