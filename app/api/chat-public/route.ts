import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    // Fetch active listings so the AI knows what is available
    const { data: listings } = await supabase.from('spaces').select('*, properties(name, address)').eq('is_listed', true);

    const prompt = `
      You are OphirCRE's AI Leasing Agent. 
      Available listings: ${JSON.stringify(listings)}. 
      Answer the prospect's questions politely. 
      If they want to apply or tour, ask for their Name, Email, and Phone number. 
      If they provide them, reply EXACTLY with this hidden trigger: "LEAD_CAPTURED: [Name] | [Email] | [Phone]"
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages:[{ role: 'system', content: prompt }, ...history, { role: 'user', content: message }], temperature: 0.2 })
    });

    const data = await response.json();
    const aiReply = data.choices[0].message.content;

    // Intercept the trigger and save the lead to the database!
    if (aiReply.includes("LEAD_CAPTURED:")) {
      const parts = aiReply.split("LEAD_CAPTURED:")[1].split("|").map((s: string) => s.trim());
      await supabase.from('tenants').insert([{ name: parts[0], contact_email: parts[1], contact_phone: parts[2], status: 'prospect_new', entity_type: 'AI Chatbot Lead' }]);
      return NextResponse.json({ reply: "Thank you! I have sent your information to our leasing team. They will contact you shortly to schedule a tour or send an application." });
    }

    return NextResponse.json({ reply: aiReply });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}