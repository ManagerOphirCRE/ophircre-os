"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function PublicListingsPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([{ role: 'assistant', content: 'Hi! I am the OphirCRE AI Leasing Agent. How can I help you today?' }]);
  const [chatInput, setChatInput] = useState('');
  const[isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(function loadData() {
    async function fetchListings() {
      const { data } = await supabase.from('spaces').select('*, properties(name, address)').eq('is_listed', true).order('created_at', { ascending: false });
      if (data) setListings(data);
      setIsLoading(false);
    }
    fetchListings();
  },[]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  async function sendChatMessage(e: any) {
    e.preventDefault();
    if (!chatInput) return;
    
    const newHistory = [...chatMessages, { role: 'user', content: chatInput }];
    setChatMessages(newHistory);
    setChatInput('');
    setIsChatting(true);

    try {
      const res = await fetch('/api/chat-public', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: chatInput, history: chatMessages })
      });
      const data = await res.json();
      setChatMessages([...newHistory, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setChatMessages([...newHistory, { role: 'assistant', content: 'Sorry, I am having trouble connecting to the server.' }]);
    } finally {
      setIsChatting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 relative">
      <div className="max-w-4xl w-full">
        <div className="bg-slate-900 p-8 text-center text-white rounded-t-2xl">
          <h1 className="text-3xl font-bold tracking-wider">OphirCRE</h1>
          <p className="text-slate-400 mt-2">Available Commercial Spaces</p>
        </div>

        <div className="bg-white p-8 rounded-b-2xl shadow-xl space-y-6">
          {isLoading ? <p className="text-center text-gray-500">Loading available spaces...</p> : listings.length === 0 ? <p className="text-center text-gray-500">No spaces are currently listed for rent.</p> : (
            listings.map(space => (
              <div key={space.id} className="border border-gray-200 rounded-xl overflow-hidden flex flex-col md:flex-row hover:shadow-lg transition bg-white">
                <div className="md:w-1/3 h-64 md:h-auto bg-gray-200 relative">
                  {space.listing_image_url ? <img src={space.listing_image_url} alt={space.name} className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-medium">No Photo Available</div>}
                </div>
                <div className="p-6 md:w-2/3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div><h2 className="text-2xl font-bold text-blue-600">{space.name}</h2><p className="text-gray-900 font-bold mt-1">{space.properties?.name}</p><p className="text-gray-500 text-sm">{space.properties?.address}</p></div>
                      <div className="text-right"><p className="text-2xl font-black text-green-600">${Number(space.listing_price || 0).toLocaleString()}/mo</p><p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">{space.square_footage} SqFt | {space.space_type}</p></div>
                    </div>
                    {space.listing_description && <p className="text-sm text-gray-700 mt-4 leading-relaxed">{space.listing_description}</p>}
                  </div>
                  <div className="mt-6 pt-4 border-t border-gray-100 text-right">
                    <a href="/apply" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition shadow-sm">Apply Now</a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI CHATBOT UI */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isChatOpen ? (
          <button onClick={() => setIsChatOpen(true)} className="bg-blue-600 text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center text-3xl hover:bg-blue-700 transition transform hover:scale-110">💬</button>
        ) : (
          <div className="bg-white w-80 h-96 rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">AI Leasing Agent</h3>
              <button onClick={() => setIsChatOpen(false)} className="text-white hover:text-gray-200 text-xl">&times;</button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-gray-50">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-4 py-2 rounded-lg text-sm max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isChatting && <div className="text-xs text-gray-400 italic">AI is typing...</div>}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChatMessage} className="p-3 bg-white border-t flex space-x-2">
              <input type="text" placeholder="Ask about a listing..." className="flex-1 border rounded-full px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
              <button type="submit" disabled={isChatting} className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold hover:bg-blue-700">↑</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}