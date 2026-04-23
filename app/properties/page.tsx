"use client";
import { useState, useEffect, useContext } from 'react';
import { supabase } from '@/app/utils/supabase';
import { OrgContext } from '@/app/context/OrgContext';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const createIcon = (color: string) => L.divIcon({ className: 'custom-icon', html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`, iconSize: [24, 24], iconAnchor:[12, 12] });
const iconGreen = createIcon('#16a34a'); const iconYellow = createIcon('#eab308'); const iconRed = createIcon('#ef4444'); const iconGray = createIcon('#94a3b8');

export default function PropertiesPage() {
  const[properties, setProperties] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { orgId } = useContext(OrgContext);

  const [newProperty, setNewProperty] = useState({ name: '', address: '', total_sqft: '' });
  const [stagedProps, setStagedProps] = useState<any[]>([]);
  const[isProcessingAi, setIsProcessingAi] = useState(false);

  useEffect(() => { if (orgId) fetchProperties(); },[orgId]);

  async function fetchProperties() {
    const { data: pData } = await supabase.from('properties').select('*').is('is_deleted', false).order('created_at', { ascending: false });
    if (!pData) return; setProperties(pData);

    const { data: spaces } = await supabase.from('spaces').select('id, property_id, square_footage');
    const { data: leases } = await supabase.from('leases').select('space_id').eq('status', 'Active');
    const { data: journalEntries } = await supabase.from('journal_entries').select('property_id, debit, credit, chart_of_accounts(account_type)');

    const enrichedProps = pData.map(prop => {
      const propSpaces = spaces?.filter(s => s.property_id === prop.id) ||[];
      const totalSqft = propSpaces.reduce((sum, s) => sum + Number(s.square_footage || 0), 0);
      const leasedSpaceIds = leases?.map(l => l.space_id) ||[];
      const leasedSqft = propSpaces.filter(s => leasedSpaceIds.includes(s.id)).reduce((sum, s) => sum + Number(s.square_footage || 0), 0);
      const occupancyRate = totalSqft > 0 ? (leasedSqft / totalSqft) * 100 : 0;

      const propEntries = journalEntries?.filter(e => e.property_id === prop.id) ||[];
      let rev = 0; let exp = 0;
      propEntries.forEach((e: any) => {
        const accType = Array.isArray(e.chart_of_accounts) ? e.chart_of_accounts[0]?.account_type : e.chart_of_accounts?.account_type;
        const amount = Math.abs(Number(e.debit) || Number(e.credit));
        if (accType?.toLowerCase() === 'revenue') rev += amount;
        if (accType?.toLowerCase() === 'expense') exp += amount;
      });

      let pinIcon = iconGray;
      if (totalSqft > 0) {
        if (occupancyRate === 100) pinIcon = iconGreen; else if (occupancyRate >= 80) pinIcon = iconYellow; else pinIcon = iconRed;
      }

      return { ...prop, occupancyRate, noi: rev - exp, pinIcon, lat: prop.lat || 39.8283 + (Math.random() * 10 - 5), lng: prop.lng || -98.5795 + (Math.random() * 20 - 10) };
    });
    setMapData(enrichedProps);
  }

  async function deleteProperty(e: any, id: string) {
    e.stopPropagation();
    if (!confirm("Move this property to the Trash Bin?")) return;
    try { await supabase.from('properties').update({ is_deleted: true }).eq('id', id); fetchProperties(); } 
    catch (error: any) { alert("Error: " + error.message); }
  }

  async function saveManualProperty(e: any) {
    e.preventDefault(); setIsSaving(true);
    try {
      await supabase.from('properties').insert([{ name: newProperty.name, address: newProperty.address, total_sqft: Number(newProperty.total_sqft), organization_id: orgId }]);
      setIsModalOpen(false); setNewProperty({ name: '', address: '', total_sqft: '' }); fetchProperties();
    } catch (error: any) { alert("Error: " + error.message); } finally { setIsSaving(false); }
  }

  async function handleInlineAiUpload(e: any) {
    const files = Array.from(e.target.files) as File[]; if (files.length === 0) return;
    setIsProcessingAi(true); const newStaged: any[] =[...stagedProps];
    for (const file of files) {
      try {
        const formData = new FormData(); formData.append('file', file);
        const res = await fetch('/api/magic-upload', { method: 'POST', body: formData });
        const aiResult = await res.json();
        if (!res.ok) throw new Error(aiResult.error);
        const extractedName = aiResult.data.name || aiResult.data.property_name || '';
        if (!extractedName) continue;
        let duplicateWarning = null;
        const { data: existing } = await supabase.from('properties').select('id').ilike('name', `%${extractedName}%`).is('is_deleted', false).maybeSingle();
        if (existing) duplicateWarning = `A property named "${extractedName}" already exists.`;
        newStaged.push({ id: Math.random().toString(), fileName: file.name, name: extractedName, address: aiResult.data.address || '', sqft: aiResult.data.sqft || 0, duplicateWarning });
      } catch (err: any) { console.error(err.message); }
    }
    setStagedProps(newStaged); setIsProcessingAi(false);
  }

  async function approveStagedProperty(index: number) {
    const item = stagedProps[index];
    try {
      await supabase.from('properties').insert([{ name: item.name, address: item.address, total_sqft: Number(item.sqft), organization_id: orgId }]);
      const updatedStaged =[...stagedProps]; updatedStaged.splice(index, 1); setStagedProps(updatedStaged); fetchProperties();
    } catch (error: any) { alert("Error: " + error.message); }
  }

  function discardStagedProperty(index: number) {
    const updatedStaged = [...stagedProps]; updatedStaged.splice(index, 1); setStagedProps(updatedStaged);
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">My Portfolio</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm text-sm md:text-base">+ Add Property</button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative bg-gray-100">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8 h-[300px] md:h-[400px] z-0 relative">
          <MapContainer center={[39.8283, -98.5795]} zoom={4} scrollWheelZoom={true} style={{ height: '100%', width: '100%', zIndex: 0 }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MarkerClusterGroup chunkedLoading>
              {mapData.map(prop => (
                <Marker key={prop.id} position={[prop.lat, prop.lng]} icon={prop.pinIcon}>
                  <Popup>
                    <div className="text-center min-w-[200px] p-1">
                      <strong className="text-gray-900 text-lg block mb-1">{prop.name}</strong>
                      <span className="text-xs text-gray-500 block mb-3 border-b pb-2">{prop.address}</span>
                      <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-gray-500 uppercase">Occupancy</span><span className={`text-sm font-black ${prop.occupancyRate === 100 ? 'text-green-600' : prop.occupancyRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>{prop.occupancyRate.toFixed(1)}%</span></div>
                      <div className="flex justify-between items-center mb-4"><span className="text-xs font-bold text-gray-500 uppercase">YTD NOI</span><span className={`text-sm font-black ${prop.noi >= 0 ? 'text-green-600' : 'text-red-600'}`}>${prop.noi.toLocaleString(undefined, {maximumFractionDigits: 0})}</span></div>
                      <button onClick={() => window.location.href = `/properties/${prop.id}`} className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded transition hover:bg-blue-700">View Profile →</button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="min-w-full divide-y divide-gray-200 whitespace-nowrap">
              <thead className="bg-gray-50">
                <tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property Name</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total SqFt</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th></tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {properties.map((property) => (
                  <tr 
                    key={property.id} 
                    // FIX: Using window.location.href to bust the Next.js cache!
                    onClick={() => window.location.href = `/properties/${property.id}`} 
                    className="hover:bg-blue-50 cursor-pointer transition"
                  >
                    <td className="px-6 py-4 font-medium text-gray-900">{property.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{property.address}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{property.total_sqft}</td>
                    <td className="px-6 py-4 text-right"><button onClick={(e) => deleteProperty(e, property.id)} className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded font-bold hover:bg-red-200 transition">Trash</button></td>
                  </tr>
                ))}
                {properties.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No properties found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col md:flex-row gap-8 relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 text-2xl">&times;</button>
              
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-6 text-gray-800">Manual Entry</h3>
                <form onSubmit={saveManualProperty} className="space-y-4">
                  <input type="text" required placeholder="Property Name" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={newProperty.name} onChange={(e) => setNewProperty({...newProperty, name: e.target.value})} />
                  <input type="text" placeholder="Address" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={newProperty.address} onChange={(e) => setNewProperty({...newProperty, address: e.target.value})} />
                  <input type="number" placeholder="Total Square Footage" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={newProperty.total_sqft} onChange={(e) => setNewProperty({...newProperty, total_sqft: e.target.value})} />
                  <button type="submit" disabled={isSaving} className={`w-full py-3 rounded font-bold text-white mt-4 ${isSaving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>Save Property</button>
                </form>
              </div>

              <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-200 pt-6 md:pt-0 md:pl-8 flex flex-col">
                <h3 className="text-xl font-bold mb-2 text-purple-800 flex items-center"><span className="mr-2">✨</span> AI Bulk Import</h3>
                <p className="text-xs text-gray-500 mb-4">Upload property flyers or Excel lists to extract data automatically.</p>
                <label className={`w-full flex justify-center items-center py-4 rounded-lg border-2 border-dashed font-bold cursor-pointer transition mb-4 ${isProcessingAi ? 'bg-purple-50 border-purple-300 text-purple-400' : 'bg-purple-50 border-purple-400 text-purple-700 hover:bg-purple-100'}`}>
                  {isProcessingAi ? '🤖 Analyzing files...' : 'Click to Upload Files'}
                  <input type="file" multiple accept=".pdf,image/*,.csv,.xlsx" onChange={handleInlineAiUpload} className="hidden" disabled={isProcessingAi} />
                </label>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {stagedProps.map((item, idx) => (
                    <div key={item.id} className="p-3 bg-gray-50 border rounded-lg text-sm">
                      <p className="font-bold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.address} | {item.sqft} SqFt</p>
                      {item.duplicateWarning && <p className="text-xs font-bold text-red-600 mt-1">⚠️ {item.duplicateWarning}</p>}
                      <div className="flex space-x-2 mt-2">
                        <button onClick={() => approveStagedProperty(idx)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold">Approve</button>
                        <button onClick={() => discardStagedProperty(idx)} className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-xs font-bold">Discard</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}