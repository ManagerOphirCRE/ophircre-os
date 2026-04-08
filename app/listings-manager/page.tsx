"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function ListingsManagerPage() {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const[editingSpace, setEditingSpace] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(
    function loadSpaces() {
      async function fetchData() {
        const { data } = await supabase.from('spaces').select('*, properties(name, address)').order('name');
        if (data) setSpaces(data);
        setIsLoading(false);
      }
      fetchData();
    }
    ,[]
  );

  async function toggleListingStatus(id: string, currentStatus: boolean) {
    await supabase.from('spaces').update({ is_listed: !currentStatus }).eq('id', id);
    const { data } = await supabase.from('spaces').select('*, properties(name, address)').order('name');
    if (data) setSpaces(data);
  }

  function openEditModal(space: any) {
    setEditingSpace(space);
    setPrice(space.listing_price || '');
    setDescription(space.listing_description || '');
    setImageFile(null);
  }

  async function saveListingDetails(e: any) {
    e.preventDefault();
    setIsSaving(true);
    try {
      let imageUrl = editingSpace.listing_image_url;

      // If they uploaded a new photo, save it to the public 'marketing' bucket
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `listing_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('marketing').upload(fileName, imageFile);
        if (uploadError) throw uploadError;
        
        const { data } = supabase.storage.from('marketing').getPublicUrl(fileName);
        imageUrl = data.publicUrl;
      }

      await supabase.from('spaces').update({
        listing_price: Number(price),
        listing_description: description,
        listing_image_url: imageUrl
      }).eq('id', editingSpace.id);

      alert("Marketing details saved!");
      setEditingSpace(null);
      
      const { data } = await supabase.from('spaces').select('*, properties(name, address)').order('name');
      if (data) setSpaces(data);
    } catch (error: any) {
      alert("Error saving: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <div className="p-8">Loading spaces...</div>;

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Marketing & Listings Manager</h2>
        <a href="/listings" target="_blank" className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          👁️ View Public Page
        </a>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 bg-gray-50 border-b border-gray-200">
            <h3 className="font-bold text-gray-800">All Spaces & Units</h3>
            <p className="text-sm text-gray-500">Toggle spaces to publish them to your public listings page.</p>
          </div>
          
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Space</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Property</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Asking Rent</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Public Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {spaces.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-bold text-blue-600">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.square_footage} SqFt | <span className="capitalize">{s.space_type}</span></p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{s.properties?.name}</td>
                  <td className="px-6 py-4 text-sm font-bold text-green-700">${Number(s.listing_price || 0).toLocaleString()}/mo</td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => toggleListingStatus(s.id, s.is_listed)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition ${s.is_listed ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                    >
                      {s.is_listed ? '🟢 PUBLISHED' : '⚫ HIDDEN'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEditModal(s)} className="text-sm font-bold text-blue-600 hover:underline">Edit Marketing</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* EDIT MARKETING MODAL */}
        {editingSpace && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl">
              <h3 className="text-xl font-bold mb-2 text-gray-800">Edit Listing: {editingSpace.name}</h3>
              <p className="text-sm text-gray-500 mb-6">{editingSpace.properties?.name}</p>
              
              <form onSubmit={saveListingDetails} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Asking Rent ($/mo)</label>
                  <input type="number" required className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-green-700" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Marketing Description</label>
                  <textarea required placeholder="e.g., Beautiful corner retail space with high foot traffic..." className="w-full border p-3 rounded-lg h-32 outline-none resize-none focus:ring-2 focus:ring-blue-500" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Cover Photo</label>
                  {editingSpace.listing_image_url && <p className="text-xs text-green-600 mb-2">✓ Photo currently on file. Upload a new one to replace it.</p>}
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full border p-2 rounded-lg text-sm bg-gray-50" />
                </div>

                <div className="flex justify-end space-x-3 pt-4 mt-2 border-t">
                  <button type="button" onClick={() => setEditingSpace(null)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" disabled={isSaving} className={`px-6 py-2 rounded font-bold text-white ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {isSaving ? 'Saving...' : 'Save Details'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}