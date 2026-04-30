import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // Formatted as: orgId:::userEmail
    const errorParam = searchParams.get('error');

    if (errorParam) throw new Error(errorParam);
    if (!code || !state) throw new Error("Missing code or state");

    const [orgId, addedByUser] = state.split(':::');

    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, `https://app.ophircre.com/api/google-callback`);
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const userEmail = profile.data.emailAddress?.toLowerCase();

    if (userEmail) {
      const { data: existing } = await supabase.from('google_tokens').select('id, refresh_token').eq('user_email', userEmail).eq('added_by_user', addedByUser).limit(1).maybeSingle();
      
      const payload = {
        user_email: userEmail,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || existing?.refresh_token,
        expiry_date: tokens.expiry_date,
        organization_id: orgId !== 'null' ? orgId : null,
        added_by_user: addedByUser
      };

      if (existing) await supabase.from('google_tokens').update(payload).eq('id', existing.id);
      else await supabase.from('google_tokens').insert([payload]);
    }
    return NextResponse.redirect(`https://app.ophircre.com/workspace?connected=true`);
  } catch (error: any) {
    return NextResponse.redirect(`https://app.ophircre.com/workspace?error=${encodeURIComponent(error.message)}`);
  }
}