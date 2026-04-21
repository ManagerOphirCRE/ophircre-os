import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy');

export async function POST(req: Request) {
  try {
    const { orgId, eventType, payload } = await req.json();
    if (!orgId || !eventType) throw new Error("Missing orgId or eventType");

    // 1. Find all Zapier/Custom Webhook URLs the user saved for this specific event
    const { data: hooks } = await supabase
      .from('outbound_webhooks')
      .select('target_url')
      .eq('organization_id', orgId)
      .eq('event_type', eventType);
    
    // 2. Fire the data to those external URLs
    if (hooks && hooks.length > 0) {
      for (const hook of hooks) {
        await fetch(hook.target_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload
          })
        }).catch(e => console.error(`Failed to deliver webhook to ${hook.target_url}:`, e));
      }
    }

    return NextResponse.json({ success: true, delivered: hooks?.length || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}