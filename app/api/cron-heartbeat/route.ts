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

    const in180Days = new Date(); in180Days.setDate(today.getDate() + 180);
    const target180 = in180Days.toISOString().split('T')[0];

    let tasksCreated = 0;

    // 1. Leases expiring in 60 days
    const { data: leases } = await supabase.from('leases').select('*, tenants(name)').eq('end_date', target60);
    if (leases && leases.length > 0) {
      const tasks = leases.map(l => ({ title: `URGENT: Lease expiring for ${l.tenants?.name}`, description: `Lease expires on ${l.end_date}. Begin renewal negotiations.`, status: 'To Do', tenant_id: l.tenant_id, organization_id: l.organization_id }));
      await supabase.from('tasks').insert(tasks);
      tasksCreated += tasks.length;
    }

    // 2. Rent Escalations in 30 days (Reminder Only)
    const { data: escalations } = await supabase.from('leases').select('*, tenants(name)').eq('next_escalation_date', target30);
    if (escalations && escalations.length > 0) {
      const tasks = escalations.map(l => ({ title: `ACTION REQUIRED: Rent Escalation for ${l.tenants?.name}`, description: `Rent is scheduled to escalate on ${l.next_escalation_date}. Go to their Tenant Profile to review the math and click 'Execute Escalation'.`, status: 'To Do', tenant_id: l.tenant_id, organization_id: l.organization_id }));
      await supabase.from('tasks').insert(tasks);
      tasksCreated += tasks.length;
    }

    // 3. Tenant COIs expiring in 30 days
    const { data: tenantCois } = await supabase.from('tenants').select('id, name, coi_expiration, organization_id').eq('coi_expiration', target30);
    if (tenantCois && tenantCois.length > 0) {
      const tasks = tenantCois.map(t => ({ title: `COMPLIANCE: COI Expiring for ${t.name}`, description: `Tenant COI expires on ${t.coi_expiration}. Request updated COI.`, status: 'To Do', tenant_id: t.id, organization_id: t.organization_id }));
      await supabase.from('tasks').insert(tasks);
      tasksCreated += tasks.length;
    }

    // 4. Vendor COIs expiring in 30 days
    const { data: vendorCois } = await supabase.from('vendors').select('id, company_name, coi_expiration, organization_id').eq('coi_expiration', target30);
    if (vendorCois && vendorCois.length > 0) {
      const tasks = vendorCois.map(v => ({ title: `COMPLIANCE: Vendor COI Expiring (${v.company_name})`, description: `Vendor COI expires on ${v.coi_expiration}. Do not dispatch until updated.`, status: 'To Do', organization_id: v.organization_id }));
      await supabase.from('tasks').insert(tasks);
      tasksCreated += tasks.length;
    }

    // 5. Advanced Overdue Rent & Custom Late Fees
    const { data: unpaidInvoices } = await supabase.from('tenant_invoices').select('*, leases(grace_period_days, late_fee_type, late_fee_amount)').eq('status', 'Unpaid');
    if (unpaidInvoices && unpaidInvoices.length > 0) {
      const lateFeeInvoices = []; const overdueIds =[];
      for (const inv of unpaidInvoices) {
        const dueDate = new Date(inv.due_date);
        const graceDays = Number(inv.leases?.grace_period_days || 5);
        const penaltyDate = new Date(dueDate); penaltyDate.setDate(penaltyDate.getDate() + graceDays);
        if (todayStr === penaltyDate.toISOString().split('T')[0]) {
          overdueIds.push(inv.id);
          let feeAmount = 0;
          const feeType = inv.leases?.late_fee_type || 'percentage';
          const feeValue = Number(inv.leases?.late_fee_amount || 5.0);
          if (feeType === 'percentage') feeAmount = Number(inv.amount) * (feeValue / 100);
          else if (feeType === 'fixed') feeAmount = feeValue;
          else if (feeType === 'daily') feeAmount = feeValue;
          lateFeeInvoices.push({ tenant_id: inv.tenant_id, lease_id: inv.lease_id, amount: feeAmount, description: `Late Fee for ${inv.description}`, due_date: todayStr, status: 'Unpaid', organization_id: inv.organization_id });
        }
      }
      if (overdueIds.length > 0) {
        await supabase.from('tenant_invoices').update({ status: 'Overdue' }).in('id', overdueIds);
        await supabase.from('tenant_invoices').insert(lateFeeInvoices);
      }
    }

    // 6. Low Maintenance Inventory Alerts
    const { data: inventory } = await supabase.from('inventory').select('*, properties(name)');
    if (inventory && inventory.length > 0) {
      const lowItems = inventory.filter(item => item.quantity <= item.reorder_level);
      if (lowItems.length > 0) {
        const tasks = lowItems.map(item => ({ title: `RESTOCK: ${item.item_name}`, description: `Inventory low at ${item.properties?.name || 'Main Office'}. Only ${item.quantity} remaining (Reorder level: ${item.reorder_level}).`, status: 'To Do', organization_id: item.organization_id }));
        await supabase.from('tasks').insert(tasks);
        tasksCreated += tasks.length;
      }
    }

    // 7. Preventative Maintenance Engine
    const { data: pmSchedules } = await supabase.from('preventative_maintenance').select('*').lte('next_due_date', todayStr);
    if (pmSchedules && pmSchedules.length > 0) {
      const pmTasks =[];
      for (const pm of pmSchedules) {
        pmTasks.push({ title: `PREVENTATIVE: ${pm.title}`, description: pm.description || 'Routine maintenance required.', property_id: pm.property_id, status: 'To Do', organization_id: pm.organization_id });
        const nextDate = new Date(pm.next_due_date);
        nextDate.setMonth(nextDate.getMonth() + pm.frequency_months);
        await supabase.from('preventative_maintenance').update({ next_due_date: nextDate.toISOString().split('T')[0] }).eq('id', pm.id);
      }
      await supabase.from('tasks').insert(pmTasks);
      tasksCreated += pmTasks.length;
    }

    // 8. Check for Critical Lease Dates (180 Days Out)
    const { data: criticalLeases } = await supabase.from('leases').select('*, tenants(name)').or(`rofr_date.eq.${target180},expansion_option_date.eq.${target180},termination_option_date.eq.${target180}`);
    if (criticalLeases && criticalLeases.length > 0) {
      const criticalTasks = criticalLeases.map(l => {
        let desc = `Critical option date approaching for ${l.tenants?.name} in 180 days. `;
        if (l.rofr_date === target180) desc += "Right of First Refusal (ROFR) window opens. ";
        if (l.expansion_option_date === target180) desc += "Expansion Option window opens. ";
        if (l.termination_option_date === target180) desc += "Early Termination Option window opens. ";
        return { title: `CRITICAL DATE: ${l.tenants?.name} Options`, description: desc, status: 'To Do', tenant_id: l.tenant_id, organization_id: l.organization_id };
      });
      await supabase.from('tasks').insert(criticalTasks);
      tasksCreated += criticalTasks.length;
    }

    return NextResponse.json({ success: true, message: `Heartbeat ran successfully. Created ${tasksCreated} automated tasks and processed late fees.` });
  } catch (error: any) {
    // 9. AI Dynamic Pricing Engine (YieldStar Clone)
    const { data: activeListings } = await supabase.from('spaces').select('*, properties(id)').eq('is_listed', true);
    
    if (activeListings && activeListings.length > 0) {
      // Calculate global portfolio occupancy
      const { data: allSpaces } = await supabase.from('spaces').select('id');
      const { data: allLeases } = await supabase.from('leases').select('id').eq('status', 'Active');
      const occupancyRate = (allSpaces && allLeases && allSpaces.length > 0) ? (allLeases.length / allSpaces.length) * 100 : 0;

      for (const space of activeListings) {
        let newPrice = Number(space.listing_price || 0);
        const daysOnMarket = Number(space.days_on_market || 0) + 1; // Increment days on market

        // Algorithm Rules:
        if (occupancyRate > 90 && daysOnMarket < 15) {
          // High demand, fresh listing -> Bump price by 2%
          newPrice = newPrice * 1.02;
        } else if (daysOnMarket > 30) {
          // Stale listing -> Drop price by 3% to drive velocity
          newPrice = newPrice * 0.97;
        }

        // Update the database
        await supabase.from('spaces').update({ 
          listing_price: Math.round(newPrice), 
          days_on_market: daysOnMarket 
        }).eq('id', space.id);
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}