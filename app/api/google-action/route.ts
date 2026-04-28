import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { orgId, emailAccount, messageId, action } = await req.json();
    if (!orgId || !emailAccount || !messageId || !action) throw new Error("Missing required fields");

    // 1. Get the token for this specific email account
    const { data: tokenData } = await supabase.from('google_tokens').select('*').eq('user_email', emailAccount).eq('organization_id', orgId).single();
    if (!tokenData) throw new Error("Google authentication not found for this account.");

    // 2. Authenticate with Google
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oauth2Client.setCredentials({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 3. Execute the 2-Way Sync Action
    if (action === 'mark_read') {
      // Removes the UNREAD label in Gmail
      await gmail.users.messages.modify({ userId: 'me', id: messageId, requestBody: { removeLabelIds: ['UNREAD'] } });
    } 
    else if (action === 'archive') {
      // Removes from Inbox in Gmail, and deletes from our local database view
      await gmail.users.messages.modify({ userId: 'me', id: messageId, requestBody: { removeLabelIds: ['INBOX'] } });
      await supabase.from('email_inbox').delete().eq('message_id', messageId);
    } 
    else if (action === 'trash') {
      // Moves to Trash in Gmail, and deletes from our local database view
      await gmail.users.messages.trash({ userId: 'me', id: messageId });
      await supabase.from('email_inbox').delete().eq('message_id', messageId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Google Action Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}