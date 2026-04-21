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

  useEffect(() => {
    async function setupAccount() {
      if (!email || !company || !sessionId) return setStatus("Invalid onboarding link.");

      try {
        // 1. Create Organization
        const { data: org, error: orgErr } = await supabase.from('organizations').insert([{
          company_name: company, owner_email: email, stripe_customer_id: sessionId, subscription_status: 'active'
        }]).select().single();
        if (orgErr) throw orgErr;

        // 2. Create Admin Role
        const { error: roleErr } = await supabase.from('user_roles').insert([{ email: email, role: 'admin', organization_id: org.id }]);
        if (roleErr) throw roleErr;

        // 3. AUTO-PROVISIONING: Inject Standard Chart of Accounts
        const defaultAccounts =[
          { name: 'Business Checking', account_type: 'Asset', organization_id: org.id },
          { name: 'Security Deposits Held', account_type: 'Liability', organization_id: org.id },
          { name: 'Owner Equity', account_type: 'Equity', organization_id: org.id },
          { name: 'Rental Income', account_type: 'Revenue', organization_id: org.id },
          { name: 'CAM Reimbursement', account_type: 'Revenue', organization_id: org.id },
          { name: 'General Maintenance', account_type: 'Expense', organization_id: org.id },
          { name: 'Property Taxes', account_type: 'Expense', organization_id: org.id },
          { name: 'Insurance', account_type: 'Expense', organization_id: org.id }
        ];
        await supabase.from('chart_of_accounts').insert(defaultAccounts);

        // 4. AUTO-PROVISIONING: Inject Default Templates
        await supabase.from('lease_templates').insert([{
          name: 'Standard Commercial NNN Lease',
          body_text: 'COMMERCIAL LEASE AGREEMENT\n\nThis Lease is made on {{TODAY_DATE}}, between {{LANDLORD_NAME}} ("Landlord") and {{TENANT_NAME}} ("Tenant").\n\n1. PREMISES: Landlord leases to Tenant the property at {{PROPERTY_ADDRESS}} - {{SPACE_NAME}}.\n2. TERM: {{START_DATE}} to {{END_DATE}}.\n3. BASE RENT: ${{RENT_AMOUNT}} per month.',
          organization_id: org.id
        }]);

        await supabase.from('document_templates').insert([{
          name: 'Notice of Default - Late Rent',
          subject: 'URGENT: Notice of Default - Past Due Balance',
          body_text: 'Dear {{TENANT_NAME}},<br><br>Your account for {{PROPERTY_ADDRESS}} is past due. Please remit payment immediately.<br><br>Sincerely,<br>{{LANDLORD_NAME}}',
          organization_id: org.id
        }]);

        // 5. Send Magic Link
        const { error: authErr } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/` } });
        if (authErr) throw authErr;

        setStatus(`Success! Account provisioned for ${company}. Check your email (${email}) for your secure login link.`);
      } catch (error: any) {
        setStatus("Error setting up account: " + error.message);
      }
    }
    setupAccount();
  }, [email, company, sessionId]);

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