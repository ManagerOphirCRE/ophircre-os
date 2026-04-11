"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/app/utils/supabase";
import { useSearchParams } from "next/navigation";

export default function SaasOnboardingPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const company = searchParams.get('company');
  const sessionId = searchParams.get('session_id');
  
  const [status, setStatus] = useState('Verifying payment and provisioning your server...');

  const setupAccount = async () => {
    if (!email || !company || !sessionId) {
      setStatus("Invalid onboarding link. Please contact support.");
      return;
    }

    try {
      // 1. Create their Organization in the database
      const { data: org, error: orgErr } = await supabase.from('organizations').insert([{
        company_name: company,
        owner_email: email,
        stripe_customer_id: sessionId,
        subscription_status: 'active'
      }]).select().single();

      if (orgErr) throw orgErr;

      // 2. Create their Admin Role
      const { error: roleErr } = await supabase.from('user_roles').insert([{
        email: email,
        role: 'admin',
        organization_id: org.id
      }]);

      if (roleErr) throw roleErr;

      // 3. Send them their first Magic Link to log in
      const { error: authErr } = await supabase.auth.signInWithOtp({ 
        email, 
        options: { emailRedirectTo: `${window.location.origin}/` } 
      });

      if (authErr) throw authErr;

      setStatus(`Success! Account created for ${company}. Please check your email (${email}) for your secure login link to access your new dashboard.`);
    } catch (error: any) {
      setStatus("Error setting up account: " + error.message);
    }
  };

  useEffect(() => { setupAccount(); }, [ /* mount */ ]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-10 text-center border-t-8 border-blue-600">
        <h2 className="text-3xl font-black text-slate-900 mb-4">OphirCRE OS</h2>
        <div className="animate-pulse mb-6 text-4xl">⚙️</div>
        <p className="text-slate-600 font-medium">{status}</p>
      </div>
    </div>
  );
}