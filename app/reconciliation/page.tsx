"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function ReconciliationPage() {
  const [bankTxns, setBankTxns] = useState<any[]>([]);
  const[ledgerTxns, setLedgerTxns] = useState<any[]>([]);
  const[isLoading, setIsLoading] = useState(true);
  const [isAutoMatching, setIsAutoMatching] = useState(false);

  const[selectedBankTxn, setSelectedBankTxn] = useState<string | null>(null);
  const[selectedLedgerTxn, setSelectedLedgerTxn] = useState<string | null>(null);

  useEffect(() => { fetchData(); },[]);

  async function fetchData() {
    setIsLoading(true);
    const { data: txns } = await supabase.from('transactions').select('*').eq('is_reconciled', false).order('date', { ascending: false });
    if (txns) { setBankTxns(txns); setLedgerTxns(txns); }
    setIsLoading(false);
  }

  async function matchTransactions() {
    if (!selectedBankTxn || !selectedLedgerTxn) return alert("Select one item from both columns.");
    try {
      await supabase.from('transactions').update({ is_reconciled: true }).eq('id', selectedLedgerTxn);
      alert("Transactions matched and reconciled!");
      setSelectedBankTxn(null); setSelectedLedgerTxn(null); fetchData();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  // NEW: AI Auto-Match Engine
  async function autoMatch() {
    setIsAutoMatching(true);
    let matchCount = 0;
    try {
      for (const bank of bankTxns) {
        // Find a ledger entry with the exact same amount and a date within 2 days
        const match = ledgerTxns.find(ledger => {
          if (ledger.id === bank.id) return false; // In this simulation, we don't match it to itself
          const amountMatch = Number(ledger.total_amount) === Number(bank.total_amount);
          
          const bankDate = new Date(bank.date).getTime();
          const ledgerDate = new Date(ledger.date).getTime();
          const dayDifference = Math.abs((bankDate - ledgerDate) / (1000 * 60 * 60 * 24));
          const dateMatch = dayDifference <= 2;

          return amountMatch && dateMatch;
        });

        if (match) {
          await supabase.from('transactions').update({ is_reconciled: true }).eq('id', match.id);
          matchCount++;
          // Remove from local arrays so it doesn't get matched twice in this loop
          setLedgerTxns(prev => prev.filter(l => l.id !== match.id));
        }
      }
      alert(`✨ AI Auto-Match Complete! Successfully reconciled ${matchCount} transactions.`);
      fetchData();
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsAutoMatching(false); }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Bank Reconciliation</h2>
        <div className="space-x-3">
          <button onClick={autoMatch} disabled={isAutoMatching || bankTxns.length === 0} className={`px-4 py-2 rounded-md font-medium text-white transition shadow-sm ${isAutoMatching || bankTxns.length === 0 ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
            {isAutoMatching ? 'Scanning...' : '✨ AI Auto-Match'}
          </button>
          <button onClick={matchTransactions} disabled={!selectedBankTxn || !selectedLedgerTxn} className={`px-6 py-2 rounded-md font-bold text-white transition shadow-sm ${!selectedBankTxn || !selectedLedgerTxn ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
            ✓ Match Selected
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-800 mb-2">Reconciliation Engine</h3>
          <p className="text-sm text-gray-600">Click "AI Auto-Match" to automatically pair identical amounts and dates. For remaining items, select a raw transaction on the left and match it to the ledger entry on the right.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-250px)]">
          <div className="w-full md:w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-800 text-white border-b border-slate-900"><h3 className="font-bold">Raw Bank Feed (Plaid / CSV)</h3></div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50">
              {isLoading ? <p className="p-4 text-center text-gray-500">Loading...</p> : bankTxns.map(txn => (
                <div key={`bank_${txn.id}`} onClick={() => setSelectedBankTxn(txn.id)} className={`p-4 rounded-lg border cursor-pointer transition ${selectedBankTxn === txn.id ? 'bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                  <div className="flex justify-between items-center"><div><p className="font-bold text-gray-900">{txn.description}</p><p className="text-xs text-gray-500">{txn.date}</p></div><p className="font-black text-gray-900">${Number(txn.total_amount).toFixed(2)}</p></div>
                </div>
              ))}
              {bankTxns.length === 0 && !isLoading && <p className="p-8 text-center text-gray-500">No un-reconciled bank transactions.</p>}
            </div>
          </div>

          <div className="w-full md:w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 bg-blue-900 text-white border-b border-blue-950"><h3 className="font-bold">General Ledger (OphirCRE Books)</h3></div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-blue-50">
              {isLoading ? <p className="p-4 text-center text-gray-500">Loading...</p> : ledgerTxns.map(txn => (
                <div key={`ledger_${txn.id}`} onClick={() => setSelectedLedgerTxn(txn.id)} className={`p-4 rounded-lg border cursor-pointer transition ${selectedLedgerTxn === txn.id ? 'bg-green-50 border-green-500 shadow-md ring-1 ring-green-500' : 'bg-white border-gray-200 hover:border-green-300'}`}>
                  <div className="flex justify-between items-center"><div><p className="font-bold text-gray-900">{txn.description}</p><p className="text-xs text-gray-500">{txn.date}</p></div><p className="font-black text-gray-900">${Number(txn.total_amount).toFixed(2)}</p></div>
                </div>
              ))}
              {ledgerTxns.length === 0 && !isLoading && <p className="p-8 text-center text-gray-500">Your books are fully reconciled!</p>}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}