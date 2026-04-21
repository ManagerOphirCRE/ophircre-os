import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const client = new PlaidApi(new Configuration({ basePath: PlaidEnvironments.sandbox, baseOptions: { headers: { 'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID, 'PLAID-SECRET': process.env.PLAID_SECRET } } }));

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Check if you have Plaid Webhooks enabled in Settings (to save API costs)
    const { data: settings } = await supabase.from('system_settings').select('enable_plaid_webhooks').eq('id', 1).single();
    if (!settings?.enable_plaid_webhooks) return NextResponse.json({ message: "Plaid webhooks are disabled by Admin." });

    // 2. Process the Webhook
    if (body.webhook_type === 'TRANSACTIONS' && body.webhook_code === 'SYNC_UPDATES_AVAILABLE') {
      const itemId = body.item_id;
      const { data: conn } = await supabase.from('plaid_connections').select('*').eq('item_id', itemId).single();
      if (!conn) throw new Error("Connection not found");

      const response = await client.transactionsSync({ access_token: conn.access_token });
      const { data: accs } = await supabase.from('chart_of_accounts').select('*');
      const defaultExp = accs?.find(a => a.account_type === 'Expense')?.id;
      const defaultRev = accs?.find(a => a.account_type === 'Revenue')?.id;

      for (const t of response.data.added) {
        const { data: existing } = await supabase.from('transactions').select('id').eq('description', t.name).eq('date', t.date).single();
        if (existing) continue;

        const { data: txnData } = await supabase.from('transactions').insert([{ date: t.date, description: t.name, total_amount: Math.abs(t.amount), status: 'Approved' }]).select().single();
        if (txnData) {
          await supabase.from('journal_entries').insert([{ transaction_id: txnData.id, account_id: t.amount > 0 ? defaultExp : defaultRev, description: `Plaid Webhook: ${conn.institution_name}`, debit: t.amount > 0 ? t.amount : 0, credit: t.amount < 0 ? Math.abs(t.amount) : 0 }]);
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}