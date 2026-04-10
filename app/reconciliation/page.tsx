"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function ReconciliationPage() {
  const [bankTxns, setBankTxns] = useState<any[]>([]);
  const [ledgerTxns, setLedgerTxns] = useState<any[]>([]);
  const[isLoading, setIsLoading] = useState(true);

  // Matching State
  const [selectedBankTxn, setSelectedBankTxn] = useState<string | null>(null);
  const [selectedLedgerTxn, setSelectedLedgerTxn] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  },[]);

  async function fetchData() {
    setIsLoading(true);
    // 1. Fetch "Bank" transactions (Simulated here as un-reconciled transactions from Plaid/CSV)
    // In a real Plaid setup, you would query a separate 'plaid_raw_transactions' table. 
    // Here we use our transactions table where is_reconciled is false.
    const { data: txns } = await supabase
      .from('transactions')
      .select('*')
      .eq('is_reconciled', false)
      .order('date', { ascending: false });
    
    if (txns) {
      setBankTxns(txns); // Left side
      setLedgerTxns(txns); // Right side
    }
    setIsLoading(false);
  }

  async function matchTransactions() {
    if (!selectedBankTxn || !selectedLedgerTxn) return alert("Select one item from both columns to match.");
    
    try {
      // Mark as reconciled in the database
      await supabase.from('transactions').update({ is_reconciled: true }).eq('id', selectedLedgerTxn);
      
      alert("Transactions matched and reconciled successfully!");
      setSelectedBankTxn(null);
      setSelectedLedgerTxn(null);
      fetchData();
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Bank Reconciliation</h2>
        <button 
          onClick={matchTransactions} 
          disabled={!selectedBankTxn || !selectedLedgerTxn}
          className={`px-6 py-2 rounded-md font-bold text-white transition shadow-sm ${!selectedBankTxn || !selectedLedgerTxn ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
        >
          ✓ Match & Reconcile
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="mb-6 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="font-bold text-gray-800 mb-2">Reconciliation Engine</h3>
          <p className="text-sm text-gray-600">Select a raw transaction from your bank feed on the left, and match it to the corresponding General Ledger entry on the right to verify your books.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-250px)]">
          
          {/* LEFT COLUMN: Bank Feed */}
          <div className="w-full md:w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-800 text-white border-b border-slate-900">
              <h3 className="font-bold">Raw Bank Feed (Plaid / CSV)</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50">
              {isLoading ? <p className="p-4 text-center text-gray-500">Loading...</p> : bankTxns.map(txn => (
                <div 
                  key={`bank_${txn.id}`} 
                  onClick={() => setSelectedBankTxn(txn.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition ${selectedBankTxn === txn.id ? 'bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-500' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900">{txn.description}</p>
                      <p className="text-xs text-gray-500">{txn.date}</p>
                    </div>
                    <p className="font-black text-gray-900">${Number(txn.total_amount).toFixed(2)}</p>
                  </div>
                </div>
              ))}
              {bankTxns.length === 0 && !isLoading && <p className="p-8 text-center text-gray-500">No un-reconciled bank transactions.</p>}
            </div>
          </div>

          {/* RIGHT COLUMN: General Ledger */}
          <div className="w-full md:w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 bg-blue-900 text-white border-b border-blue-950">
              <h3 className="font-bold">General Ledger (OphirCRE Books)</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-blue-50">
              {isLoading ? <p className="p-4 text-center text-gray-500">Loading...</p> : ledgerTxns.map(txn => (
                <div 
                  key={`ledger_${txn.id}`} 
                  onClick={() => setSelectedLedgerTxn(txn.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition ${selectedLedgerTxn === txn.id ? 'bg-green-50 border-green-500 shadow-md ring-1 ring-green-500' : 'bg-white border-gray-200 hover:border-green-300'}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900">{txn.description}</p>
                      <p className="text-xs text-gray-500">{txn.date}</p>
                    </div>
                    <p className="font-black text-gray-900">${Number(txn.total_amount).toFixed(2)}</p>
                  </div>
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