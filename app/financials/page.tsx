"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import Papa from 'papaparse';
import { usePlaidLink } from 'react-plaid-link';
import { useOrg } from '@/app/context/OrgContext';

export default function FinancialsPage() {
  const { orgId } = useOrg(); // FIX: Added orgId from context!
  
  const[transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const[tenantLeases, setTenantLeases] = useState<any[]>([]);
  
  const[isModalOpen, setIsModalOpen] = useState(false);
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [splits, setSplits] = useState([{ account_id: '', property_id: '', amount: '', memo: '' }]);

  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const[isProcessingCsv, setIsProcessingCsv] = useState(false);

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => { 
    if (orgId) {
      fetchData();
      generatePlaidToken();
    }
  },[orgId]);

  async function fetchData() {
    const { data: txns } = await supabase.from('transactions').select('*').order('date', { ascending: false });
    if (txns) setTransactions(txns);
    const { data: accs } = await supabase.from('chart_of_accounts').select('*').order('name', { ascending: true });
    if (accs) setAccounts(accs);
    const { data: props } = await supabase.from('properties').select('*').order('name', { ascending: true });
    if (props) setProperties(props);
    const { data: leases } = await supabase.from('leases').select('*, tenants(name)');
    if (leases) setTenantLeases(leases);
  }

  async function generatePlaidToken() {
    try {
      const res = await fetch('/api/plaid-create-link', { method: 'POST' });
      const data = await res.json();
      if (data.link_token) setLinkToken(data.link_token);
    } catch (e) { console.error("Plaid Token Error", e); }
  }

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: linkToken!,
    onSuccess: async (public_token, metadata) => {
      try {
        await fetch('/api/plaid-exchange-token', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token, institution_name: metadata.institution?.name || 'Bank' })
        });
        alert(`Successfully connected ${metadata.institution?.name}!`);
      } catch (e: any) { alert("Error saving bank: " + e.message); }
    },
  });

  async function syncBanks() {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/plaid-sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Bank Sync Complete! Imported ${data.synced} new transactions.`);
      fetchData();
    } catch (e: any) { alert("Sync Error: " + e.message); } 
    finally { setIsSyncing(false); }
  }

  useEffect(() => {
    if (!description) return;
    const lowerDesc = description.toLowerCase();
    const matchedLease = tenantLeases.find(l => lowerDesc.includes(l.tenants?.name?.toLowerCase()));
    if (matchedLease) {
      const rentAcc = accounts.find(a => a.name.includes('Rental Income'))?.id || '';
      const camAcc = accounts.find(a => a.name.includes('CAM'))?.id || '';
      const autoSplits =[];
      if (matchedLease.base_rent_amount > 0) autoSplits.push({ account_id: rentAcc, property_id: matchedLease.property_id || '', amount: matchedLease.base_rent_amount, memo: 'Base Rent' });
      if (matchedLease.cam_charge > 0) autoSplits.push({ account_id: camAcc, property_id: matchedLease.property_id || '', amount: matchedLease.cam_charge, memo: 'CAM Escrow' });
      if (matchedLease.tax_charge > 0) autoSplits.push({ account_id: camAcc, property_id: matchedLease.property_id || '', amount: matchedLease.tax_charge, memo: 'Tax Escrow' });
      if (matchedLease.insurance_charge > 0) autoSplits.push({ account_id: camAcc, property_id: matchedLease.property_id || '', amount: matchedLease.insurance_charge, memo: 'Insurance Escrow' });
      if (autoSplits.length > 0) {
        setSplits(autoSplits);
        setTotalAmount(autoSplits.reduce((sum, s) => sum + Number(s.amount), 0).toString());
      }
    }
  }, [description]);

  function addSplitRow() { setSplits([...splits, { account_id: '', property_id: '', amount: '', memo: '' }]); }
  function updateSplit(index: number, field: string, value: string) { const newSplits = [...splits]; newSplits[index] = { ...newSplits[index], [field]: value }; setSplits(newSplits); }
  
  async function handleAccountSelect(index: number, value: string) {
    if (value === 'NEW_CATEGORY') {
      const newName = prompt("Enter new category name:"); const type = prompt("Enter account type (Asset, Liability, Equity, Revenue, Expense):", "Expense");
      if (!newName || !type) return;
      const { data } = await supabase.from('chart_of_accounts').insert([{ name: newName, account_type: type, organization_id: orgId }]).select().single();
      if (data) { await fetchData(); updateSplit(index, 'account_id', data.id); }
    } else { updateSplit(index, 'account_id', value); }
  }

  const splitTotal = splits.reduce((sum, split) => sum + Number(split.amount || 0), 0);
  const isBalanced = Number(totalAmount) === splitTotal && Number(totalAmount) > 0;

  async function saveTransaction() {
    if (!isBalanced) return alert("Splits must equal total amount!");
    try {
      const { data: txnData } = await supabase.from('transactions').insert([{ date, description, total_amount: Number(totalAmount), status: 'Approved', organization_id: orgId }]).select().single();
      const journalEntries = splits.map(split => ({ transaction_id: txnData?.id, account_id: split.account_id, property_id: split.property_id || null, description: split.memo || description, debit: Number(split.amount), credit: 0, organization_id: orgId }));
      await supabase.from('journal_entries').insert(journalEntries);
      
      fetch('/api/qbo-sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, description, amount: totalAmount, isRevenue: false })
      }).catch(e => console.error("QBO Sync failed", e));

      setIsModalOpen(false); setDate(''); setDescription(''); setTotalAmount(''); setSplits([{ account_id: '', property_id: '', amount: '', memo: '' }]); fetchData();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function handleBulkFileUpload(event: any) {
    const files = Array.from(event.target.files); if (files.length === 0) return;
    setIsProcessingCsv(true);
    const { data: pastEntries } = await supabase.from('journal_entries').select('account_id, description, transactions(description)');
    const memoryMap: Record<string, string> = {};
    pastEntries?.forEach(entry => {
      const desc = (entry.transactions as any)?.description?.toLowerCase() || entry.description?.toLowerCase();
      if (desc && entry.account_id) memoryMap[desc] = entry.account_id;
    });

    let allCombinedRows: any[] =[];
    for (const file of files as any[]) {
      const parsedData: any = await new Promise((resolve) => { Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => resolve(results.data) }) });
      const mappedRows = parsedData.map((row: any) => {
        const desc = row.Description || row.description || row.Payee || '';
        return { date: row.Date || row.date || '', description: desc, amount: Math.abs(Number(row.Amount || row.amount || 0)), account_id: memoryMap[desc.toLowerCase()] || '', property_id: '', source_file: file.name };
      });
      allCombinedRows =[...allCombinedRows, ...mappedRows];
    }
    setCsvRows(allCombinedRows); setIsProcessingCsv(false); setIsCsvModalOpen(true);
  }

  function updateCsvRow(index: number, field: string, value: string) { const newRows = [...csvRows]; newRows[index] = { ...newRows[index], [field]: value }; setCsvRows(newRows); }

  async function saveCsvTransactions() {
    for (const row of csvRows) {
      if (!row.account_id) continue; 
      const { data: txnData } = await supabase.from('transactions').insert([{ date: row.date, description: row.description, total_amount: row.amount, status: 'Approved', organization_id: orgId }]).select().single();
      await supabase.from('journal_entries').insert([{ transaction_id: txnData?.id, account_id: row.account_id, property_id: row.property_id || null, description: `Imported from ${row.source_file}`, debit: row.amount, credit: 0, organization_id: orgId }]);
    }
    setIsCsvModalOpen(false); setCsvRows([]); fetchData(); alert("Bulk CSV Imported Successfully!");
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">General Ledger</h2>
        <div className="space-x-3 flex items-center">
          <button onClick={syncBanks} disabled={isSyncing} className={`px-4 py-2 rounded-md font-medium text-white transition shadow-sm ${isSyncing ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>{isSyncing ? 'Syncing...' : '🔄 Sync Banks'}</button>
          <button onClick={() => openPlaid()} disabled={!plaidReady} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-md font-medium transition shadow-sm flex items-center"><span className="mr-2">🏦</span> Connect Bank</button>
          <label className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-md font-medium transition shadow-sm cursor-pointer">{isProcessingCsv ? 'Processing...' : 'Bulk Import CSVs'}<input type="file" accept=".csv" multiple className="hidden" onChange={handleBulkFileUpload} disabled={isProcessingCsv} /></label>
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">+ New Transaction</button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-8 relative">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th></tr></thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transactions.map((txn) => (<tr key={txn.id} className="hover:bg-gray-50"><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{txn.date}</td><td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{txn.description}</td><td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">${txn.total_amount}</td></tr>))}
            </tbody>
          </table>
        </div>

        {isCsvModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
              <h3 className="text-xl font-bold mb-2 text-gray-800">Review Bulk CSV Import</h3>
              <div className="flex-1 overflow-y-auto mb-6 border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0"><tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bank File</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th></tr></thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {csvRows.map((row, index) => (
                      <tr key={index} className={row.account_id ? 'bg-white' : 'bg-red-50'}><td className="px-4 py-2 text-xs text-gray-400">{row.source_file}</td><td className="px-4 py-2 text-sm">{row.date}</td><td className="px-4 py-2 text-sm font-medium">{row.description}</td><td className="px-4 py-2 text-sm">${row.amount}</td><td className="px-4 py-2"><select className="border p-1 rounded text-sm w-full" value={row.account_id} onChange={(e) => updateCsvRow(index, 'account_id', e.target.value)}><option value="">-- Select Category --</option>{accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</select></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t"><button onClick={() => setIsCsvModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button><button onClick={saveCsvTransactions} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium">Approve & Import All</button></div>
            </div>
          </div>
        )}

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-6 text-gray-800">Record Transaction</h3>
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div><label className="block text-sm font-medium mb-1">Date</label><input type="date" className="w-full border p-2 rounded" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                <div><label className="block text-sm font-medium mb-1 text-blue-600">Payee / Description (Auto-Splits)</label><input type="text" placeholder="Type a tenant name..." className="w-full border-2 border-blue-200 p-2 rounded outline-none" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div><label className="block text-sm font-medium mb-1">Total Amount</label><input type="number" className="w-full border p-2 rounded font-bold" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} /></div>
              </div>
              <div className="mb-4 flex justify-between items-end"><h4 className="font-semibold text-gray-800">Categorize (Splits)</h4><button onClick={addSplitRow} className="text-sm text-blue-600 font-medium">+ Add Split Line</button></div>
              <div className="space-y-3 mb-6">
                {splits.map((split, index) => (
                  <div key={index} className="flex space-x-2 items-center">
                    <select className="w-1/4 border p-2 rounded text-sm" value={split.account_id} onChange={(e) => handleAccountSelect(index, e.target.value)}><option value="">Select Category...</option><option value="NEW_CATEGORY" className="font-bold text-blue-600">+ Add New Category...</option><optgroup label="Existing Categories">{accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}</optgroup></select>
                    <select className="w-1/4 border p-2 rounded text-sm" value={split.property_id} onChange={(e) => updateSplit(index, 'property_id', e.target.value)}><option value="">Assign Property (Opt)</option>{properties.map(prop => <option key={prop.id} value={prop.id}>{prop.name}</option>)}</select>
                    <input type="text" placeholder="Split Memo" className="flex-1 border p-2 rounded text-sm" value={split.memo} onChange={(e) => updateSplit(index, 'memo', e.target.value)} />
                    <input type="number" placeholder="$0.00" className="w-24 border p-2 rounded text-sm" value={split.amount} onChange={(e) => updateSplit(index, 'amount', e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center border-t pt-4 mt-6">
                <div className="text-sm"><span className="text-gray-500">Split Total: </span><span className={`font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>${splitTotal.toFixed(2)} / ${Number(totalAmount || 0).toFixed(2)}</span></div>
                <div className="space-x-3"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded">Cancel</button><button onClick={saveTransaction} disabled={!isBalanced} className={`px-4 py-2 rounded text-white ${isBalanced ? 'bg-blue-600' : 'bg-gray-400'}`}>Save Transaction</button></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}