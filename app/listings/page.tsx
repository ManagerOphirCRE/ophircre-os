"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function PublicListingsPage() {
  const[listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(
    function loadData() {
      async function fetchListings() {
        const { data } = await supabase
          .from('spaces')
          .select('*, properties(name, address)')
          .eq('is_listed', true)
          .order('created_at', { ascending: false });

        if (data) setListings(data);
        setIsLoading(false);
      }
      fetchListings();
    }
    ,[]
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4">
      <div className="max-w-5xl w-full">
        
        <div className="bg-slate-900 p-8 text-center text-white rounded-t-2xl">
          <h1 className="text-3xl font-bold tracking-wider">OphirCRE</h1>
          <p className="text-slate-400 mt-2">Available Commercial Spaces</p>
        </div>

        <div className="bg-white p-8 rounded-b-2xl shadow-xl space-y-8">
          {isLoading ? (
            <p className="text-center text-gray-500">Loading available spaces...</p>
          ) : listings.length === 0 ? (
            <p className="text-center text-gray-500">No spaces are currently listed for rent.</p>
          ) : (
            listings.map(space => (
              <div key={space.id} className="border border-gray-200 rounded-xl overflow-hidden flex flex-col md:flex-row hover:shadow-lg transition bg-white">
                
                {/* NEW: Image Section */}
                <div className="md:w-1/3 h-64 md:h-auto bg-gray-200 relative">
                  {space.listing_image_url ? (
                    <img src={space.listing_image_url} alt={space.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-medium">No Photo Available</div>
                  )}
                </div>

                {/* Details Section */}
                <div className="p-6 md:w-2/3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-2xl font-bold text-blue-600">{space.name}</h2>
                        <p className="text-gray-900 font-bold mt-1">{space.properties?.name}</p>
                        <p className="text-gray-500 text-sm">{space.properties?.address}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-green-600">${Number(space.listing_price || 0).toLocaleString()}/mo</p>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">{space.square_footage} SqFt | {space.space_type}</p>
                      </div>
                    </div>
                    
                    {space.listing_description && (
                      <p className="text-sm text-gray-700 mt-4 leading-relaxed">{space.listing_description}</p>
                    )}
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-gray-100 text-right">
                    <a href="/apply" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition shadow-sm">
                      Apply Now
                    </a>
                  </div>
                </div>

              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}