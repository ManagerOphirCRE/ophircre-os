"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function IoTPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchData(); },[]);

  async function fetchData() {
    const { data } = await supabase.from('iot_devices').select('*, properties(name)').order('device_type');
    if (data) setDevices(data);
    setIsLoading(false);
  }

  async function toggleLock(id: string, currentValue: string) {
    const newValue = currentValue === 'Locked' ? 'Unlocked' : 'Locked';
    await supabase.from('iot_devices').update({ current_value: newValue, last_ping: new Date().toISOString() }).eq('id', id);
    fetchData();
  }

  async function changeTemp(id: string, currentTemp: string, change: number) {
    const newTemp = (Number(currentTemp) + change).toString();
    await supabase.from('iot_devices').update({ current_value: newTemp, last_ping: new Date().toISOString() }).eq('id', id);
    fetchData();
  }

  if (isLoading) return <div className="p-8">Syncing with Smart Devices...</div>;

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">IoT & Smart Building Control</h2>
        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span> System Online
        </span>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map(device => (
            <div key={device.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{device.device_type === 'Lock' ? '🔒' : '🌡️'}</span>
                  <h3 className="font-bold">{device.device_name}</h3>
                </div>
                <span className="text-xs text-green-400 font-bold">{device.status}</span>
              </div>
              
              <div className="p-6 flex-1 flex flex-col items-center justify-center space-y-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest">{device.properties?.name || 'Unassigned Location'}</p>
                
                {device.device_type === 'Lock' ? (
                  <div className="text-center">
                    <p className={`text-3xl font-black mb-4 ${device.current_value === 'Locked' ? 'text-green-600' : 'text-red-600'}`}>
                      {device.current_value}
                    </p>
                    <button 
                      onClick={() => toggleLock(device.id, device.current_value)}
                      className={`px-8 py-3 rounded-full font-bold text-white transition shadow-md ${device.current_value === 'Locked' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                    >
                      {device.current_value === 'Locked' ? 'Unlock Door' : 'Lock Door'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-5xl font-black text-gray-800 mb-4">{device.current_value}°F</p>
                    <div className="flex space-x-4 justify-center">
                      <button onClick={() => changeTemp(device.id, device.current_value, -1)} className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-black text-xl hover:bg-blue-200 transition shadow-sm">-</button>
                      <button onClick={() => changeTemp(device.id, device.current_value, 1)} className="w-12 h-12 rounded-full bg-red-100 text-red-600 font-black text-xl hover:bg-red-200 transition shadow-sm">+</button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-3 bg-gray-50 border-t border-gray-200 flex justify-between text-xs text-gray-500 font-medium">
                <span>🔋 Battery: {device.battery_level}%</span>
                <span>Last Ping: {new Date(device.last_ping).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}