"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function DocumentsPage() {
  const [files, setFiles] = useState<any[]>([]);
  const[uploading, setUploading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const[syncingFile, setSyncingFile] = useState<string | null>(null);

  useEffect(function loadDocs() {
    async function fetchFiles() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) setUserEmail(session.user.email);

      const { data } = await supabase.storage.from('documents').list();
      if (data) setFiles(data.filter(file => file.name !== '.emptyFolderPlaceholder'));
    }
    fetchFiles();
  },[]);

  async function uploadFile(event: any) {
    try {
      setUploading(true);
      const file = event.target.files[0]; if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error } = await supabase.storage.from('documents').upload(fileName, file);
      if (error) throw error;
      
      alert('File uploaded successfully!');
      const { data } = await supabase.storage.from('documents').list();
      if (data) setFiles(data.filter(f => f.name !== '.emptyFolderPlaceholder'));
    } catch (error: any) { alert('Error: ' + error.message); } finally { setUploading(false); }
  }

  function getFileUrl(fileName: string) {
    const { data } = supabase.storage.from('documents').getPublicUrl(fileName);
    return data.publicUrl;
  }

  // NEW: Google Drive Sync
  async function backupToDrive(fileName: string) {
    if (!userEmail) return alert("You must be logged in.");
    setSyncingFile(fileName);
    try {
      const res = await fetch('/api/drive-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, userEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      alert(`Successfully backed up to Google Drive!\nView it here: ${data.driveLink}`);
    } catch (error: any) {
      alert("Sync Error: " + error.message + "\n(Make sure you connected your Google account in the Workspace tab!)");
    } finally {
      setSyncingFile(null);
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center z-10 relative">
        <h2 className="text-xl font-semibold text-gray-800">Global Filing Cabinet</h2>
        <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm cursor-pointer">
          {uploading ? 'Uploading...' : '+ Upload Document'}
          <input type="file" className="hidden" onChange={uploadFile} disabled={uploading} />
        </label>
      </header>

      <main className="flex-1 overflow-y-auto p-8 relative bg-gray-100">
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden opacity-[0.03] flex flex-wrap justify-center items-center">
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="transform -rotate-45 text-2xl font-black text-black p-8 whitespace-nowrap">
              {userEmail} • {new Date().toLocaleDateString()}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative z-10">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {files.length > 0 ? files.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">📄 {file.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(file.metadata.size / 1024).toFixed(2)} KB</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                    {/* NEW: Backup Button */}
                    <button 
                      onClick={() => backupToDrive(file.name)} 
                      disabled={syncingFile === file.name}
                      className="text-green-600 hover:text-green-800 font-bold"
                    >
                      {syncingFile === file.name ? 'Syncing...' : '☁️ Backup to Drive'}
                    </button>
                    <a href={getFileUrl(file.name)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-900 font-bold">
                      View / Download
                    </a>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No documents uploaded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}