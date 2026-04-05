"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function DocumentsPage() {
  const [files, setFiles] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchFiles()
  }, [])

  // Get the list of files from the Supabase 'documents' bucket
  async function fetchFiles() {
    const { data, error } = await supabase.storage.from('documents').list()
    if (data) {
      // Filter out the hidden placeholder files Supabase sometimes makes
      setFiles(data.filter(file => file.name !== '.emptyFolderPlaceholder'))
    }
  }

  // Handle the file upload process
  async function uploadFile(event: any) {
    try {
      setUploading(true)
      const file = event.target.files[0]
      if (!file) return

      // Create a clean file name (removes spaces to prevent web errors)
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${fileName}`

      // Upload to Supabase
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError
      
      alert('File uploaded successfully!')
      fetchFiles() // Refresh the list
    } catch (error: any) {
      alert('Error uploading file: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  // Get the public URL to view/download the file
  function getFileUrl(fileName: string) {
    const { data } = supabase.storage.from('documents').getPublicUrl(fileName)
    return data.publicUrl
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Global Filing Cabinet</h2>
        
        {/* The hidden file input triggered by a nice looking button */}
        <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition shadow-sm cursor-pointer">
          {uploading ? 'Uploading...' : '+ Upload Document'}
          <input 
            type="file" 
            className="hidden" 
            onChange={uploadFile} 
            disabled={uploading}
          />
        </label>
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    📄 {file.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(file.metadata.size / 1024).toFixed(2)} KB
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <a 
                      href={getFileUrl(file.name)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-900"
                    >
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
  )
}