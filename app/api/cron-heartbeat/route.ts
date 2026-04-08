import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const today = new Date();
    
    // Calculate target dates
    const in60Days = new Date(); in60Days.setDate(today.getDate() + 60);
    const target60 = in60Days.toISOString().split('T')[0];

    const in30Days = new Date(); in30Days.setDate(today.getDate() + 30);
    const target30 = in30Days.toISOString().split('T')[0];

    let tasksCreated = 0;

    // 1. Check for Leases expiring in exactly 60 days
    const { data: leases } = await supabase.from('leases').select('*, tenants(name)').eq('end_date', target60);
    if (leases && leases.length > 0) {
      const tasks = leases.map(l => ({
        title: `URGENT: Lease expiring for ${l.tenants?.name}`,
        description: `Lease expires on ${l.end_date}. Begin renewal negotiations.`,
        status: 'To Do', tenant_id: l.tenant_id
      }));
      await supabase.from('tasks').insert(tasks);
      tasksCreated += tasks.length;
    }

    // 2. Check for Rent Escalations happening in exactly 30 days
    const { data: escalations } = await supabase.from('leases').select('*, tenants(name)').eq('next_escalation_date', target30);
    if (escalations && escalations.length > 0) {
      const tasks = escalations.map(l => ({
        title: `FINANCE: Rent Escalation for ${l.tenants?.name}`,
        description: `Rent escalates by ${l.escalation_percentage}% on ${l.next_escalation_date}. Update the ledger and notify the tenant.`,
        status: 'To Do', tenant_id: l.tenant_id
      }));
      await supabase.from('tasks').insert(tasks);
      tasksCreated += tasks.length;
    }

    // 3. Check for Tenant COIs expiring in exactly 30 days
    const { data: tenantCois } = await supabase.from('tenants').select('id, name, coi_expiration').eq('coi_expiration', target30);
    if (tenantCois && tenantCois.length > 0) {
      const tasks = tenantCois.map(t => ({
        title: `COMPLIANCE: COI Expiring for ${t.name}`,
        description: `Tenant's Certificate of Insurance expires on ${t.coi_expiration}. Request updated COI.`,
        status: 'To Do', tenant_id: t.id
      }));
      await supabase.from('tasks').insert(tasks);
      tasksCreated += tasks.length;
    }

    // 4. Check for Vendor COIs expiring in exactly 30 days
    const { data: vendorCois } = await supabase.from('vendors').select('id, company_name, coi_expiration').eq('coi_expiration', target30);
    if (vendorCois && vendorCois.length > 0) {
      const tasks = vendorCois.map(v => ({
        title: `COMPLIANCE: Vendor COI Expiring (${v.company_name})`,
        description: `Vendor's Certificate of Insurance expires on ${v.coi_expiration}. Do not dispatch until updated.`,
        status: 'To Do'
      }));
      await supabase.from('tasks').insert(tasks);
      tasksCreated += tasks.length;
    }
// 5. Check for Overdue Rent & Apply Late Fees
    const todayStr = today.toISOString().split('T')[0];
    
    // Find invoices that are Unpaid and past their due date
    const { data: overdueInvoices } = await supabase
      .from('tenant_invoices')
      .select('*')
      .eq('status', 'Unpaid')
      .lt('due_date', todayStr);

    if (overdueInvoices && overdueInvoices.length > 0) {
      // Mark them as Overdue
      const overdueIds = overdueInvoices.map(i => i.id);
      await supabase.from('tenant_invoices').update({ status: 'Overdue' }).in('id', overdueIds);

      // Generate a 5% Late Fee invoice for each
      const lateFeeInvoices = overdueInvoices.map(inv => ({
        tenant_id: inv.tenant_id,
        lease_id: inv.lease_id,
        amount: Number(inv.amount) * 0.05, // 5% Late Fee
        description: `Late Fee (5%) for ${inv.description}`,
        due_date: todayStr,
        status: 'Unpaid'
      }));

      await supabase.from('tenant_invoices').insert(lateFeeInvoices);
      tasksCreated += lateFeeInvoices.length;
    }
    return NextResponse.json({ success: true, message: `Heartbeat ran successfully. Created ${tasksCreated} automated tasks.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
}