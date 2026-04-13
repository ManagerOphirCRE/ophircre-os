import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    if (!orgId || orgId === 'null') throw new Error("Org ID required");

    // Fetch ALL connected Google accounts for this organization
    const { data: tokens } = await supabase.from('google_tokens').select('*').eq('organization_id', orgId);
    if (!tokens || tokens.length === 0) return NextResponse.json({ connected: false });

    let totalSynced = 0;

    for (const tokenData of tokens) {
      const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
      oauth2Client.setCredentials({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token });
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Fetch the last 15 emails
      const gmailRes = await gmail.users.messages.list({ userId: 'me', maxResults: 15 });
      
      if (gmailRes.data.messages) {
        for (const msg of gmailRes.data.messages) {
          const { data: existing } = await supabase.from('email_inbox').select('id').eq('message_id', msg.id).single();
          if (existing) continue;

          const msgData = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
          const headers = msgData.data.payload?.headers;
          
          // Save to database WITH the organization_id
          await supabase.from('email_inbox').insert([{
            organization_id: orgId,
            account_email: tokenData.user_email,
            message_id: msg.id,
            sender: headers?.find(h => h.name === 'From')?.value || 'Unknown',
            subject: headers?.find(h => h.name === 'Subject')?.value || 'No Subject',
            snippet: msgData.data.snippet,
            date: headers?.find(h => h.name === 'Date')?.value || new Date().toISOString()
          }]);
          totalSynced++;
        }
      }
    }

    return NextResponse.json({ connected: true, synced: totalSynced });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}