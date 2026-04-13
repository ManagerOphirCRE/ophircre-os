import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { tenantId, message } = await req.json();
    if (!tenantId || !message) throw new Error("Missing data");

    // 1. Fetch tenant data so the AI knows who it is talking to
    const { data: tenant } = await supabase.from('tenants').select('*, leases(*), tenant_invoices(*)').eq('id', tenantId).single();
    if (!tenant) throw new Error("Tenant not found");

    const unpaidBalance = tenant.tenant_invoices?.filter((i: any) => i.status !== 'Paid').reduce((sum: number, i: any) => sum + Number(i.amount), 0) || 0;
    const leaseEnd = tenant.leases?.[0]?.end_date || 'Unknown';

    // 2. Prompt OpenAI with strict instructions
    const promptText = `
      You are a polite, professional AI Property Manager for OphirCRE.
      You are talking to a tenant named ${tenant.name}.
      Their current unpaid balance is $${unpaidBalance}. Their lease expires on ${leaseEnd}.
      
      If the tenant is reporting a maintenance issue, a leak, or something broken, reply EXACTLY with this string:
      "MAINTENANCE_TICKET_TRIGGERED: [Insert a 1-sentence summary of the issue]"
      
      Otherwise, answer their question politely based on the data provided. Do not invent information.
      
      Tenant says: "${message}"
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: promptText }], temperature: 0.1 })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const aiReply = data.choices[0].message.content;

    // 3. Intercept Maintenance Tickets and Auto-Create them!
    if (aiReply.includes("MAINTENANCE_TICKET_TRIGGERED:")) {
      const issueSummary = aiReply.split("MAINTENANCE_TICKET_TRIGGERED:")[1].trim();
      
      await supabase.from('tasks').insert([{
        title: `AI TICKET: ${tenant.name}`,
        description: `Tenant reported via AI Chatbot: ${issueSummary}\n\nOriginal Message: "${message}"`,
        tenant_id: tenant.id,
        status: 'New'
      }]);

      return NextResponse.json({ reply: "I have automatically submitted a maintenance ticket for this issue. Our property management team will be in touch shortly to resolve it!" });
    }

    return NextResponse.json({ reply: aiReply });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}