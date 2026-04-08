"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function DealAnalyzerPage() {
  const [deals, setDeals] = useState<any[]>([]);
  const [omFile, setOmFile] = useState<File | null>(null);
  const[isScanning, setIsScanning] = useState(false);

  useEffect(
    function loadDeals() {
      async function fetchDeals() {
        const { data } = await supabase.from('deals').select('*').order('created_at', { ascending: false });
        if (data) setDeals(data);
      }
      fetchDeals();
    }
    ,[]
  );

  async function handleScanOM() {
    if (!omFile) return alert("Please select an OM PDF or Image.");
    setIsScanning(true);

    try {
      const formData = new FormData(); 
      formData.append('file', omFile);
      
      const res = await fetch('/api/scan-deal', { method: 'POST', body: formData });
      const extractedData = await res.json();
      
      if (!res.ok) throw new Error(extractedData.error);

      const { error } = await supabase.from('deals').insert([{
        property_name: extractedData.property_name || 'Unknown Property',
        asking_price: Number(extractedData.asking_price || 0),
        noi: Number(extractedData.noi || 0),
        cap_rate: Number(extractedData.cap_rate || 0),
        price_per_sqft: Number(extractedData.price_per_sqft || 0),
        notes: extractedData.notes || ''
      }]);

      if (error) throw error;
      
      alert("Deal successfully analyzed and added to your pipeline!");
      setOmFile(null);
      
      const { data } = await supabase.from('deals').select('*').order('created_at', { ascending: false });
      if (data) setDeals(data);

    } catch (error: any) {
      alert("AI Error: " + error.message);
    } finally {
      setIsScanning(false);
    }
  }

  async function deleteDeal(id: string) {
    if (!confirm("Remove this deal from your pipeline?")) return;
    await supabase.from('deals').delete().eq('id', id);
    const { data } = await supabase.from('deals').select('*').order('created_at', { ascending: false });
    if (data) setDeals(data);
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Acquisitions & Deal Analyzer</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        
        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8 flex flex-col md:flex-row items-center justify-between">
          <div className="mb-4 md:mb-0">
            <h3 className="font-bold text-gray-800">Upload Offering Memorandum (OM)</h3>
            <p className="text-sm text-gray-500">Upload a broker PDF or pro-forma image. The AI will extract the financials.</p>
          </div>
          <div className="flex items-center space-x-4 w-full md:w-auto">
            <input type="file" accept=".pdf,image/*" onChange={(e) => setOmFile(e.target.files?.[0] || null)} className="border p-2 rounded-md text-sm w-full md:w-auto" />
            <button onClick={handleScanOM} disabled={isScanning || !omFile} className={`px-6 py-2 rounded-md font-bold text-white transition shadow-sm whitespace-nowrap ${isScanning || !omFile ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
              {isScanning ? '🤖 Analyzing...' : '✨ Analyze OM'}
            </button>
          </div>
        </div>

        {/* Comparison Matrix */}
        <h3 className="font-bold text-gray-800 mb-4">Deal Comparison Matrix</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deals.map(deal => {
            const isGoodCap = deal.cap_rate >= 7.0;

            return (
              <div key={deal.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-800 text-white flex justify-between items-start">
                  <h4 className="font-bold text-lg leading-tight">{deal.property_name}</h4>
                  <button onClick={() => deleteDeal(deal.id)} className="text-slate-400 hover:text-red-400 text-xl leading-none">&times;</button>
                </div>
                
                <div className="p-6 flex-1 space-y-4">
                  <div className="flex justify-between items-end border-b pb-2">
                    <span className="text-sm text-gray-500 font-medium">Asking Price</span>
                    <span className="text-xl font-black text-gray-900">${Number(deal.asking_price).toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between items-end border-b pb-2">
                    <span className="text-sm text-gray-500 font-medium">NOI</span>
                    <span className="text-lg font-bold text-green-600">${Number(deal.noi).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-end border-b pb-2">
                    <span className="text-sm text-gray-500 font-medium">Cap Rate</span>
                    <span className={`text-lg font-bold ${isGoodCap ? 'text-green-600' : 'text-orange-500'}`}>
                      {deal.cap_rate}%
                    </span>
                  </div>

                  <div className="flex justify-between items-end border-b pb-2">
                    <span className="text-sm text-gray-500 font-medium">Price / SqFt</span>
                    <span className="text-md font-bold text-gray-700">${deal.price_per_sqft}</span>
                  </div>

                  <div className="pt-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-bold">AI Summary</span>
                    <p className="text-sm text-gray-700 mt-1">{deal.notes}</p>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold transition">
                    Move to Underwriting →
                  </button>
                </div>
              </div>
            )
          })}
          
          {deals.length === 0 && (
            <div className="col-span-full p-12 text-center bg-white rounded-xl border-2 border-dashed border-gray-300">
              <p className="text-gray-500">No deals in your pipeline. Upload an OM to start analyzing!</p>
            </div>
          )}
        </div>

      </main>
    </>
  );
}