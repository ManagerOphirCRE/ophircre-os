"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function IoTPage() {
  const [devices, setDevices] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchData(); },[]);

  async function fetchData() {
    const { data: dData } = await supabase.from('iot_devices').select('*, properties(name)').order('device_type');
    if (dData) setDevices(dData);
    
    // Fetch active tenants who do NOT have a PIN code yet
    const { data: tData } = await supabase.from('tenants').select('*, leases(spaces(name, properties(name)))').eq('status', 'active').is('access_pin', null);
    if (tData) setTenants(tData);
    
    setIsLoading(false);
  }

  async function toggleLock(id: string, currentValue: string) {
    const newValue = currentValue === 'Locked' ? 'Unlocked' : 'Locked';
    await supabase.from('iot_devices').update({ current_value: newValue, last_ping: new Date().toISOString() }).eq('id', id);
    fetchData();
  }

  // NEW: HUMAN-IN-THE-LOOP PIN PROVISIONING
  async function approveAndSyncPin(tenant: any) {
    const pin = Math.floor(1000 + Math.random() * 9000).toString(); // Generate 4 digit PIN
    if (!confirm(`Generate PIN [${pin}] for ${tenant.name} and sync to building locks?`)) return;

    try {
      // 1. Save PIN to database
      await supabase.from('tenants').update({ access_pin: pin }).eq('id', tenant.id);

      // 2. Email the tenant securely
      if (tenant.contact_email) {
        await fetch('/api/send-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: tenant.contact_email,
            subject: "Secure Building Access PIN",
            text: `Hello ${tenant.name},\n\nYour building access has been provisioned.\n\nYour secure door PIN is: ${pin}\n\nPlease do not share this code. It will automatically expire at the end of your lease.\n\nThank you,\nOphirCRE Management`
          })
        });
      }

      alert(`PIN ${pin} approved, synced to locks, and emailed to tenant!`);
      fetchData();
    } catch (error: any) { alert("Error: " + error.message); }
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
        
        {/* NEW: PENDING ACCESS QUEUE */}
        {tenants.length > 0 && (
          <div className="mb-8 bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden">
            <div className="p-4 bg-orange-50 border-b border-orange-200 flex justify-between items-center">
              <h3 className="font-bold text-orange-900">⚠️ Pending Tenant Access Provisioning ({tenants.length})</h3>
              <span className="text-xs text-orange-700 font-bold uppercase">Approval Required</span>
            </div>
            <div className="p-4 space-y-3">
              {tenants.map(t => (
                <div key={t.id} className="flex justify-between items-center p-4 border rounded-lg bg-white shadow-sm">
                  <div>
                    <p className="font-bold text-gray-900">{t.name}</p>
                    <p className="text-sm text-gray-500">{t.leases?.[0]?.spaces?.properties?.name} - {t.leases?.[0]?.spaces?.name}</p>
                  </div>
                  <button onClick={() => approveAndSyncPin(t)} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-bold text-sm shadow-sm transition">
                    Generate & Sync PIN
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map(device => (
            <div key={device.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <div className="flex items-center space-x-2"><span className="text-xl">{device.device_type === 'Lock' ? '🔒' : '🌡️'}</span><h3 className="font-bold">{device.device_name}</h3></div>
                <span className="text-xs text-green-400 font-bold">{device.status}</span>
              </div>
              <div className="p-6 flex-1 flex flex-col items-center justify-center space-y-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest">{device.properties?.name || 'Unassigned Location'}</p>
                {device.device_type === 'Lock' ? (
                  <div className="text-center">
                    <p className={`text-3xl font-black mb-4 ${device.current_value === 'Locked' ? 'text-green-600' : 'text-red-600'}`}>{device.current_value}</p>
                    <button onClick={() => toggleLock(device.id, device.current_value)} className={`px-8 py-3 rounded-full font-bold text-white transition shadow-md ${device.current_value === 'Locked' ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                      {device.current_value === 'Locked' ? 'Unlock Door' : 'Lock Door'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center"><p className="text-5xl font-black text-gray-800 mb-4">{device.current_value}°F</p></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}