"use client";
import { useState } from 'react';

export default function PricingPage() {
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleSubscribe(e: any) {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const res = await fetch('/api/stripe-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, companyName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (error: any) {
      alert("Error: " + error.message + "\n(Ensure STRIPE_SECRET_KEY is set in Vercel)");
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Navigation */}
      <nav className="bg-slate-900 text-white px-8 py-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-wider">OphirCRE OS</h1>
        <a href="/login" className="text-sm font-bold hover:text-blue-400 transition">Log In</a>
      </nav>

      {/* Hero Section */}
      <div className="text-center py-20 px-4">
        <h2 className="text-5xl font-black text-slate-900 mb-6">The Ultimate CRE Operating System</h2>
        <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-12">
          Replace Yardi and AppFolio with an AI-powered platform built specifically for commercial syndicators and fund managers.
        </p>
      </div>

      {/* Pricing Card */}
      <div className="max-w-lg mx-auto bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden mb-20">
        <div className="p-10 text-center bg-blue-600 text-white">
          <h3 className="text-2xl font-bold mb-2">Professional Tier</h3>
          <div className="flex items-center justify-center mb-4">
            <span className="text-6xl font-black">$299</span>
            <span className="text-xl font-medium ml-2 opacity-80">/ month</span>
          </div>
          <p className="text-blue-100">Unlimited Properties. Unlimited Tenants. No hidden fees.</p>
        </div>
        
        <div className="p-10">
          <ul className="space-y-4 mb-8">
            <li className="flex items-center text-slate-700"><span className="text-green-500 mr-3 font-bold">✓</span> Double-Entry Financial Ledger</li>
            <li className="flex items-center text-slate-700"><span className="text-green-500 mr-3 font-bold">✓</span> AI Lease Abstraction & Invoice Reading</li>
            <li className="flex items-center text-slate-700"><span className="text-green-500 mr-3 font-bold">✓</span> Automated CAM Reconciliations</li>
            <li className="flex items-center text-slate-700"><span className="text-green-500 mr-3 font-bold">✓</span> Tenant & Vendor Portals</li>
            <li className="flex items-center text-slate-700"><span className="text-green-500 mr-3 font-bold">✓</span> Investor Portal & Capital Calls</li>
          </ul>

          <form onSubmit={handleSubscribe} className="space-y-4 border-t pt-6">
            <h4 className="font-bold text-slate-900 text-center mb-4">Start Your 14-Day Free Trial</h4>
            <input type="text" required placeholder="Company Name" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            <input type="email" required placeholder="Admin Email Address" className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={isProcessing} className={`w-full py-4 rounded-xl font-black text-white text-lg transition shadow-lg ${isProcessing ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1'}`}>
              {isProcessing ? 'Connecting to Stripe...' : 'Subscribe Now'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}