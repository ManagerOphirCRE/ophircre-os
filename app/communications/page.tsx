"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function CommunicationsPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  
  const[selectedTenantId, setSelectedTenantId] = useState('ALL')
  const [messageType, setMessageType] = useState('Email') // NEW: Email or SMS
  const [subject, setSubject] = useState('')
  const[body, setBody] = useState('')
  const [isSending, setIsSending] = useState(false)

  useEffect(() => { fetchData() },[])

  async function fetchData() {
    const { data: msgs } = await supabase.from('communications').select(`*, tenants(name)`).order('created_at', { ascending: false })
    if (msgs) setMessages(msgs)
    const { data: tnts } = await supabase.from('tenants').select('*').order('name', { ascending: true })
    if (tnts) setTenants(tnts)
  }

  async function sendMessage() {
    if (!body) return alert("Please enter a message.")
    if (messageType === 'Email' && !subject) return alert("Emails require a subject.")
    setIsSending(true)

    try {
      let recipients =[]
      if (selectedTenantId === 'ALL') {
        recipients = tenants.filter(t => messageType === 'Email' ? t.contact_email : t.contact_phone)
      } else {
        const singleTenant = tenants.find(t => t.id === selectedTenantId)
        if (singleTenant) recipients.push(singleTenant)
      }

      if (recipients.length === 0) throw new Error(`No valid ${messageType === 'Email' ? 'emails' : 'phone numbers'} found for selected tenant(s).`)

      // Loop through recipients and send via the correct API
      for (const recipient of recipients) {
        if (messageType === 'Email') {
          const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to: recipient.contact_email, subject, text: body })
          })
          if (!res.ok) throw new Error((await res.json()).error)
        } 
        else if (messageType === 'SMS') {
          const res = await fetch('/api/send-sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Format phone numbers to ensure they have the +1 country code (if missing)
            body: JSON.stringify({ 
              to: recipient.contact_phone.startsWith('+') ? recipient.contact_phone : `+1${recipient.contact_phone.replace(/\D/g,'')}`, 
              body 
            })
          })
          if (!res.ok) throw new Error((await res.json()).error)
        }
      }

      // Log it in the database
      await supabase.from('communications').insert([{
        tenant_id: selectedTenantId === 'ALL' ? null : selectedTenantId,
        subject: messageType === 'SMS' ? 'SMS Text Message' : subject,
        body,
        type: messageType,
        status: 'Sent'
      }])

      alert(`Successfully sent ${messageType} to ${recipients.length} recipient(s)!`)
      setSubject(''); setBody(''); fetchData()
    } catch (error: any) {
      alert("Error: " + error.message)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Communications Hub</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-8 flex space-x-6 bg-gray-100">
        
        {/* LEFT COLUMN: History */}
        <div className="w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-120px)]">
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl"><h3 className="font-bold text-gray-800">Sent History</h3></div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="p-4 border border-gray-100 rounded-lg shadow-sm bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider ${msg.type === 'SMS' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {msg.type}
                    </span>
                    <span className="ml-2 text-sm font-medium text-gray-600">To: {msg.tenant_id ? msg.tenants?.name : 'ALL TENANTS'}</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleDateString()}</span>
                </div>
                <h4 className="font-semibold text-gray-900">{msg.subject}</h4>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{msg.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Compose */}
        <div className="w-1/2 bg-white rounded-xl shadow-sm border border-gray-200 h-fit">
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl"><h3 className="font-bold text-gray-800">Compose Notice</h3></div>
          <div className="p-6 space-y-4">
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Send Via:</label>
                <select className="w-full border p-2 rounded text-sm outline-none" value={messageType} onChange={(e) => setMessageType(e.target.value)}>
                  <option value="Email">Email</option>
                  <option value="SMS">SMS Text Message</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
                <select className="w-full border p-2 rounded text-sm outline-none" value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)}>
                  <option value="ALL">📢 Broadcast to ALL</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            {messageType === 'Email' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject:</label>
                <input type="text" className="w-full border p-2 rounded text-sm outline-none" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message:</label>
              <textarea className="w-full border p-3 rounded text-sm h-48 outline-none resize-none" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>

            <button onClick={sendMessage} disabled={isSending} className={`w-full py-3 rounded-md font-bold text-white transition shadow-sm ${isSending ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isSending ? 'Sending...' : `Send ${messageType}`}
            </button>
          </div>
        </div>

      </main>
    </>
  )
}