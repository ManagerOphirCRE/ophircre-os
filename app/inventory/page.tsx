"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const[itemName, setItemName] = useState('');
  const [category, setCategory] = useState('General');
  const [propertyId, setPropertyId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reorderLevel, setReorderLevel] = useState('5');
  const[cost, setCost] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data: iData } = await supabase.from('inventory').select('*, properties(name)').order('item_name');
      if (iData) setItems(iData);
      const { data: pData } = await supabase.from('properties').select('*').order('name');
      if (pData) setProperties(pData);
    }
    fetchData();
  },[]);

  async function saveItem(e: any) {
    e.preventDefault();
    try {
      await supabase.from('inventory').insert([{
        item_name: itemName, category, property_id: propertyId || null,
        quantity: Number(quantity), reorder_level: Number(reorderLevel), cost_per_unit: Number(cost)
      }]);
      setIsModalOpen(false);
      setItemName(''); setQuantity(''); setCost('');
      const { data } = await supabase.from('inventory').select('*, properties(name)').order('item_name');
      if (data) setItems(data);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function adjustQuantity(id: string, currentQty: number, change: number) {
    const newQty = currentQty + change;
    if (newQty < 0) return;
    await supabase.from('inventory').update({ quantity: newQty }).eq('id', id);
    const { data } = await supabase.from('inventory').select('*, properties(name)').order('item_name');
    if (data) setItems(data);
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    await supabase.from('inventory').delete().eq('id', id);
    const { data } = await supabase.from('inventory').select('*, properties(name)').order('item_name');
    if (data) setItems(data);
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Maintenance Inventory</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition">
          + Add Supply Item
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Item Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Location</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Stock Level</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Unit Cost</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map(item => {
                const isLow = item.quantity <= item.reorder_level;
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-900">{item.item_name}</p>
                      <p className="text-xs text-gray-500">{item.category}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{item.properties?.name || 'Main Office / Truck'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${isLow ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-green-100 text-green-800'}`}>
                        {item.quantity} in stock {isLow && '(Low!)'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">${item.cost_per_unit}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => adjustQuantity(item.id, item.quantity, -1)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded font-bold">-</button>
                      <button onClick={() => adjustQuantity(item.id, item.quantity, 1)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded font-bold">+</button>
                      <button onClick={() => deleteItem(item.id)} className="text-red-500 text-xs ml-4 hover:underline">Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg w-[500px]">
              <h3 className="text-xl font-bold mb-6 text-gray-800">Add Inventory Item</h3>
              <form onSubmit={saveItem} className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Item Name</label><input type="text" required className="w-full border p-2 rounded outline-none" value={itemName} onChange={(e) => setItemName(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Category</label>
                    <select className="w-full border p-2 rounded outline-none" value={category} onChange={(e) => setCategory(e.target.value)}>
                      <option value="General">General</option><option value="HVAC">HVAC</option><option value="Plumbing">Plumbing</option><option value="Electrical">Electrical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Location</label>
                    <select className="w-full border p-2 rounded outline-none" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                      <option value="">Main Office</option>
                      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Initial Qty</label><input type="number" required className="w-full border p-2 rounded outline-none" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium mb-1">Reorder At</label><input type="number" required className="w-full border p-2 rounded outline-none" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium mb-1">Unit Cost ($)</label><input type="number" step="0.01" className="w-full border p-2 rounded outline-none" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium">Save Item</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}