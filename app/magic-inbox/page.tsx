"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useOrg } from '@/app/context/OrgContext';

export default function MagicInboxPage() {
  const { orgId } = useOrg();
  const [stagedItems, setStagedItems] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');

  // Dropdown data for manual corrections
  const [properties, setProperties] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data: pData } = await supabase.from('properties').select('*');
      if (pData) setProperties(pData);
      const { data: aData } = await supabase.from('chart_of_accounts').select('*');
      if (aData) setAccounts(aData);
    }
    fetchData();
  },[]);

  async function handleBulkUpload(e: any) {
    const files = Array.from(e.target.files) as File[];
    if (files.length === 0) return;
    
    setIsProcessing(true);
    const newStagedItems = [...stagedItems];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Processing file ${i + 1} of ${files.length}: ${file.name}...`);
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const res = await fetch('/api/magic-upload', { method: 'POST', body: formData });
        const aiResult = await res.json();
        
        if (!res.ok) throw new Error(aiResult.error);

        // --- DUPLICATE DETECTION ENGINE ---
        let duplicateWarning = null;
        
        if (aiResult.category === 'TENANT_INFO' || aiResult.category === 'LEASE') {
          const nameToCheck = aiResult.data.name || aiResult.data.tenant_name;
          if (nameToCheck) {
            const { data: existing } = await supabase.from('tenants').select('id').ilike('name', `%${nameToCheck}%`).maybeSingle();
            if (existing) duplicateWarning = `A tenant matching "${nameToCheck}" already exists.`;
          }
        } else if (aiResult.category === 'INVOICE') {
          const { data: existing } = await supabase.from('transactions').select('id').eq('total_amount', aiResult.data.amount).eq('date', aiResult.data.date).maybeSingle();
          if (existing) duplicateWarning = `An invoice for $${aiResult.data.amount} on ${aiResult.data.date} already exists.`;
        } else if (aiResult.category === 'PROPERTY_INFO') {
          const { data: existing } = await supabase.from('properties').select('id').ilike('name', `%${aiResult.data.name}%`).maybeSingle();
          if (existing) duplicateWarning = `A property named "${aiResult.data.name}" already exists.`;
        }

        newStagedItems.push({
          id: Math.random().toString(),
          fileName: aiResult.fileName,
          category: aiResult.category,
          data: aiResult.data,
          duplicateWarning,
          status: 'Pending Review'
        });

      } catch (err: any) {
        newStagedItems.push({ id: Math.random().toString(), fileName: file.name, category: 'ERROR', data: {}, duplicateWarning: err.message, status: 'Error' });
      }
    }

    setStagedItems(newStagedItems);
    setIsProcessing(false);
    setProgress('');
  }

  async function approveItem(item: any, index: number) {
    try {
      if (item.category === 'TENANT_INFO') {
        await supabase.from('tenants').insert([{ name: item.data.name, contact_email: item.data.email, contact_phone: item.data.phone, entity_type: item.data.entity_type, status: 'active', organization_id: orgId }]);
      } 
      else if (item.category === 'PROPERTY_INFO') {
        await supabase.from('properties').insert([{ name: item.data.name, address: item.data.address, total_sqft: Number(item.data.sqft), organization_id: orgId }]);
      }
      else if (item.category === 'INVOICE') {
        const expAcc = accounts.find(a => a.account_type === 'Expense')?.id;
        const { data: txn } = await supabase.from('transactions').insert([{ date: item.data.date, description: item.data.payee, total_amount: Number(item.data.amount), status: 'Approved', organization_id: orgId }]).select().single();
        if (txn) await supabase.from('journal_entries').insert([{ transaction_id: txn.id, account_id: expAcc, description: item.data.description, debit: Number(item.data.amount), credit: 0, organization_id: orgId }]);
      }
      else if (item.category === 'LEASE') {
        const { data: tData } = await supabase.from('tenants').insert([{ name: item.data.tenant_name, status: 'active', organization_id: orgId }]).select().single();
        if (tData) await supabase.from('leases').insert([{ tenant_id: tData.id, start_date: item.data.start_date, end_date: item.data.end_date, base_rent_amount: Number(item.data.rent_amount), organization_id: orgId }]);
      }

      // Remove from staging area
      const newItems =[...stagedItems];
      newItems.splice(index, 1);
      setStagedItems(newItems);
      alert(`${item.category} Approved and Saved!`);
    } catch (error: any) {
      alert("Error saving: " + error.message);
    }
  }

  function discardItem(index: number) {
    const newItems = [...stagedItems];
    newItems.splice(index, 1);
    setStagedItems(newItems);
  }

  function updateItemData(index: number, field: string, value: string) {
    const newItems = [...stagedItems];
    newItems[index].data[field] = value;
    setStagedItems(newItems);
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Magic Inbox (Universal Intake)</h2>
        <label className={`px-6 py-2 rounded-md font-bold text-white transition shadow-sm cursor-pointer ${isProcessing ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
          {isProcessing ? 'Processing...' : '✨ Upload Batch Files'}
          <input type="file" multiple accept=".pdf,image/*,.csv,.xlsx" onChange={handleBulkUpload} className="hidden" disabled={isProcessing} />
        </label>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        
        {isProcessing && (
          <div className="mb-8 bg-purple-50 border border-purple-200 p-6 rounded-xl text-center shadow-sm">
            <div className="animate-spin text-4xl mb-2">⚙️</div>
            <h3 className="font-bold text-purple-900">AI is analyzing your documents...</h3>
            <p className="text-purple-700 text-sm mt-1">{progress}</p>
          </div>
        )}

        {stagedItems.length === 0 && !isProcessing && (
          <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-16 text-center">
            <div className="text-6xl mb-4">📥</div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Your Inbox is Empty</h3>
            <p className="text-gray-500 max-w-md mx-auto">Upload a mixed batch of Leases, Invoices, Excel sheets, or Tenant Contacts. The AI will automatically route them to the correct database tables.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stagedItems.map((item, index) => (
            <div key={item.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <span className="bg-blue-600 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">{item.category}</span>
                  <span className="text-sm font-medium truncate max-w-[200px]">{item.fileName}</span>
                </div>
                <button onClick={() => discardItem(index)} className="text-slate-400 hover:text-red-400 font-bold">&times;</button>
              </div>

              <div className="p-6 flex-1 space-y-4">
                {item.duplicateWarning && (
                  <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg text-sm font-bold flex items-start">
                    <span className="mr-2">⚠️</span> {item.duplicateWarning}
                  </div>
                )}

                {/* Dynamic Form based on AI Category */}
                {item.category === 'INVOICE' && (
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-500">Payee</label><input type="text" className="w-full border p-2 rounded text-sm font-bold" value={item.data.payee || ''} onChange={(e) => updateItemData(index, 'payee', e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-500">Amount ($)</label><input type="number" className="w-full border p-2 rounded text-sm text-green-700 font-bold" value={item.data.amount || ''} onChange={(e) => updateItemData(index, 'amount', e.target.value)} /></div>
                      <div><label className="text-xs text-gray-500">Date</label><input type="date" className="w-full border p-2 rounded text-sm" value={item.data.date || ''} onChange={(e) => updateItemData(index, 'date', e.target.value)} /></div>
                    </div>
                  </div>
                )}

                {item.category === 'LEASE' && (
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-500">Tenant Name</label><input type="text" className="w-full border p-2 rounded text-sm font-bold" value={item.data.tenant_name || ''} onChange={(e) => updateItemData(index, 'tenant_name', e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="text-xs text-gray-500">Start Date</label><input type="date" className="w-full border p-2 rounded text-sm" value={item.data.start_date || ''} onChange={(e) => updateItemData(index, 'start_date', e.target.value)} /></div>
                      <div><label className="text-xs text-gray-500">Rent ($)</label><input type="number" className="w-full border p-2 rounded text-sm text-green-700 font-bold" value={item.data.rent_amount || ''} onChange={(e) => updateItemData(index, 'rent_amount', e.target.value)} /></div>
                    </div>
                  </div>
                )}

                {item.category === 'TENANT_INFO' && (
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-500">Name</label><input type="text" className="w-full border p-2 rounded text-sm font-bold" value={item.data.name || ''} onChange={(e) => updateItemData(index, 'name', e.target.value)} /></div>
                    <div><label className="text-xs text-gray-500">Email</label><input type="email" className="w-full border p-2 rounded text-sm" value={item.data.email || ''} onChange={(e) => updateItemData(index, 'email', e.target.value)} /></div>
                    <div><label className="text-xs text-gray-500">Phone</label><input type="text" className="w-full border p-2 rounded text-sm" value={item.data.phone || ''} onChange={(e) => updateItemData(index, 'phone', e.target.value)} /></div>
                  </div>
                )}

                {item.category === 'PROPERTY_INFO' && (
                  <div className="space-y-3">
                    <div><label className="text-xs text-gray-500">Property Name</label><input type="text" className="w-full border p-2 rounded text-sm font-bold" value={item.data.name || ''} onChange={(e) => updateItemData(index, 'name', e.target.value)} /></div>
                    <div><label className="text-xs text-gray-500">Address</label><input type="text" className="w-full border p-2 rounded text-sm" value={item.data.address || ''} onChange={(e) => updateItemData(index, 'address', e.target.value)} /></div>
                    <div><label className="text-xs text-gray-500">SqFt</label><input type="number" className="w-full border p-2 rounded text-sm" value={item.data.sqft || ''} onChange={(e) => updateItemData(index, 'sqft', e.target.value)} /></div>
                  </div>
                )}

                {item.category === 'UNKNOWN' && (
                  <div className="p-4 bg-gray-50 border rounded text-sm text-gray-600 italic">
                    The AI could not confidently classify this document. Please discard and enter manually.
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-200 flex space-x-3">
                <button onClick={() => discardItem(index)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded font-bold hover:bg-gray-100 transition">Discard</button>
                <button onClick={() => approveItem(item, index)} disabled={item.category === 'UNKNOWN' || item.category === 'ERROR'} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold transition shadow-sm disabled:bg-gray-400">
                  Approve & Save ✓
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}