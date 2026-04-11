"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function PublicListingsPage() {
  const [listings, setListings] = useState<any[]>([]);
  const[isLoading, setIsLoading] = useState(true);

  // Tour Booking State
  const[isTourModalOpen, setIsTourModalOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [tourDate, setTourDate] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  useEffect(function loadData() {
    async function fetchListings() {
      const { data } = await supabase.from('spaces').select('*, properties(id, name, address)').eq('is_listed', true).order('created_at', { ascending: false });
      if (data) setListings(data);
      setIsLoading(false);
    }
    fetchListings();
  },[]);

  function openTourModal(propertyId: string) {
    setSelectedPropertyId(propertyId);
    setIsTourModalOpen(true);
  }

  async function handleBookTour(e: any) {
    e.preventDefault();
    setIsBooking(true);
    try {
      const res = await fetch('/api/book-tour', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: selectedPropertyId, prospectName, prospectEmail, prospectPhone, tourDate })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert("Tour successfully booked! Check your email for confirmation.");
      setIsTourModalOpen(false);
      setProspectName(''); setProspectEmail(''); setProspectPhone(''); setTourDate('');
    } catch (error: any) {
      alert("Error booking tour: " + error.message);
    } finally {
      setIsBooking(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4">
      <div className="max-w-4xl w-full">
        <div className="bg-slate-900 p-8 text-center text-white rounded-t-2xl">
          <h1 className="text-3xl font-bold tracking-wider">OphirCRE</h1>
          <p className="text-slate-400 mt-2">Available Commercial Spaces</p>
        </div>

        <div className="bg-white p-8 rounded-b-2xl shadow-xl space-y-6">
          {isLoading ? (
            <p className="text-center text-gray-500">Loading available spaces...</p>
          ) : listings.length === 0 ? (
            <p className="text-center text-gray-500">No spaces are currently listed for rent.</p>
          ) : (
            listings.map(space => (
              <div key={space.id} className="border border-gray-200 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center hover:shadow-md transition">
                <div className="flex-1 pr-4">
                  <h2 className="text-2xl font-bold text-blue-600">{space.name}</h2>
                  <p className="text-gray-600 font-medium">{space.properties?.name} - {space.properties?.address}</p>
                  <p className="text-gray-500 mt-2">{space.square_footage} SqFt | <span className="capitalize">{space.space_type}</span></p>
                  {space.listing_description && <p className="text-sm text-gray-700 mt-3 bg-gray-50 p-3 rounded">{space.listing_description}</p>}
                </div>
                <div className="mt-6 md:mt-0 text-right flex flex-col items-end space-y-3">
                  <p className="text-2xl font-black text-green-600">${Number(space.listing_price || 0).toLocaleString()}/mo</p>
                  <a href="/apply" className="w-full text-center bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold transition shadow-sm">Apply Now</a>
                  <button onClick={() => openTourModal(space.properties?.id)} className="w-full text-center bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-6 py-2 rounded-lg font-bold transition shadow-sm">Book a Tour</button>
                </div>
              </div>
            ))
          )}
        </div>

        {isTourModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
              <h3 className="text-xl font-bold mb-2 text-gray-800">Schedule a Property Tour</h3>
              <p className="text-sm text-gray-500 mb-6">Select a date and time, and a leasing agent will meet you at the property.</p>
              <form onSubmit={handleBookTour} className="space-y-4">
                <input type="text" required placeholder="Full Name" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={prospectName} onChange={(e) => setProspectName(e.target.value)} />
                <input type="email" required placeholder="Email Address" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={prospectEmail} onChange={(e) => setProspectEmail(e.target.value)} />
                <input type="tel" required placeholder="Phone Number" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={prospectPhone} onChange={(e) => setProspectPhone(e.target.value)} />
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Requested Tour Date & Time</label>
                  <input type="datetime-local" required className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={tourDate} onChange={(e) => setTourDate(e.target.value)} />
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button type="button" onClick={() => setIsTourModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded font-medium">Cancel</button>
                  <button type="submit" disabled={isBooking} className={`px-6 py-2 rounded font-bold text-white transition ${isBooking ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>{isBooking ? 'Booking...' : 'Confirm Tour'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}