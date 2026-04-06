"use client" 
import { Inter } from "next/font/google";
import "./globals.css";
import { useEffect, useState } from "react";
import { supabase } from "@/app/utils/supabase";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets:["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const[isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { 
      setSession(session); 
      setIsLoading(false) 
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { 
      setSession(session) 
    })
    return () => subscription.unsubscribe()
  },[])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function handleSearch(e: any) {
    e.preventDefault()
    if (!searchQuery) return
    window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`
  }

  if (isLoading) return <html lang="en"><body><div className="flex h-screen items-center justify-center bg-slate-900 text-white">Loading OphirCRE...</div></body></html>

  const isPublicRoute = pathname === '/login' || pathname.startsWith('/portal') || pathname.startsWith('/vendor-portal')
  
  if (!session && !isPublicRoute) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return <html lang="en"><body></body></html>
  }

  if (isPublicRoute) {
    return (
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    )
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen bg-gray-100">
          
          {/* SECURE GLOBAL SIDEBAR */}
          <div className="w-64 bg-gray-900 text-white flex flex-col">
            <div className="p-6">
              <h1 className="text-2xl font-bold tracking-wider">OphirCRE</h1>
              <p className="text-sm text-gray-400 mt-1">Operating System</p>
            </div>
            <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto pb-4">
              <a href="/" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Dashboard</a>
              <a href="/properties" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Properties</a>
              <a href="/tenants" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Tenants & Leases</a>
              <a href="/lease-drafter" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Lease Drafter</a>
              <a href="/cam-reconciliation" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">CAM Reconciliations</a>
              <a href="/ai-scanner" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">AI Lease Scanner</a>
              <a href="/ai-auditor" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">AI Auditor</a>
              <a href="/communications" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Communications</a>
              <a href="/tasks" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Task Board</a>
              <a href="/documents" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Filing Cabinet</a>
              <a href="/financials" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Financials</a>
              <a href="/accounts-payable" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Accounts Payable</a>
              <a href="/settings" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">⚙️ Settings</a>
            </nav>
            <div className="p-4 border-t border-gray-800">
              <p className="text-sm text-gray-400 truncate">{session?.user?.email}</p>
              <button onClick={handleLogout} className="mt-2 text-xs text-red-400 hover:text-red-300 font-medium uppercase tracking-wider">Sign Out</button>
            </div>
          </div>

          {/* MAIN PAGE CONTENT WITH GLOBAL SEARCH BAR */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white border-b border-gray-200 px-8 py-3 flex justify-between items-center">
              <form onSubmit={handleSearch} className="w-96 flex">
                <input 
                  type="text" 
                  placeholder="Search tenants, properties, or tasks..." 
                  className="w-full border border-gray-300 rounded-l-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="bg-blue-600 text-white px-4 rounded-r-lg text-sm font-bold hover:bg-blue-700">Search</button>
              </form>
              <div className="text-sm text-gray-500 font-medium">OphirCRE Admin</div>
            </div>
            {children}
          </div>

        </div>
      </body>
    </html>
  );
}