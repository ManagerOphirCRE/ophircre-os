import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Helper to decode Google's Base64URL email bodies
function getEmailBody(payload: any): string {
  let encodedBody = '';
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html') encodedBody = part.body.data;
      else if (part.mimeType === 'text/plain' && !encodedBody) encodedBody = part.body.data;
      else if (part.parts) encodedBody = getEmailBody(part); 
    }
  } else {
    encodedBody = payload.body?.data || '';
  }
  if (!encodedBody) return '';
  return Buffer.from(encodedBody.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    if (!orgId || orgId === 'null') throw new Error("Org ID required");

    const { data: tokens } = await supabase.from('google_tokens').select('*').eq('organization_id', orgId);
    if (!tokens || tokens.length === 0) return NextResponse.json({ connected: false });

    let totalSynced = 0; const connectedAccounts: string[] =[]; const syncErrors: string[] =[];

    for (const tokenData of tokens) {
      connectedAccounts.push(tokenData.user_email);
      try {
        const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
        oauth2Client.setCredentials({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const gmailRes = await gmail.users.messages.list({ userId: 'me', maxResults: 30, q: 'is:unread' });
        
        if (gmailRes.data.messages) {
          for (const msg of gmailRes.data.messages) {
            const { data: existing } = await supabase.from('email_inbox').select('id').eq('message_id', msg.id).limit(1);
            if (existing && existing.length > 0) continue;

            const msgData = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
            const headers = msgData.data.payload?.headers;
            const fullBody = getEmailBody(msgData.data.payload);
            
            await supabase.from('email_inbox').insert([{
              organization_id: orgId, account_email: tokenData.user_email, message_id: msg.id,
              sender: headers?.find(h => h.name === 'From')?.value || 'Unknown',
              subject: headers?.find(h => h.name === 'Subject')?.value || 'No Subject',
              snippet: msgData.data.snippet, body_html: fullBody,
              date: headers?.find(h => h.name === 'Date')?.value || new Date().toISOString()
            }]);
            totalSynced++;
          }
        }
      } catch (err: any) { syncErrors.push(`Failed to sync ${tokenData.user_email}: ${err.message}`); }
    }
    return NextResponse.json({ connected: true, synced: totalSynced, accounts: connectedAccounts, errors: syncErrors });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}