import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox, // Change to 'production' when you go live!
  baseOptions: { headers: { 'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID, 'PLAID-SECRET': process.env.PLAID_SECRET } },
});
const client = new PlaidApi(configuration);

export async function POST() {
  try {
    // 1. Get all connected banks from your vault
    const { data: connections } = await supabase.from('plaid_connections').select('*');
    if (!connections || connections.length === 0) throw new Error("No banks connected yet.");

    // 2. Get default accounts for auto-categorization
    const { data: accs } = await supabase.from('chart_of_accounts').select('*');
    const defaultExp = accs?.find(a => a.account_type === 'Expense')?.id;
    const defaultRev = accs?.find(a => a.account_type === 'Revenue')?.id;

    let totalSynced = 0;

    // 3. Loop through each bank and pull transactions
    for (const conn of connections) {
      const response = await client.transactionsSync({ access_token: conn.access_token });
      const transactions = response.data.added;

      for (const t of transactions) {
        // Prevent duplicates by checking if this exact transaction already exists
        const { data: existing } = await supabase.from('transactions')
          .select('id').eq('description', t.name).eq('date', t.date).single();
        
        if (existing) continue;

        // Insert the main transaction
        const { data: txnData } = await supabase.from('transactions').insert([{
          date: t.date, description: t.name, total_amount: Math.abs(t.amount), status: 'Approved'
        }]).select().single();

        if (txnData) {
          // Insert the Journal Entry (Plaid amounts: positive = expense, negative = revenue)
          await supabase.from('journal_entries').insert([{
            transaction_id: txnData.id,
            account_id: t.amount > 0 ? defaultExp : defaultRev, 
            description: `Plaid Auto-Sync: ${conn.institution_name}`,
            debit: t.amount > 0 ? t.amount : 0,
            credit: t.amount < 0 ? Math.abs(t.amount) : 0
          }]);
          totalSynced++;
        }
      }
    }

    return NextResponse.json({ success: true, synced: totalSynced });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}