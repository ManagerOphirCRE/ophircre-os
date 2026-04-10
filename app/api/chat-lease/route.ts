import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { leaseId, question } = await req.json();
    if (!leaseId || !question) throw new Error("Missing lease ID or question.");

    // 1. Fetch the executed lease text from the database
    const { data: lease } = await supabase.from('leases').select('document_html').eq('id', leaseId).single();
    if (!lease || !lease.document_html) throw new Error("No executed lease document found for this tenant.");

    // Strip HTML tags to save tokens and make it easier for the AI to read
    const cleanText = lease.document_html.replace(/<[^>]*>?/gm, '');

    // 2. Ask OpenAI
    const prompt = `
      You are an expert Commercial Real Estate Attorney representing the Landlord.
      Read the following lease agreement and answer the landlord's question accurately based ONLY on the text provided.
      If the lease does not explicitly state the answer, reply: "The lease does not explicitly state this."
      Keep your answer concise, professional, and cite the section number if possible.
      
      LEASE TEXT:
      ${cleanText.substring(0, 25000)}
      
      LANDLORD'S QUESTION: ${question}
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages:[{ role: 'user', content: prompt }], temperature: 0.1 })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json({ answer: data.choices[0].message.content });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}