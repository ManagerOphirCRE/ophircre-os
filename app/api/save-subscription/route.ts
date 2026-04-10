import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { subscription, email } = await req.json();
    if (!subscription || !email) throw new Error("Missing data");

    // Delete any old subscriptions for this user on this device to prevent duplicates
    await supabase.from('push_subscriptions').delete().eq('user_email', email);

    // Save the new subscription
    await supabase.from('push_subscriptions').insert([{
      user_email: email,
      subscription: subscription
    }]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}