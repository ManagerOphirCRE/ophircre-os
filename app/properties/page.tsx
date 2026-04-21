"use client";
import { useState, useEffect, useContext } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useRouter } from 'next/navigation';
import { OrgContext } from '@/app/context/OrgContext';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Custom Map Pins based on Occupancy Health
const createIcon = (color: string) => L.divIcon({
  className: 'custom-icon',
  html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const iconGreen = createIcon('#16a34a'); // 100% Occupied
const iconYellow = createIcon('#eab308'); // > 80% Occupied
const iconRed = createIcon('#ef4444'); // < 80% Occupied
const iconGray = createIcon('#94a3b8'); // No Data

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any[]>([]);
  const[isModalOpen, setIsModalOpen] = useState(false);
  const [newProperty, setNewProperty] = useState({ name: '', address: '', total_sqft: '', lat: '', lng: '' });
  
  const router = useRouter();
  const { orgId } = useContext(OrgContext);

  useEffect(() => {
    if (orgId) fetchProperties();
  },[orgId]);

  async function fetchProperties() {
    // 1. Fetch Properties
    const { data: pData } = await supabase.from('properties').select('*').order('created_at', { ascending: false });
    if (!pData) return;
    setProperties(pData);

    // 2. Fetch Spaces & Leases for Occupancy Math
    const { data: spaces } = await supabase.from('spaces').select('id, property_id, square_footage');
    const { data: leases } = await supabase.from('leases').select('space_id').eq('status', 'Active');
    
    // 3. Fetch Financials for NOI Math
    const { data: journalEntries } = await supabase.from('journal_entries').select('property_id, debit, credit, chart_of_accounts(account_type)');

    // 4. Build the Map Data Array
    const enrichedProps = pData.map(prop => {
      // Occupancy Math
      const propSpaces = spaces?.filter(s => s.property_id === prop.id) ||[];
      const totalSqft = propSpaces.reduce((sum, s) => sum + Number(s.square_footage || 0), 0);
      const leasedSpaceIds = leases?.map(l => l.space_id) ||[];
      const leasedSqft = propSpaces.filter(s => leasedSpaceIds.includes(s.id)).reduce((sum, s) => sum + Number(s.square_footage || 0), 0);
      const occupancyRate = totalSqft > 0 ? (leasedSqft / totalSqft) * 100 : 0;

      // NOI Math (YTD)
      const propEntries = journalEntries?.filter(e => e.property_id === prop.id) ||[];
      let rev = 0; let exp = 0;
      propEntries.forEach((e: any) => {
        const accType = Array.isArray(e.chart_of_accounts) ? e.chart_of_accounts[0]?.account_type : e.chart_of_accounts?.account_type;
        const amount = Math.abs(Number(e.debit) || Number(e.credit));
        if (accType?.toLowerCase() === 'revenue') rev += amount;
        if (accType?.toLowerCase() === 'expense') exp += amount;
      });

      // Determine Pin Color
      let pinIcon = iconGray;
      if (totalSqft > 0) {
        if (occupancyRate === 100) pinIcon = iconGreen;
        else if (occupancyRate >= 80) pinIcon = iconYellow;
        else pinIcon = iconRed;
      }

      return {
        ...prop,
        occupancyRate,
        noi: rev - exp,
        pinIcon,
        // Use real lat/lng if available, otherwise fallback to a default spread for testing
        lat: prop.lat || 39.8283 + (Math.random() * 10 - 5),
        lng: prop.lng || -98.5795 + (Math.random() * 20 - 10)
      };
    });

    setMapData(enrichedProps);
  }

  async function saveProperty() {
    await supabase.from('properties').insert([{ 
      name: newProperty.name, 
      address: newProperty.address, 
      total_sqft: Number(newProperty.total_sqft),
      organization_id: orgId 
    }]);
    
    setIsModalOpen(false);
    setNewProperty({ name: '', address: '', total_sqft: '', lat: '', lng: '' });
    fetchProperties();
  }

  const defaultCenter: [number, number] =[39.8283, -98.5795];

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">My Portfolio</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
          + Add Property
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative bg-gray-100">
        
        {/* LIVE PORTFOLIO HEATMAP */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8 h-[400px] z-0 relative">
          <div className="absolute top-4 right-4 z-[1000] bg-white p-3 rounded-lg shadow-lg border border-gray-200 text-xs font-bold space-y-2">
            <div className="flex items-center"><span className="w-3 h-3 bg-green-600 rounded-full mr-2"></span> 100% Occupied</div>
            <div className="flex items-center"><span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span> &gt; 80% Occupied</div>
            <div className="flex items-center"><span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span> &lt; 80% Occupied</div>
          </div>
          
          <MapContainer center={defaultCenter} zoom={4} scrollWheelZoom={true} style={{ height: '100%', width: '100%', zIndex: 0 }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MarkerClusterGroup chunkedLoading>
              {mapData.map(prop => (
                <Marker key={prop.id} position={[prop.lat, prop.lng]} icon={prop.pinIcon}>
                  <Popup>
                    <div className="text-center min-w-[200px] p-1">
                      <strong className="text-gray-900 text-lg block mb-1">{prop.name}</strong>
                      <span className="text-xs text-gray-500 block mb-3 border-b pb-2">{prop.address}</span>
                      
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Occupancy</span>
                        <span className={`text-sm font-black ${prop.occupancyRate === 100 ? 'text-green-600' : prop.occupancyRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {prop.occupancyRate.toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-gray-500 uppercase">YTD NOI</span>
                        <span className={`text-sm font-black ${prop.noi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${prop.noi.toLocaleString(undefined, {maximumFractionDigits: 0})}
                        </span>
                      </div>

                      <button onClick={() => router.push(`/properties/${prop.id}`)} className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded transition hover:bg-blue-700">
                        View Property Profile →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total SqFt</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {properties.map((property) => (
                <tr key={property.id} onClick={() => router.push(`/properties/${property.id}`)} className="hover:bg-blue-50 cursor-pointer transition">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{property.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{property.address}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{property.total_sqft}</td>
                </tr>
              ))}
              {properties.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No properties found.</td></tr>}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-4 text-gray-800">Add New Property</h3>
              <form onSubmit={(e) => { e.preventDefault(); saveProperty(); }} className="space-y-4">
                <input type="text" required placeholder="Property Name" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={newProperty.name} onChange={(e) => setNewProperty({...newProperty, name: e.target.value})} />
                <input type="text" placeholder="Address" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={newProperty.address} onChange={(e) => setNewProperty({...newProperty, address: e.target.value})} />
                <input type="number" placeholder="Total Square Footage" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={newProperty.total_sqft} onChange={(e) => setNewProperty({...newProperty, total_sqft: e.target.value})} />
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">Save Property</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  )
}