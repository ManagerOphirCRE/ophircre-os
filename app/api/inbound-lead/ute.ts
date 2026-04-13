import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    // 1. Verify the API Key
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) throw new Error("Missing or invalid Authorization header");
    
    const apiKey = authHeader.split(' ')[1];
    const { data: keyData } = await supabase.from('api_keys').select('organization_id').eq('api_key', apiKey).single();
    if (!keyData) throw new Error("Invalid API Key");

    // 2. Parse the incoming lead data (from Zapier, Facebook, Zillow, etc.)
    const { name, email, phone, source, notes } = await req.json();
    if (!name || !email) throw new Error("Name and email are required");

    // 3. Insert the Prospect into the database
    const { data: tenantData, error: tErr } = await supabase.from('tenants').insert([{
      name: name,
      contact_email: email,
      contact_phone: phone || '',
      entity_type: `Lead Source: ${source || 'API'}`,
      status: 'prospect_new',
      organization_id: keyData.organization_id // Securely attach to the correct SaaS account
    }]).select().single();

    if (tErr) throw tErr;

    // 4. Drop a Task on the Kanban Board
    await supabase.from('tasks').insert([{
      title: `NEW LEAD: ${name} (${source || 'API'})`,
      description: `A new prospect was automatically imported via API.\nEmail: ${email}\nPhone: ${phone}\nNotes: ${notes || 'None'}`,
      status: 'To Do',
      tenant_id: tenantData.id,
      organization_id: keyData.organization_id
    }]);

    return NextResponse.json({ success: true, message: "Lead successfully imported to Leasing Pipeline." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}