import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const in60Days = new Date(); in60Days.setDate(today.getDate() + 60);
    const target60 = in60Days.toISOString().split('T')[0];

    const in30Days = new Date(); in30Days.setDate(today.getDate() + 30);
    const target30 = in30Days.toISOString().split('T')[0];

    let tasksCreated = 0;

    // 1. Leases expiring in 60 days
    const { data: leases } = await supabase.from('leases').select('*, tenants(name)').eq('end_date', target60);
    if (leases && leases.length > 0) {
      const tasks = leases.map(l => ({ title: `URGENT: Lease expiring for ${l.tenants?.name}`, description: `Lease expires on ${l.end_date}. Begin renewal negotiations.`, status: 'To Do', tenant_id: l.tenant_id }));
      await supabase.from('tasks').insert(tasks);
      tasksCreated += tasks.length;
    }

    // 2. Execute Rent Escalations happening in exactly 30 days
    const { data: escalations } = await supabase.from('leases').select('*, tenants(name, contact_email)').eq('next_escalation_date', target30);
    
    if (escalations && escalations.length > 0) {
      for (const lease of escalations) {
        const currentRent = Number(lease.base_rent_amount || 0);
        let newRent = currentRent;

        // Calculate the new rent based on the rule you set!
        if (lease.escalation_type === 'percentage') {
          const pct = Number(lease.escalation_percentage || 0) / 100;
          newRent = currentRent + (currentRent * pct);
        } else if (lease.escalation_type === 'fixed') {
          newRent = Number(lease.escalation_fixed_amount || currentRent);
        }

        // A. Update the lease in the database
        await supabase.from('leases').update({
          base_rent_amount: newRent,
          next_escalation_date: null // Clear it so it doesn't fire again until you set the next year's date
        }).eq('id', lease.id);

        // B. Email the Tenant via SendGrid
        if (lease.tenants?.contact_email) {
          await fetch('https://app.ophircre.com/api/send-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: lease.tenants.contact_email,
              subject: "Official Notice: Upcoming Rent Escalation",
              text: `Hello ${lease.tenants.name},\n\nThis is an automated courtesy notice regarding your lease.\n\nPer the terms of your agreement, your monthly Base Rent is scheduled to escalate on ${lease.next_escalation_date}.\n\nYour new Base Rent amount will be $${newRent.toFixed(2)}.\n\nThis new amount will be reflected on your next invoice. You can view your ledger at any time in your secure portal: https://app.ophircre.com/portal-login\n\nThank you,\nOphirCRE Management`
            })
          });
        }

        // C. Drop a confirmation task on your board
        await supabase.from('tasks').insert([{ 
          title: `EXECUTED: Rent Escalation for ${lease.tenants?.name}`, 
          description: `Rent was automatically increased from $${currentRent} to $${newRent.toFixed(2)}. The tenant was emailed a notice.`, 
          status: 'Done', 
          tenant_id: lease.tenant_id 
        }]);
        
        tasksCreated++;
      }
    }

    // 3. Tenant COIs expiring in 30 days
    const { data: tenantCois } = await supabase.from('tenants').select('id, name, coi_expiration').eq('coi_expiration', target30);
    if (tenantCois && tenantCois.length > 0) {
      const tasks = tenantCois.map(t => ({ title: `COMPLIANCE: COI Expiring for ${t.name}`, description: `Tenant COI expires on ${t.coi_expiration}. Request updated COI.`, status: 'To Do', tenant_id: t.id }));
      await supabase.from('tasks').insert(tasks);
      tasksCreated += tasks.length;
    }

    // 4. Vendor COIs expiring in 30 days
    const { data: vendorCois } = await supabase.from('vendors').select('id, company_name, coi_expiration').eq('coi_expiration', target30);
    if (vendorCois && vendorCois.length > 0) {
      const tasks = vendorCois.map(v => ({ title: `COMPLIANCE: Vendor COI Expiring (${v.company_name})`, description: `Vendor COI expires on ${v.coi_expiration}. Do not dispatch until updated.`, status: 'To Do' }));
      await supabase.from('tasks').insert(tasks);
      tasksCreated += tasks.length;
    }

    // 5. Overdue Rent & Late Fees
    const { data: overdueInvoices } = await supabase.from('tenant_invoices').select('*').eq('status', 'Unpaid').lt('due_date', todayStr);
    if (overdueInvoices && overdueInvoices.length > 0) {
      const overdueIds = overdueInvoices.map(i => i.id);
      await supabase.from('tenant_invoices').update({ status: 'Overdue' }).in('id', overdueIds);
      
      const lateFeeInvoices = overdueInvoices.map(inv => ({ tenant_id: inv.tenant_id, lease_id: inv.lease_id, amount: Number(inv.amount) * 0.05, description: `Late Fee (5%) for ${inv.description}`, due_date: todayStr, status: 'Unpaid' }));
      await supabase.from('tenant_invoices').insert(lateFeeInvoices);
    }

    // 6. Low Maintenance Inventory Alerts
    const { data: inventory } = await supabase.from('inventory').select('*, properties(name)');
    if (inventory && inventory.length > 0) {
      // Filter in JS to easily compare quantity vs reorder_level
      const lowItems = inventory.filter(item => item.quantity <= item.reorder_level);
      if (lowItems.length > 0) {
        const tasks = lowItems.map(item => ({ title: `RESTOCK: ${item.item_name}`, description: `Inventory low at ${item.properties?.name || 'Main Office'}. Only ${item.quantity} remaining (Reorder level: ${item.reorder_level}).`, status: 'To Do' }));
        await supabase.from('tasks').insert(tasks);
        tasksCreated += tasks.length;
      }
    }

    return NextResponse.json({ success: true, message: `Heartbeat ran successfully. Created ${tasksCreated} automated tasks and processed late fees.` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}