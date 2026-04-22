"use client";
import { useState, useEffect, useContext } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useParams, useRouter } from 'next/navigation';
import { OrgContext } from '@/app/context/OrgContext';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const iconSpace = L.divIcon({ className: 'custom-icon', html: `<div style="background-color:#3b82f6; width:20px; height:20px; border-radius:50%; border:2px solid white;"></div>`, iconSize: [20, 20] });
const iconAsset = L.divIcon({ className: 'custom-icon', html: `<div style="background-color:#f97316; width:20px; height:20px; border-radius:50%; border:2px solid white;"></div>`, iconSize: [20, 20] });

export default function PropertyProfilePage() {
  const params = useParams(); const propertyId = params?.id as string;
  const router = useRouter(); const { orgId } = useContext(OrgContext);

  const [property, setProperty] = useState<any>(null);
  const [spaces, setSpaces] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [activeTab, setActiveTab] = useState('details');

  const [name, setName] = useState(''); const [address, setAddress] = useState(''); const[sqft, setSqft] = useState('');
  const [lat, setLat] = useState<number | null>(null); const [lng, setLng] = useState<number | null>(null);
  const[landlordName, setLandlordName] = useState(''); const [landlordEmail, setLandlordEmail] = useState('');
  const [landlordPhone, setLandlordPhone] = useState(''); const[landlordAddress, setLandlordAddress] = useState('');
  const [purchasePrice, setPurchasePrice] = useState(''); const[currentValue, setCurrentValue] = useState('');
  const [mortgageBalance, setMortgageBalance] = useState(''); const[interestRate, setInterestRate] = useState('');

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const[newSpaceName, setNewSpaceName] = useState(''); const [newSpaceSqft, setNewSpaceSqft] = useState(''); const[newSpaceType, setNewSpaceType] = useState('physical');

  useEffect(() => {
    async function fetchPropertyData() {
      if (!propertyId) return;
      const { data: pData } = await supabase.from('properties').select('*').eq('id', propertyId).single();
      if (pData) {
        setProperty(pData); setName(pData.name || ''); setAddress(pData.address || ''); setSqft(pData.total_sqft || '');
        setLat(pData.lat || null); setLng(pData.lng || null);
        setLandlordName(pData.landlord_entity_name || ''); setLandlordEmail(pData.landlord_email || '');
        setLandlordPhone(pData.landlord_phone || ''); setLandlordAddress(pData.landlord_address || '');
        setPurchasePrice(pData.purchase_price || ''); setCurrentValue(pData.current_value || '');
        setMortgageBalance(pData.mortgage_balance || ''); setInterestRate(pData.interest_rate || '');
      }
      const { data: sData } = await supabase.from('spaces').select('*, leases(tenant_id, tenants(name))').eq('property_id', propertyId).order('name');
      if (sData) setSpaces(sData);
      const { data: aData } = await supabase.from('property_assets').select('*').eq('property_id', propertyId);
      if (aData) setAssets(aData);
    }
    fetchPropertyData();
  },[propertyId]);

  async function handleAddressSearch(query: string) {
    setAddress(query);
    if (query.length < 5) return setSuggestions([]);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=5`);
      const data = await res.json();
      setSuggestions(data);
    } catch (e) { console.error(e); }
  }

  function selectAddress(item: any) {
    setAddress(item.display_name);
    setLat(Number(item.lat)); setLng(Number(item.lon));
    setSuggestions([]);
  }

  async function savePropertyDetails() {
    setIsSaving(true);
    try {
      await supabase.from('properties').update({
        name, address, lat, lng, total_sqft: Number(sqft), landlord_entity_name: landlordName, landlord_email: landlordEmail,
        landlord_phone: landlordPhone, landlord_address: landlordAddress, purchase_price: Number(purchasePrice), 
        current_value: Number(currentValue), mortgage_balance: Number(mortgageBalance), interest_rate: Number(interestRate)
      }).eq('id', propertyId);
      alert("Property details saved!");
    } catch (error: any) { alert("Error saving: " + error.message); } finally { setIsSaving(false); }
  }

  // --- NEW: PROPERTY DISPOSITION (SALE) ENGINE ---
  async function sellProperty() {
    if (!confirm(`WARNING: Are you sure you want to mark ${property.name} as SOLD?\n\nThis will permanently terminate all active leases in this building, mark the tenants as 'Past', and archive the property so the Auto-Biller stops charging them.`)) return;
    setIsSelling(true);

    try {
      // 1. Find all active leases attached to this property's spaces
      const spaceIds = spaces.map(s => s.id);
      const { data: activeLeases } = await supabase.from('leases').select('id, tenant_id').in('space_id', spaceIds).eq('status', 'Active');

      if (activeLeases && activeLeases.length > 0) {
        const leaseIds = activeLeases.map(l => l.id);
        const tenantIds = activeLeases.map(l => l.tenant_id);

        // 2. Terminate the Leases
        await supabase.from('leases').update({ status: 'Terminated', end_date: new Date().toISOString().split('T')[0] }).in('id', leaseIds);

        // 3. Mark Tenants as Past
        await supabase.from('tenants').update({ status: 'past' }).in('id', tenantIds);
      }

      // 4. Archive the Property (Soft Delete)
      await supabase.from('properties').update({ is_deleted: true }).eq('id', propertyId);

      alert("Property successfully marked as Sold. All leases have been terminated and tenants archived.");
      router.push('/properties'); // Bounce back to portfolio
    } catch (error: any) {
      alert("Disposition Error: " + error.message);
      setIsSelling(false);
    }
  }

  async function addSpace(e: any) {
    e.preventDefault();
    try {
      await supabase.from('spaces').insert([{ property_id: propertyId, name: newSpaceName, square_footage: Number(newSpaceSqft), space_type: newSpaceType }]);
      setNewSpaceName(''); setNewSpaceSqft(''); setNewSpaceType('physical');
      const { data } = await supabase.from('spaces').select('*, leases(tenants(name))').eq('property_id', propertyId).order('name');
      if (data) setSpaces(data);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  async function deleteSpace(id: string) {
    if (!confirm("Delete this unit?")) return;
    await supabase.from('spaces').delete().eq('id', id);
    const { data } = await supabase.from('spaces').select('*, leases(tenants(name))').eq('property_id', propertyId).order('name');
    if (data) setSpaces(data);
  }

  function MapClickHandler() {
    useMapEvents({
      click: async (e) => {
        const type = prompt("Drop a pin here!\nType '1' for a Space/Tenant (e.g. Food Truck).\nType '2' for an Asset (e.g. Dumpster/Meter).");
        if (!type) return;
        if (type === '1') {
          const spaceName = prompt("Enter Space/Licensee Name:");
          if (spaceName) await supabase.from('spaces').insert([{ property_id: propertyId, name: spaceName, space_type: 'virtual', lat: e.latlng.lat, lng: e.latlng.lng }]);
        } else if (type === '2') {
          const assetName = prompt("Enter Asset Name (e.g. Main Dumpster):");
          const assetType = prompt("Enter Asset Type (Dumpster, Meter, Light, HVAC):", "Dumpster");
          if (assetName && assetType) await supabase.from('property_assets').insert([{ property_id: propertyId, name: assetName, asset_type: assetType, lat: e.latlng.lat, lng: e.latlng.lng }]);
        }
        const { data: sData } = await supabase.from('spaces').select('*, leases(tenants(name))').eq('property_id', propertyId).order('name');
        if (sData) setSpaces(sData);
        const { data: aData } = await supabase.from('property_assets').select('*').eq('property_id', propertyId);
        if (aData) setAssets(aData);
      }
    });
    return null;
  }

  if (!property) return <div className="p-8 text-gray-500">Loading Property...</div>;

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <div>
          <a href="/properties" className="text-sm text-blue-600 hover:underline mb-1 inline-block">← Back to Portfolio</a>
          <h2 className="text-2xl font-bold text-gray-800">{property.name}</h2>
        </div>
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button onClick={() => setActiveTab('details')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'details' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Details & Units</button>
          <button onClick={() => setActiveTab('siteplan')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'siteplan' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Interactive Site Plan</button>
          <button onClick={() => setActiveTab('financials')} className={`px-4 py-2 rounded-md text-sm font-medium transition ${activeTab === 'financials' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>SREO Financials</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100 relative">
        
        {activeTab === 'details' && (
          <div className="space-y-6">
            
            {/* NEW: DISPOSITION BANNER */}
            <div className="bg-red-50 border border-red-200 p-6 rounded-xl flex justify-between items-center shadow-sm">
              <div>
                <h3 className="font-bold text-red-800 text-lg">Property Disposition (Sale)</h3>
                <p className="text-sm text-red-600 mt-1">If you have sold this asset, click here to terminate all active leases and archive the building.</p>
              </div>
              <button onClick={sellProperty} disabled={isSelling} className={`px-6 py-3 rounded-lg font-bold text-white transition shadow-sm ${isSelling ? 'bg-red-400' : 'bg-red-600 hover:bg-red-700'}`}>
                {isSelling ? 'Processing...' : 'Mark as Sold'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Physical Details</h3>
                <div className="space-y-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Property Name</label><input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={name} onChange={(e) => setName(e.target.value)} /></div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address (Autocomplete)</label>
                    <input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={address} onChange={(e) => handleAddressSearch(e.target.value)} />
                    {suggestions.length > 0 && (
                      <ul className="absolute z-50 w-full bg-white border border-gray-200 shadow-lg rounded-lg mt-1 max-h-48 overflow-y-auto">
                        {suggestions.map((s, i) => (
                          <li key={i} onClick={() => selectAddress(s)} className="p-3 hover:bg-blue-50 cursor-pointer text-sm border-b">{s.display_name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    <label className="block text-xs font-bold text-gray-700 mb-2">GPS Coordinates (Auto-filled or Manual Override)</label>
                    <div className="flex space-x-2">
                      <input type="number" step="any" placeholder="Latitude" className="w-1/2 border p-2 rounded text-sm outline-none" value={lat || ''} onChange={(e) => setLat(Number(e.target.value))} />
                      <input type="number" step="any" placeholder="Longitude" className="w-1/2 border p-2 rounded text-sm outline-none" value={lng || ''} onChange={(e) => setLng(Number(e.target.value))} />
                    </div>
                  </div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Total Square Footage</label><input type="number" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={sqft} onChange={(e) => setSqft(e.target.value)} /></div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Legal & Landlord Entity</h3>
                <div className="space-y-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Landlord Entity Name</label><input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={landlordName} onChange={(e) => setLandlordName(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Official Notice Email</label><input type="email" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={landlordEmail} onChange={(e) => setLandlordEmail(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Official Notice Phone</label><input type="text" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={landlordPhone} onChange={(e) => setLandlordPhone(e.target.value)} /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Official Mailing Address</label><textarea className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 h-12 resize-none" value={landlordAddress} onChange={(e) => setLandlordAddress(e.target.value)} /></div>
                </div>
              </div>
            </div>

            <button onClick={savePropertyDetails} disabled={isSaving} className="w-full py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm">{isSaving ? 'Saving...' : 'Save Property Details'}</button>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Spaces & Units Manager</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <table className="min-w-full divide-y divide-gray-200 border rounded-lg overflow-hidden">
                    <thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit / Space Name</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th><th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SqFt</th><th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Action</th></tr></thead>
                    <tbody className="divide-y divide-gray-200">
                      {spaces.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm font-bold text-blue-600">{s.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500 capitalize">{s.space_type}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{s.square_footage} sqft</td>
                          <td className="px-4 py-2 text-right"><button onClick={() => deleteSpace(s.id)} className="text-red-500 text-xs hover:underline">Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h4 className="font-bold text-sm text-gray-800 mb-3">Add New Space</h4>
                  <form onSubmit={addSpace} className="space-y-3">
                    <input type="text" required placeholder="e.g., Suite 100, ATM" className="w-full border p-2 rounded text-sm outline-none" value={newSpaceName} onChange={(e) => setNewSpaceName(e.target.value)} />
                    <input type="number" required placeholder="Square Footage" className="w-full border p-2 rounded text-sm outline-none" value={newSpaceSqft} onChange={(e) => setNewSpaceSqft(e.target.value)} />
                    <select className="w-full border p-2 rounded text-sm outline-none" value={newSpaceType} onChange={(e) => setNewSpaceType(e.target.value)}><option value="physical">Physical Unit (Suite)</option><option value="virtual">Virtual Unit (ATM, Parking)</option></select>
                    <button type="submit" className="w-full bg-gray-800 hover:bg-black text-white py-2 rounded font-bold text-sm transition">Add Space</button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'siteplan' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[700px] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div><h3 className="font-bold">Interactive Site Plan</h3><p className="text-xs text-slate-400">Click anywhere on the map to drop a pin for a Food Truck, Antenna, or Dumpster.</p></div>
              <div className="flex space-x-4 text-xs font-bold"><span className="flex items-center"><span className="w-3 h-3 bg-blue-500 rounded-full mr-2 border border-white"></span> Tenants/Spaces</span><span className="flex items-center"><span className="w-3 h-3 bg-orange-500 rounded-full mr-2 border border-white"></span> Physical Assets</span></div>
            </div>
            <div className="flex-1 relative z-0">
              {lat && lng ? (
                <MapContainer center={[lat, lng]} zoom={19} scrollWheelZoom={true} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
                  <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" />
                  <MapClickHandler />
                  {spaces.filter(s => s.lat && s.lng).map(s => (
                    <Marker key={s.id} position={[s.lat, s.lng]} icon={iconSpace}>
                      <Popup><div className="text-center"><strong className="text-blue-600 block">{s.name}</strong><span className="text-xs text-gray-500 block">{s.space_type}</span>{s.leases?.[0] && <span className="mt-1 bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold block">Leased to: {s.leases[0].tenants?.name}</span>}</div></Popup>
                    </Marker>
                  ))}
                  {assets.filter(a => a.lat && a.lng).map(a => (
                    <Marker key={a.id} position={[a.lat, a.lng]} icon={iconAsset}>
                      <Popup><div className="text-center"><strong className="text-orange-600 block">{a.name}</strong><span className="text-xs text-gray-500 block">{a.asset_type}</span></div></Popup>
                    </Marker>
                  ))}
                </MapContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center bg-gray-50"><div className="text-4xl mb-4">📍</div><p className="text-gray-500 font-medium">Please use the Address Autocomplete in the Details tab to set the GPS coordinates for this property first!</p></div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit max-w-2xl mx-auto">
            <h3 className="font-bold text-gray-800 border-b pb-2 mb-4">Financials & Valuation (SREO)</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price ($)</label><input type="number" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 font-medium" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Current Estimated Value ($)</label><input type="number" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 font-bold text-green-700" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Mortgage Balance ($)</label><input type="number" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500 font-bold text-red-600" value={mortgageBalance} onChange={(e) => setMortgageBalance(e.target.value)} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (%)</label><input type="number" step="0.1" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} /></div>
              </div>
              <button onClick={savePropertyDetails} disabled={isSaving} className="w-full py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm mt-4">{isSaving ? 'Saving...' : 'Save Financials'}</button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}