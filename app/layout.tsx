"use client"
import { Inter } from "next/font/google";
import "./globals.css";
import { useEffect, useState } from "react";
import { supabase } from "@/app/utils/supabase";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets:["latin"] });

const NAV_LINKS =[
  { name: 'Dashboard', path: '/' },
  { name: 'Properties', path: '/properties' },
  { name: 'Tenants & Leases', path: '/tenants' },
  { name: 'Lease Drafter', path: '/lease-drafter' },
  { name: 'CAM Reconciliations', path: '/cam-reconciliation' },
  { name: 'AI Scanner', path: '/ai-scanner' },
  { name: 'AI Auditor', path: '/ai-auditor' },
  { name: 'Communications', path: '/communications' },
  { name: 'Task Board', path: '/tasks' },
  { name: 'Leasing Pipeline', path: '/leasing' },
  { name: 'Filing Cabinet', path: '/documents' },
  { name: 'Financials', path: '/financials' },
  { name: 'Accounts Payable', path: '/accounts-payable' },
  { name: '⚙️ Settings', path: '/settings' }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const[searchQuery, setSearchQuery] = useState('')
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setIsLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session) })
    return () => subscription.unsubscribe()
  },[])

  if (isLoading) return <html lang="en"><body><div className="flex h-screen items-center justify-center bg-slate-900 text-white">Loading...</div></body></html>

  const isPublic = pathname === '/login' || pathname.startsWith('/portal') || pathname.startsWith('/vendor-portal') || pathname.startsWith('/apply')
  
  if (!session && !isPublic) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return <html lang="en"><body></body></html>
  }

  if (isPublic) return <html lang="en"><body className={inter.className}>{children}</body></html>

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen bg-gray-100 flex-col md:flex-row">
          
          {/* DESKTOP SIDEBAR (Hidden on Mobile) */}
          <div className="hidden md:flex w-64 bg-gray-900 text-white flex-col">
            <div className="p-6"><h1 className="text-2xl font-bold">OphirCRE</h1></div>
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-4">
              {NAV_LINKS.map(link => (
                <a key={link.path} href={link.path} className="block px-4 py-2 hover:bg-gray-800 rounded-lg text-sm text-gray-300 transition">{link.name}</a>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-800">
              <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
              <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')} className="mt-2 text-xs text-red-400">Sign Out</button>
            </div>
          </div>

          {/* MAIN CONTENT */}
          <div className="flex-1 flex flex-col overflow-hidden mb-16 md:mb-0">
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
              <form onSubmit={(e) => { e.preventDefault(); if(searchQuery) window.location.href=`/search?q=${searchQuery}` }} className="flex w-full max-w-md">
                <input type="text" placeholder="Search..." className="w-full border rounded-l-lg p-2 text-sm outline-none" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <button type="submit" className="bg-blue-600 text-white px-4 rounded-r-lg text-sm">Search</button>
              </form>
            </div>
            {children}
          </div>

          {/* MOBILE BOTTOM NAV (Hidden on Desktop) */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 text-white flex justify-around p-3 text-xs border-t border-gray-800 z-50">
            <a href="/" className="flex flex-col items-center">🏠<span>Home</span></a>
            <a href="/properties" className="flex flex-col items-center">🏢<span>Props</span></a>
            <a href="/financials" className="flex flex-col items-center">💰<span>Finance</span></a>
            <a href="/tasks" className="flex flex-col items-center">✅<span>Tasks</span></a>
          </div>

        </div>
      </body>
    </html>
  );
}