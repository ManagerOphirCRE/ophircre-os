"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function PublicListingsPage() {
  const[listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Bypassing the formatting bug by writing the hook differently
  useEffect(
    function loadData() {
      async function fetchListings() {
        const { data } = await supabase
          .from('spaces')
          .select('*, properties(name, address)')
          .eq('is_listed', true)
          .order('created_at', { ascending: false });

        if (data) {
          setListings(data);
        }
        setIsLoading(false);
      }
      fetchListings();
    }
    , 
    [ /* empty dependency array */ ]
  );

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
                <div>
                  <h2 className="text-2xl font-bold text-blue-600">{space.name}</h2>
                  <p className="text-gray-600 font-medium">{space.properties?.name} - {space.properties?.address}</p>
                  <p className="text-gray-500 mt-2">{space.square_footage} SqFt | <span className="capitalize">{space.space_type}</span></p>
                  {space.listing_description && (
                    <p className="text-sm text-gray-700 mt-3 bg-gray-50 p-3 rounded">{space.listing_description}</p>
                  )}
                </div>
                <div className="mt-6 md:mt-0 text-right flex flex-col items-end">
                  <p className="text-2xl font-black text-green-600 mb-4">
                    ${Number(space.listing_price || 0).toLocaleString()}/mo
                  </p>
                  <a href="/apply" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition shadow-sm">
                    Apply Now
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}