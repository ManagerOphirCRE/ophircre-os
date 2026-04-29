import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// FIX: A robust, recursive extractor that prevents double-decoding on nested email threads
function extractBase64Data(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/html' && payload.body?.data) return payload.body.data;
  if (payload.mimeType === 'text/plain' && payload.body?.data) return payload.body.data;
  
  if (payload.parts && payload.parts.length > 0) {
    let textData = '';
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) return part.body.data;
      if (part.mimeType === 'text/plain' && part.body?.data) textData = part.body.data;
      if (part.parts) {
        const nested = extractBase64Data(part);
        if (nested) return nested;
      }
    }
    if (textData) return textData;
  }
  return payload.body?.data || '';
}

function getEmailBody(payload: any): string {
  const base64Data = extractBase64Data(payload);
  if (!base64Data) return '';
  // Decode the Base64URL string exactly ONE time
  return Buffer.from(base64Data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
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

        const gmailRes = await gmail.users.messages.list({ userId: 'me', maxResults: 50 });
        
        if (gmailRes.data.messages) {
          for (const msg of gmailRes.data.messages) {
            const { data: existing } = await supabase.from('email_inbox').select('id').eq('message_id', msg.id).maybeSingle();
            if (existing) continue;

            const msgData = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
            const headers = msgData.data.payload?.headers;
            const fullBody = getEmailBody(msgData.data.payload);
            
            const internalDate = msgData.data.internalDate;
            const strictIsoDate = internalDate ? new Date(Number(internalDate)).toISOString() : new Date().toISOString();
            
            await supabase.from('email_inbox').insert([{
              organization_id: orgId, account_email: tokenData.user_email, message_id: msg.id,
              sender: headers?.find(h => h.name === 'From')?.value || 'Unknown',
              subject: headers?.find(h => h.name === 'Subject')?.value || 'No Subject',
              snippet: msgData.data.snippet, body_html: fullBody,
              date: strictIsoDate
            }]);
            totalSynced++;
          }
        }
      } catch (err: any) { syncErrors.push(`Failed to sync ${tokenData.user_email}: ${err.message}`); }
    }
    return NextResponse.json({ connected: true, synced: totalSynced, accounts: connectedAccounts, errors: syncErrors });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}