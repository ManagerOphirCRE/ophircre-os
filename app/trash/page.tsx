"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useOrg } from '@/app/context/OrgContext';

export default function TrashBinPage() {
  const { orgId } = useOrg();
  const [deletedTenants, setDeletedTenants] = useState<any[]>([]);
  const [deletedVendors, setDeletedVendors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (orgId) fetchTrash();
  }, [orgId]);

  async function fetchTrash() {
    setIsLoading(true);
    const { data: tData } = await supabase.from('tenants').select('*').eq('is_deleted', true).order('name');
    if (tData) setDeletedTenants(tData);

    const { data: vData } = await supabase.from('vendors').select('*').eq('is_deleted', true).order('company_name');
    if (vData) setDeletedVendors(vData);
    
    setIsLoading(false);
  }

  async function restoreItem(table: string, id: string) {
    if (!confirm("Restore this item to active status?")) return;
    try {
      await supabase.from(table).update({ is_deleted: false }).eq('id', id);
      alert("Item successfully restored!");
      fetchTrash();
    } catch (error: any) {
      alert("Error restoring item: " + error.message);
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4">
        <h2 className="text-xl font-semibold text-gray-800">🗑️ Trash Bin (Recovery)</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        {isLoading ? <p className="text-gray-500">Loading trash bin...</p> : (
          <div className="space-y-8 max-w-5xl mx-auto">
            
            {/* Deleted Tenants */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-red-50 border-b border-red-100"><h3 className="font-bold text-red-800">Deleted Tenants</h3></div>
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="divide-y divide-gray-200">
                  {deletedTenants.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{t.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{t.contact_email}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => restoreItem('tenants', t.id)} className="bg-green-600 text-white px-4 py-2 rounded font-bold text-xs hover:bg-green-700 transition">♻️ Restore</button>
                      </td>
                    </tr>
                  ))}
                  {deletedTenants.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No deleted tenants.</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Deleted Vendors */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 bg-red-50 border-b border-red-100"><h3 className="font-bold text-red-800">Deleted Vendors</h3></div>
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="divide-y divide-gray-200">
                  {deletedVendors.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">{v.company_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{v.contact_email}</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => restoreItem('vendors', v.id)} className="bg-green-600 text-white px-4 py-2 rounded font-bold text-xs hover:bg-green-700 transition">♻️ Restore</button>
                      </td>
                    </tr>
                  ))}
                  {deletedVendors.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No deleted vendors.</td></tr>}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </main>
    </>
  );
}