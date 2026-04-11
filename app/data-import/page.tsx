"use client";
import { useState } from 'react';
import { supabase } from '@/app/utils/supabase';
import Papa from 'papaparse';

export default function DataImportPage() {
  const [isProcessing, setIsProcessing] = useState(false);

  async function handlePropertyImport(e: any) {
    const file = e.target.files[0]; if (!file) return;
    setIsProcessing(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        try {
          const props = results.data.map((row: any) => ({
            name: row.Name || row.name,
            address: row.Address || row.address,
            total_sqft: Number(row.SqFt || row.sqft || 0)
          })).filter(p => p.name);
          
          if (props.length === 0) throw new Error("No valid properties found. Ensure your CSV has 'Name', 'Address', and 'SqFt' columns.");
          
          const { error } = await supabase.from('properties').insert(props);
          if (error) throw error;
          alert(`Successfully imported ${props.length} properties!`);
        } catch (error: any) { alert("Import Error: " + error.message); } finally { setIsProcessing(false); }
      }
    });
  }

  async function handleTenantImport(e: any) {
    const file = e.target.files[0]; if (!file) return;
    setIsProcessing(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        try {
          const tenants = results.data.map((row: any) => ({
            name: row.Name || row.name,
            contact_email: row.Email || row.email,
            contact_phone: row.Phone || row.phone,
            entity_type: row.Entity || row.entity || 'Business',
            status: 'active'
          })).filter(t => t.name);
          
          if (tenants.length === 0) throw new Error("No valid tenants found. Ensure your CSV has 'Name', 'Email', and 'Phone' columns.");
          
          const { error } = await supabase.from('tenants').insert(tenants);
          if (error) throw error;
          alert(`Successfully imported ${tenants.length} tenants!`);
        } catch (error: any) { alert("Import Error: " + error.message); } finally { setIsProcessing(false); }
      }
    });
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4"><h2 className="text-xl font-semibold text-gray-800">Mass Data Migration Engine</h2></header>
      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="text-4xl mb-4">🏢</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Import Properties</h3>
            <p className="text-sm text-gray-500 mb-6">Upload a CSV with columns: <strong>Name, Address, SqFt</strong></p>
            <label className={`w-full flex justify-center items-center py-3 rounded-lg font-bold text-white transition shadow-sm cursor-pointer ${isProcessing ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isProcessing ? 'Importing...' : 'Upload Properties CSV'}
              <input type="file" accept=".csv" onChange={handlePropertyImport} className="hidden" disabled={isProcessing} />
            </label>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Import Tenants</h3>
            <p className="text-sm text-gray-500 mb-6">Upload a CSV with columns: <strong>Name, Email, Phone, Entity</strong></p>
            <label className={`w-full flex justify-center items-center py-3 rounded-lg font-bold text-white transition shadow-sm cursor-pointer ${isProcessing ? 'bg-green-400' : 'bg-green-600 hover:bg-green-700'}`}>
              {isProcessing ? 'Importing...' : 'Upload Tenants CSV'}
              <input type="file" accept=".csv" onChange={handleTenantImport} className="hidden" disabled={isProcessing} />
            </label>
          </div>

        </div>
      </main>
    </>
  );
}