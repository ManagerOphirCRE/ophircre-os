"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';
import { useOrg } from '@/app/context/OrgContext';

export default function ProjectsPage() {
  const { orgId } = useOrg();
  const [projects, setProjects] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const[budget, setBudget] = useState('');

  useEffect(function loadData() {
    async function fetchData() {
      const { data: pData } = await supabase.from('projects').select('*, properties(name), vendor_submissions(amount, status)').order('created_at', { ascending: false });
      if (pData) setProjects(pData);
      const { data: propData } = await supabase.from('properties').select('*').order('name');
      if (propData) setProperties(propData);
    }
    if (orgId) fetchData();
  },[orgId]);

  async function saveProject(e: any) {
    e.preventDefault();
    try {
      await supabase.from('projects').insert([{ name, property_id: propertyId, budget: Number(budget), organization_id: orgId }]);
      setIsModalOpen(false); setName(''); setPropertyId(''); setBudget('');
      const { data } = await supabase.from('projects').select('*, properties(name), vendor_submissions(amount, status)').order('created_at', { ascending: false });
      if (data) setProjects(data);
    } catch (error: any) { alert("Error: " + error.message); }
  }

  function generateDrawRequest(project: any) {
    const approvedInvoices = project.vendor_submissions?.filter((v: any) => v.status === 'Approved' || v.status === 'Paid') ||[];
    const totalSpent = approvedInvoices.reduce((sum: number, v: any) => sum + Number(v.amount), 0);

    let html = `<html><head><title>Draw Request - ${project.name}</title><style>body{font-family:sans-serif;padding:40px;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border-bottom:1px solid #ddd;padding:12px;text-align:left;} th{background:#f9fafb;}</style></head><body>`;
    html += `<div style="text-align:center; border-bottom:2px solid #000; padding-bottom:20px; margin-bottom:30px;"><h2>OphirCRE Management</h2><h1>Construction Draw Request</h1></div>`;
    html += `<p><strong>Project:</strong> ${project.name}</p><p><strong>Property:</strong> ${project.properties?.name}</p><p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>`;
    html += `<table style="margin-bottom:30px;"><tbody><tr><td>Total Project Budget</td><td>$${Number(project.budget).toLocaleString()}</td></tr><tr><td>Total Approved Invoices (This Draw)</td><td style="color:green; font-weight:bold;">$${totalSpent.toLocaleString()}</td></tr><tr><td>Remaining Budget</td><td>$${(Number(project.budget) - totalSpent).toLocaleString()}</td></tr></tbody></table>`;
    html += `<p>Please release funds in the amount of <strong>$${totalSpent.toLocaleString()}</strong> to the operating account to cover the approved vendor invoices attached to this project.</p>`;
    html += `<br><br><p>Authorized Signature: ___________________________</p></body></html>`;

    const printWindow = window.open('', '_blank');
    printWindow?.document.write(html);
    printWindow?.document.close();
    printWindow?.print();
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">CapEx Projects & Bank Draws</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium shadow-sm">+ New Project</button>
      </header>

      <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(proj => {
            const spent = proj.vendor_submissions?.reduce((sum: number, v: any) => sum + Number(v.amount), 0) || 0;
            const pctUsed = proj.budget > 0 ? (spent / proj.budget) * 100 : 0;
            
            return (
              <div key={proj.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                  <h4 className="font-bold text-lg">{proj.name}</h4>
                  <span className="text-xs bg-slate-700 px-2 py-1 rounded uppercase">{proj.status}</span>
                </div>
                <div className="p-6 flex-1 space-y-4">
                  <p className="text-sm text-gray-500 font-bold">📍 {proj.properties?.name}</p>
                  <div className="flex justify-between items-end border-b pb-2"><span className="text-sm text-gray-500">Total Budget</span><span className="text-lg font-bold text-gray-900">${Number(proj.budget).toLocaleString()}</span></div>
                  <div className="flex justify-between items-end border-b pb-2"><span className="text-sm text-gray-500">Actual Spent</span><span className="text-lg font-bold text-red-600">${spent.toLocaleString()}</span></div>
                  <div className="pt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Budget Used</span><span>{pctUsed.toFixed(1)}%</span></div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${pctUsed > 90 ? 'bg-red-600' : 'bg-blue-600'}`} style={{ width: `${Math.min(pctUsed, 100)}%` }}></div></div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <button onClick={() => generateDrawRequest(proj)} className="w-full bg-gray-800 hover:bg-black text-white py-2 rounded font-bold transition">🖨️ Generate Bank Draw PDF</button>
                </div>
              </div>
            )
          })}
        </div>

        {isModalOpen && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Create CapEx Project</h3>
              <form onSubmit={saveProject} className="space-y-4">
                <input type="text" required placeholder="Project Name (e.g. Roof Replacement)" className="w-full border p-2 rounded outline-none" value={name} onChange={(e) => setName(e.target.value)} />
                <select required className="w-full border p-2 rounded outline-none" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">-- Select Property --</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <input type="number" required placeholder="Total Budget ($)" className="w-full border p-2 rounded outline-none" value={budget} onChange={(e) => setBudget(e.target.value)} />
                <div className="flex justify-end space-x-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Save Project</button></div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}