import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We use the Service Role key because this API runs in the background (no user is logged in)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const from = formData.get('from') as string || '';
    const subject = formData.get('subject') as string || 'No Subject';
    const text = formData.get('text') as string || '';

    // Extract the raw email address
    const emailMatch = from.match(/<(.+)>/);
    const senderEmail = emailMatch ? emailMatch[1].toLowerCase().trim() : from.toLowerCase().trim();

    // Try to find a matching tenant in the database
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .ilike('contact_email', senderEmail)
      .limit(1)
      .single();

    // Create the Task on the Kanban Board
    const { error } = await supabase.from('tasks').insert([{
      title: `📧 EMAIL: ${subject}`,
      description: `From: ${from}\n\nMessage:\n${text}`,
      status: 'New',
      tenant_id: tenant ? tenant.id : null
    }]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Inbound Email Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}