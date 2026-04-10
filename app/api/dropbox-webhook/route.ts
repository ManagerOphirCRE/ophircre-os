import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    // Dropbox Sign sends webhooks as multipart/form-data
    const formData = await req.formData();
    const payloadString = formData.get('payload') as string;
    
    if (!payloadString) throw new Error("No payload found");
    
    const payload = JSON.parse(payloadString);
    const eventType = payload.event?.event_type;

    // We only care when the document is fully signed by the tenant
    if (eventType === 'signature_request_all_signed') {
      const signatureRequestId = payload.signature_request?.signature_request_id;
      
      // 1. Find the lease associated with this signature request
      // (Note: In a production environment, you would save the signatureRequestId to the lease table when you send it. 
      // For this webhook, we will find the most recent 'Pending Certified Signature' lease for the email address).
      const signerEmail = payload.signature_request?.signatures[0]?.signer_email_address;
      
      if (signerEmail) {
        const { data: tenant } = await supabase.from('tenants').select('id').ilike('contact_email', signerEmail).single();
        
        if (tenant) {
          // Update the lease status to Active
          await supabase.from('leases')
            .update({ 
              status: 'Active', 
              signed_at: new Date().toISOString() 
            })
            .eq('tenant_id', tenant.id)
            .eq('status', 'Pending Certified Signature');

          // Drop a task for management
          await supabase.from('tasks').insert([{
            title: `CERTIFIED LEASE SIGNED`,
            description: `The lease sent via Dropbox Sign to ${signerEmail} has been fully executed.`,
            status: 'To Do',
            tenant_id: tenant.id
          }]);
        }
      }
    }

    // Dropbox Sign REQUIRES this exact text response to know the webhook was received successfully
    return new NextResponse('Hello API Event Received', { status: 200 });
  } catch (error: any) {
    console.error("Webhook Error:", error.message);
    return new NextResponse('Error processing webhook', { status: 500 });
  }
}