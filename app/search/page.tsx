"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useSearchParams } from 'next/navigation';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [tenants, setTenants] = useState<any[]>([]);
  const[properties, setProperties] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]); // NEW: OCR Ledger Search
  const[isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (query) performSearch();
  }, [query]);

  async function performSearch() {
    setIsLoading(true);
    
    const { data: tData } = await supabase.from('tenants').select('*').ilike('name', `%${query}%`);
    if (tData) setTenants(tData);

    const { data: pData } = await supabase.from('properties').select('*').ilike('name', `%${query}%`);
    if (pData) setProperties(pData);

    const { data: tkData } = await supabase.from('tasks').select('*').ilike('title', `%${query}%`);
    if (tkData) setTasks(tkData);

    // NEW: Search the General Ledger descriptions (OCR Extracted Text)
    const { data: txnData } = await supabase.from('journal_entries').select('*, transactions(date), chart_of_accounts(name)').ilike('description', `%${query}%`);
    if (txnData) setTransactions(txnData);

    setIsLoading(false);
  }

  return (
    <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Search Results for: "{query}"</h2>

      {isLoading ? (
        <p>Searching database...</p>
      ) : (
        <div className="space-y-8 max-w-5xl">
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">Tenants ({tenants.length})</h3>
            {tenants.length > 0 ? tenants.map(t => (
              <div key={t.id} className="p-3 hover:bg-gray-50 border-b last:border-0">
                <p className="font-bold text-blue-600">{t.name}</p>
                <p className="text-sm text-gray-500">{t.contact_email || 'No email'} | {t.contact_phone || 'No phone'}</p>
              </div>
            )) : <p className="text-sm text-gray-500">No tenants found.</p>}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">Properties ({properties.length})</h3>
            {properties.length > 0 ? properties.map(p => (
              <div key={p.id} className="p-3 hover:bg-gray-50 border-b last:border-0">
                <p className="font-bold text-blue-600">{p.name}</p>
                <p className="text-sm text-gray-500">{p.address}</p>
              </div>
            )) : <p className="text-sm text-gray-500">No properties found.</p>}
          </div>

          {/* NEW: Ledger Search Results */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">Financial Records & Invoices ({transactions.length})</h3>
            {transactions.length > 0 ? transactions.map(t => (
              <div key={t.id} className="p-3 hover:bg-gray-50 border-b last:border-0 flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">{t.description}</p>
                  <p className="text-sm text-gray-500">{t.chart_of_accounts?.name} | {t.transactions?.date}</p>
                </div>
                <p className="font-black text-gray-900">${Number(t.debit || t.credit).toFixed(2)}</p>
              </div>
            )) : <p className="text-sm text-gray-500">No financial records found.</p>}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">Tasks ({tasks.length})</h3>
            {tasks.length > 0 ? tasks.map(t => (
              <div key={t.id} className="p-3 hover:bg-gray-50 border-b last:border-0">
                <p className="font-bold text-blue-600">{t.title}</p>
                <p className="text-sm text-gray-500">Status: {t.status}</p>
              </div>
            )) : <p className="text-sm text-gray-500">No tasks found.</p>}
          </div>

        </div>
      )}
    </main>
  );
}