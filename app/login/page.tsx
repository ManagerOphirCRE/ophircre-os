"use client";
import { useState } from 'react';
import { supabase } from '@/app/utils/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // NEW: Toggle between Password and Magic Link
  const[useMagicLink, setUseMagicLink] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleLogin(e: any) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      if (useMagicLink) {
        // Send Passwordless Magic Link
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        setIsSent(true);
      } else {
        // Standard Password Login (For Founder)
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        window.location.href = '/';
      }
    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isSent) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-10 text-center border-t-8 border-blue-600">
          <div className="text-5xl mb-4">✉️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Check your email!</h2>
          <p className="text-gray-600">We sent a secure magic link to <strong>{email}</strong>. Click the link to instantly log in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        
        <div className="bg-slate-800 p-8 text-center">
          <h1 className="text-3xl font-bold text-white tracking-wider">OphirCRE</h1>
          <p className="text-slate-400 mt-2 text-sm uppercase tracking-widest">Operating System</p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">Secure Login</h2>
          
          {errorMsg && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 text-center">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
              <input 
                type="email" 
                required
                className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            {!useMagicLink && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                <input 
                  type="password" 
                  required
                  className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className={`w-full py-3 rounded-lg font-bold text-white transition shadow-md mt-2 ${isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isLoading ? 'Authenticating...' : useMagicLink ? 'Send Magic Link' : 'Sign In'}
            </button>
          </form>

          {/* TOGGLE BUTTON */}
          <div className="mt-6 text-center border-t pt-4">
            <button 
              onClick={() => { setUseMagicLink(!useMagicLink); setErrorMsg(''); }} 
              className="text-sm font-bold text-blue-600 hover:underline"
            >
              {useMagicLink ? 'Log in with a password instead' : 'Forgot password? Use a Magic Link'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}