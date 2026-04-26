import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { orgId, fromEmail, toEmail, subject, bodyHtml } = await req.json();
    if (!orgId || !fromEmail || !toEmail) throw new Error("Missing required fields");

    // 1. Get the token for the specific account they want to send FROM
    const { data: tokenData } = await supabase.from('google_tokens').select('*').eq('user_email', fromEmail).eq('organization_id', orgId).single();
    if (!tokenData) throw new Error("Could not find Google authentication for this email account.");

    // 2. Authenticate
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oauth2Client.setCredentials({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // 3. Construct a raw RFC 2822 Email Message
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
    const messageParts =[
      `From: ${fromEmail}`,
      `To: ${toEmail}`,
      `Subject: ${utf8Subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      '',
      bodyHtml
    ];
    const message = messageParts.join('\n');
    
    // Google requires base64url format
    const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // 4. Send it!
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}