"use client";
import { useState } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function TaxCenterPage() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [isExporting, setIsExporting] = useState(false);

  async function exportMasterLedger() {
    setIsExporting(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      // Fetch all journal entries for the year
      const { data: entries } = await supabase
        .from('journal_entries')
        .select('debit, credit, description, chart_of_accounts(name, account_type), properties(name), transactions(date)')
        .gte('transactions.date', startDate)
        .lte('transactions.date', endDate)
        .order('transactions(date)', { ascending: true });

      if (!entries || entries.length === 0) return alert("No financial data found for this year.");

      let csvContent = "Date,Property,Account,Type,Description,Debit,Credit\n";
      
      entries.forEach((e: any) => {
        const date = Array.isArray(e.transactions) ? e.transactions[0]?.date : e.transactions?.date;
        const prop = Array.isArray(e.properties) ? e.properties[0]?.name : e.properties?.name || 'Global';
        const accName = Array.isArray(e.chart_of_accounts) ? e.chart_of_accounts[0]?.name : e.chart_of_accounts?.name;
        const accType = Array.isArray(e.chart_of_accounts) ? e.chart_of_accounts[0]?.account_type : e.chart_of_accounts?.account_type;
        const desc = e.description?.replace(/"/g, '""') || '';
        
        csvContent += `${date},"${prop}","${accName}","${accType}","${desc}",${e.debit},${e.credit}\n`;
      });

      downloadCSV(csvContent, `OphirCRE_Master_Ledger_${year}.csv`);
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsExporting(false);
    }
  }

  async function exportCapEx() {
    setIsExporting(true);
    try {
      const { data: assets } = await supabase
        .from('capex_assets')
        .select('*, properties(name)')
        .order('date_in_service', { ascending: true });

      if (!assets || assets.length === 0) return alert("No CapEx data found.");

      let csvContent = "Property,Asset Description,Date In Service,Cost Basis,Useful Life (Years),Annual Depreciation\n";
      
      assets.forEach(a => {
        const prop = a.properties?.name || 'Global';
        const desc = a.description?.replace(/"/g, '""') || '';
        const annualDep = Number(a.cost) / Number(a.useful_life_years);
        csvContent += `"${prop}","${desc}",${a.date_in_service},${a.cost},${a.useful_life_years},${annualDep.toFixed(2)}\n`;
      });

      downloadCSV(csvContent, `OphirCRE_CapEx_Schedule_${year}.csv`);
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setIsExporting(false);
    }
  }

  function downloadCSV(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">CPA & Tax Center</h2>
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Tax Year:</label>
          <input type="number" className="border p-2 rounded outline-none w-24 text-sm" value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="max-w-4xl mx-auto space-y-6">
          
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800">Master General Ledger Export</h3>
              <p className="text-sm text-gray-500 mt-1">Downloads every transaction, split, and journal entry for the selected year.</p>
            </div>
            <button onClick={exportMasterLedger} disabled={isExporting} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition shadow-sm whitespace-nowrap">
              {isExporting ? 'Generating...' : '📥 Export Ledger CSV'}
            </button>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800">CapEx & Depreciation Schedule</h3>
              <p className="text-sm text-gray-500 mt-1">Downloads your capitalized assets and straight-line depreciation calculations.</p>
            </div>
            <button onClick={exportCapEx} disabled={isExporting} className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition shadow-sm whitespace-nowrap">
              {isExporting ? 'Generating...' : '📥 Export CapEx CSV'}
            </button>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800">1099 Vendor Export</h3>
              <p className="text-sm text-gray-500 mt-1">Navigate to the Vendor Ledger to export your 1099 compliance file.</p>
            </div>
            <a href="/vendor-ledger" className="bg-gray-800 hover:bg-black text-white px-6 py-3 rounded-lg font-bold transition shadow-sm whitespace-nowrap">
              Go to Vendor Ledger →
            </a>
          </div>

        </div>
      </main>
    </>
  );
}