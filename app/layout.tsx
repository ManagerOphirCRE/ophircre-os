"use client" // We need to make this a client component to check auth status
import { Inter } from "next/font/google";
import "./globals.css";
import { useEffect, useState } from "react";
import { supabase } from "@/app/utils/supabase";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const pathname = usePathname()

  useEffect(() => {
    // 1. Check if the user is logged in right now
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
    })

    // 2. Listen for login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // If the app is still checking the lock, show a loading screen
  if (isLoading) return <html lang="en"><body><div className="flex h-screen items-center justify-center bg-slate-900 text-white">Loading OphirCRE...</div></body></html>

  // SECURITY ROUTING LOGIC:
  // If they are NOT logged in, and they are trying to access an Admin page, force them to the Login page!
  const isPublicRoute = pathname === '/login' || pathname.startsWith('/portal') || pathname.startsWith('/vendor-portal')
  
  if (!session && !isPublicRoute) {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return <html lang="en"><body></body></html>
  }

  // If they are on a public route (Login, Tenant Portal, Vendor Portal), hide the Admin Sidebar
  if (isPublicRoute) {
    return (
      <html lang="en">
        <body className={inter.className}>
          {children}
        </body>
      </html>
    )
  }

  // Otherwise, show the secure Admin Layout!
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
              <a href="/ai-scanner" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">AI Lease Scanner</a>
              <a href="/ai-auditor" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">AI Auditor (Anomalies)</a>
              <a href="/communications" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Communications</a>
              <a href="/tasks" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Task Board</a>
              <a href="/documents" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Filing Cabinet</a>
              <a href="/financials" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">Financials</a>
              <a href="/settings" className="block px-4 py-3 hover:bg-gray-800 rounded-lg text-gray-300 transition">⚙️ Settings</a>
            </nav>
            <div className="p-4 border-t border-gray-800">
              <p className="text-sm text-gray-400 truncate">{session?.user?.email}</p>
              <button onClick={handleLogout} className="mt-2 text-xs text-red-400 hover:text-red-300 font-medium uppercase tracking-wider">
                Sign Out
              </button>
            </div>
          </div>

          {/* MAIN PAGE CONTENT */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {children}
          </div>

        </div>
      </body>
    </html>
  );
}