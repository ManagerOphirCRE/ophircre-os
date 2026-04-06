"use client"
import { useState } from 'react'
import { supabase } from '@/app/utils/supabase'

export default function PortalLoginPage() {
  const[email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleMagicLinkLogin(e: any) {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // This tells Supabase where to send them after they click the link in their email
          emailRedirectTo: `${window.location.origin}/portal`,
        },
      })

      if (error) throw error
      setIsSent(true)
    } catch (error: any) {
      setErrorMsg(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isSent) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-t-8 border-green-500">
          <div className="text-5xl mb-4">✉️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Check your email!</h2>
          <p className="text-gray-600">We sent a secure magic link to <strong>{email}</strong>. Click the link in that email to instantly log into your portal.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-center">
          <h1 className="text-3xl font-bold text-white tracking-wider">OphirCRE</h1>
          <p className="text-blue-100 mt-2 text-sm uppercase tracking-widest">Client & Vendor Portal</p>
        </div>
        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-2 text-center">Secure Access</h2>
          <p className="text-sm text-gray-500 text-center mb-6">Enter your email address to receive a secure, passwordless login link.</p>
          
          {errorMsg && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 text-center">{errorMsg}</div>}

          <form onSubmit={handleMagicLinkLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
              <input type="email" required className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" disabled={isLoading} className={`w-full py-3 rounded-lg font-bold text-white transition shadow-md mt-2 ${isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isLoading ? 'Sending Link...' : 'Send Magic Link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}