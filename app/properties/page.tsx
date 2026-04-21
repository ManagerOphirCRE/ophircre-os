"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/app/context/OrgContext';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet icons in Next.js
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

export default function PropertiesPage() {
  const [properties, setProperties] = useState<any[]>([]);
  const[isModalOpen, setIsModalOpen] = useState(false);
  const [newProperty, setNewProperty] = useState({ name: '', address: '', total_sqft: '' });
  
  const router = useRouter();
  const { orgId } = useOrg();

  useEffect(() => {
    fetchProperties();
  },[]);

  async function fetchProperties() {
    const { data } = await supabase.from('properties').select('*').order('created_at', { ascending: false });
    if (data) setProperties(data);
  }

  async function saveProperty() {
    await supabase.from('properties').insert([{ 
      name: newProperty.name, 
      address: newProperty.address, 
      total_sqft: Number(newProperty.total_sqft),
      organization_id: orgId 
    }]);
    
    setIsModalOpen(false);
    setNewProperty({ name: '', address: '', total_sqft: '' });
    fetchProperties();
  }

  // Default map center (Geographic center of USA)
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
        
        {/* NEW: INTERACTIVE PORTFOLIO MAP */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8 h-96 z-0 relative">
          <MapContainer center={defaultCenter} zoom={4} scrollWheelZoom={false} style={{ height: '100%', width: '100%', zIndex: 0 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Note: In Phase 6, we would use a Geocoding API to convert the text address into Lat/Lng coordinates. 
                For this UI, we are placing a dummy pin to demonstrate the functionality. */}
            {properties.length > 0 && (
              <Marker position={[25.7617, -80.1918]} icon={icon}>
                <Popup>
                  <div className="text-center">
                    <strong className="text-blue-600 text-lg block mb-1">{properties[0]?.name}</strong>
                    <span className="text-xs text-gray-500 block mb-2">{properties[0]?.address}</span>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">Est. Value: ${Number(properties[0]?.current_value || 0).toLocaleString()}</span>
                  </div>
                </Popup>
              </Marker>
            )}
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
                <tr 
                  key={property.id} 
                  onClick={() => router.push(`/properties/${property.id}`)} 
                  className="hover:bg-blue-50 cursor-pointer transition"
                >
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{property.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{property.address}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{property.total_sqft}</td>
                </tr>
              ))}
              {properties.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No properties found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-xl shadow-lg w-96">
              <h3 className="text-lg font-bold mb-4">Add New Property</h3>
              <input type="text" placeholder="Property Name" className="w-full border p-2 mb-3 rounded outline-none focus:ring-2 focus:ring-blue-500" value={newProperty.name} onChange={(e) => setNewProperty({...newProperty, name: e.target.value})} />
              <input type="text" placeholder="Address" className="w-full border p-2 mb-3 rounded outline-none focus:ring-2 focus:ring-blue-500" value={newProperty.address} onChange={(e) => setNewProperty({...newProperty, address: e.target.value})} />
              <input type="number" placeholder="Total Square Footage" className="w-full border p-2 mb-4 rounded outline-none focus:ring-2 focus:ring-blue-500" value={newProperty.total_sqft} onChange={(e) => setNewProperty({...newProperty, total_sqft: e.target.value})} />
              <div className="flex justify-end space-x-2">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                <button onClick={saveProperty} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium">Save</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}