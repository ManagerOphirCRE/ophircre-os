import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Configure Web Push with your VAPID keys
webpush.setVapidDetails(
  'mailto:manager@ophircre.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function POST(req: Request) {
  try {
    const { title, body, url, orgId } = await req.json();
    if (!orgId) throw new Error("Missing orgId");

    // 1. Find all users in this organization
    const { data: users } = await supabase.from('user_roles').select('email').eq('organization_id', orgId);
    if (!users || users.length === 0) return NextResponse.json({ success: true, message: "No users found" });

    const emails = users.map(u => u.email);

    // 2. Find all active push subscriptions for those users
    const { data: subscriptions } = await supabase.from('push_subscriptions').select('subscription').in('user_email', emails);
    
    if (subscriptions && subscriptions.length > 0) {
      const payload = JSON.stringify({ title, body, url: url || '/' });
      
      // 3. Blast the notification to all devices
      const pushPromises = subscriptions.map(sub => 
        webpush.sendNotification(sub.subscription, payload).catch(e => console.error("Push failed:", e))
      );
      
      await Promise.all(pushPromises);
    }

    return NextResponse.json({ success: true, sent: subscriptions?.length || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}