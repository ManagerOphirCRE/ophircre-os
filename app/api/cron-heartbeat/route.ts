import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We have to use the SERVICE ROLE key here because this runs in the background without a logged-in user
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // We will add this to Vercel next!
);

export async function GET(req: Request) {
  try {
    // 1. Find Leases expiring in exactly 60 days
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
    const targetDate = sixtyDaysFromNow.toISOString().split('T')[0];

    const { data: expiringLeases } = await supabase
      .from('leases')
      .select('*, tenants(name)')
      .eq('end_date', targetDate);

    // 2. Create Tasks for expiring leases
    if (expiringLeases && expiringLeases.length > 0) {
      const tasksToCreate = expiringLeases.map(lease => ({
        title: `URGENT: Lease expiring for ${lease.tenants?.name}`,
        description: `This lease expires on ${lease.end_date}. Please begin renewal negotiations.`,
        status: 'To Do',
        tenant_id: lease.tenant_id
      }));

      await supabase.from('tasks').insert(tasksToCreate);
    }

    // 3. (Future) Find Expiring COIs, Monthly Vendor Attestations, etc.
    // You can add infinite date-checking logic here!

    return NextResponse.json({ success: true, message: `Heartbeat ran successfully. Found ${expiringLeases?.length || 0} expiring leases.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}