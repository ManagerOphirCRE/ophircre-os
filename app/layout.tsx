"use client"
import { Inter } from "next/font/google";
import "./globals.css";
import { useEffect, useState } from "react";
import { supabase } from "@/app/utils/supabase";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets:["latin"] });

const NAV_LINKS =[
  { name: 'Dashboard', path: '/', allowed: ['admin', 'assistant'] },
  { name: 'Inbox & Workspace', path: '/workspace', allowed: ['admin', 'assistant'] },
  { name: 'Properties', path: '/properties', allowed: ['admin', 'assistant'] },
  { name: 'Deal Analyzer', path: '/deal-analyzer', allowed: ['admin'] },
  { name: 'Credential Vault', path: '/vault', allowed: ['admin'] },
  { name: 'Rent Roll', path: '/rent-roll', allowed: ['admin', 'assistant'] },
  { name: 'Compliance & COI', path: '/compliance', allowed: ['admin', 'assistant'] },
  { name: 'Tenants & Leases', path: '/tenants', allowed: ['admin', 'assistant'] },
  { name: 'Vendors', path: '/vendors', allowed: ['admin', 'assistant'] },
  { name: 'Staff Timesheets', path: '/timesheets', allowed: ['admin', 'assistant'] },
  { name: 'Leasing Pipeline', path: '/leasing', allowed: ['admin', 'assistant'] },
  { name: 'Lease Drafter', path: '/lease-drafter', allowed: ['admin', 'assistant'] },
  { name: 'Communications', path: '/communications', allowed: ['admin', 'assistant'] },
  { name: 'Task Board', path: '/tasks', allowed: ['admin', 'assistant'] },
  { name: 'Filing Cabinet', path: '/documents', allowed: ['admin', 'assistant'] },
  { name: 'AI Scanner', path: '/ai-scanner', allowed: ['admin'] },
  { name: 'AI Auditor', path: '/ai-auditor', allowed: ['admin'] },
  { name: 'CAM Reconciliations', path: '/cam-reconciliation', allowed: ['admin'] },
  { name: '📊 Reports & P&L', path: '/reports', allowed: ['admin'] },
  { name: 'Financials', path: '/financials', allowed: ['admin'] },
  { name: 'Accounts Payable', path: '/accounts-payable', allowed: ['admin'] },
  { name: '⚙️ Settings', path: '/settings', allowed: ['admin'] }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const[userRole, setUserRole] = useState<string>('assistant')
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const[isMobileMenuOpen, setIsMobileMenuOpen] = useState(false) // NEW: Mobile Menu State
  const pathname = usePathname()

  useEffect(() => {
    async function initAuth() {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      if (session?.user?.email) {
        const { data: roleData } = await supabase.from('user_roles').select('role').eq('email', session.user.email).single()
        if (roleData) setUserRole(roleData.role)
      }
      setIsLoading(false)
    }
    initAuth()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { 
      setSession(session); if (!session) setUserRole('assistant')
    })
    return () => subscription.unsubscribe()
  },[])

  if (isLoading) return <html lang="en"><body><div className="flex h-screen items-center justify-center bg-slate-900 text-white">Loading...</div></body></html>

  // NEW: Added '/listings' to the public routes so anyone on the internet can see your vacant spaces!
  const isPublic = pathname === '/login' || pathname.startsWith('/portal') || pathname.startsWith('/vendor-portal') || pathname.startsWith('/apply') || pathname.startsWith('/listings')
  
  if (!session && !isPublic) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return <html lang="en"><body></body></html>
  }

  if (isPublic) return <html lang="en"><body className={inter.className}>{children}</body></html>

  const visibleLinks = NAV_LINKS.filter(link => link.allowed.includes(userRole))

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen bg-gray-100 flex-col md:flex-row">
          
          {/* DESKTOP SIDEBAR */}
          <div className="hidden md:flex w-64 bg-gray-900 text-white flex-col print:hidden">
            <div className="p-6">
              <h1 className="text-2xl font-bold">OphirCRE</h1>
              <p className="text-xs text-blue-400 mt-1 uppercase tracking-widest">{userRole} MODE</p>
            </div>
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-4">
              {visibleLinks.map(link => (
                <a key={link.path} href={link.path} className="block px-4 py-2 hover:bg-gray-800 rounded-lg text-sm text-gray-300 transition">{link.name}</a>
              ))}
            </nav>
            <div className="p-4 border-t border-gray-800">
              <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
              <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')} className="mt-2 text-xs text-red-400">Sign Out</button>
            </div>
          </div>

          {/* MOBILE FULL-SCREEN MENU (Hidden by default) */}
          {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-gray-900 text-white z-50 flex flex-col md:hidden overflow-y-auto">
              <div className="p-4 flex justify-between items-center border-b border-gray-800">
                <h1 className="text-xl font-bold">Menu</h1>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-3xl font-bold">&times;</button>
              </div>
              <nav className="flex-1 p-4 space-y-2">
                {visibleLinks.map(link => (
                  <a key={link.path} href={link.path} onClick={() => setIsMobileMenuOpen(false)} className="block px-4 py-3 bg-gray-800 rounded-lg text-sm text-gray-200">{link.name}</a>
                ))}
                <button onClick={() => supabase.auth.signOut().then(() => window.location.href='/login')} className="block w-full text-left px-4 py-3 mt-4 bg-red-900 rounded-lg text-sm text-red-200">Sign Out</button>
              </nav>
            </div>
          )}

          {/* MAIN CONTENT */}
          <div className="flex-1 flex flex-col overflow-hidden mb-16 md:mb-0">
            
            {/* TOP HEADER & SEARCH BAR (Fixed for Mobile) */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center print:hidden">
              <form onSubmit={(e) => { e.preventDefault(); if(searchQuery) window.location.href=`/search?q=${encodeURIComponent(searchQuery)}` }} className="flex w-full max-w-md mr-4">
                <input type="text" placeholder="Search..." className="w-full border rounded-l-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                <button type="submit" className="bg-blue-600 text-white px-4 rounded-r-lg text-sm font-bold">🔍</button>
              </form>
              
              {/* Hamburger Button for Mobile */}
              <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-2xl">☰</button>
              <div className="hidden md:block text-sm text-gray-500 font-medium">OphirCRE Admin</div>
            </div>
            
            {children}
          </div>

          {/* MOBILE BOTTOM NAV */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 text-white flex justify-around p-3 text-xs border-t border-gray-800 z-40 print:hidden">
            <a href="/" className="flex flex-col items-center">🏠<span>Home</span></a>
            <a href="/properties" className="flex flex-col items-center">🏢<span>Props</span></a>
            <a href="/tasks" className="flex flex-col items-center">✅<span>Tasks</span></a>
            <button onClick={() => setIsMobileMenuOpen(true)} className="flex flex-col items-center text-blue-400">☰<span>Menu</span></button>
          </div>

        </div>
      </body>
    </html>
  );
}