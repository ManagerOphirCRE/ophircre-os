"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useRouter } from 'next/navigation';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [trade, setTrade] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); // NEW: Phone State

  const router = useRouter();

  useEffect(() => { fetchVendors(); },[]);

  async function fetchVendors() {
    const { data } = await supabase.from('vendors').select('*').order('company_name', { ascending: true });
    if (data) setVendors(data);
  }

  async function saveVendor(e: any) {
    e.preventDefault();
    if (!companyName) return alert("Company name is required.");
    setIsSaving(true);
    try {
      await supabase.from('vendors').insert([{ company_name: companyName, trade, contact_email: email, contact_phone: phone }]);
      setIsModalOpen(false); setCompanyName(''); setTrade(''); setEmail(''); setPhone('');
      fetchVendors();
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSaving(false); }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Vendor Directory</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">+ Add Vendor</button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trade</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone (SMS)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vendors.map((v) => (
                <tr key={v.id} onClick={() => router.push(`/vendors/${v.id}`)} className="hover:bg-blue-50 cursor-pointer transition">
                  <td className="px-6 py-4 font-bold text-gray-900">{v.company_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{v.trade || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{v.contact_email || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{v.contact_phone || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg w-[500px]">
              <h3 className="text-xl font-bold mb-6 text-gray-800">Add New Vendor</h3>
              <form onSubmit={saveVendor} className="space-y-4">
                <input type="text" required placeholder="Company Name *" className="w-full border p-2 rounded outline-none" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                <input type="text" placeholder="Trade / Specialty" className="w-full border p-2 rounded outline-none" value={trade} onChange={(e) => setTrade(e.target.value)} />
                <input type="email" placeholder="Contact Email (Portal Access)" className="w-full border p-2 rounded outline-none" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input type="tel" placeholder="Cell Phone (For SMS Dispatch)" className="w-full border p-2 rounded outline-none" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500">Cancel</button>
                  <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Save Vendor</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}