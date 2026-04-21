import { NextResponse } from 'next/server';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get('state');
    const realmId = url.searchParams.get('realmId');

    // FIX: Added || '' to guarantee it is always a string
    const oauthClient = new OAuthClient({
      clientId: process.env.QBO_CLIENT_ID || '',
      clientSecret: process.env.QBO_CLIENT_SECRET || '',
      environment: 'sandbox',
      redirectUri: 'https://app.ophircre.com/api/qbo-callback'
    });

    const authResponse = await oauthClient.createToken(req.url);
    const tokens = authResponse.getJson();

    if (orgId && orgId !== 'missing_org' && realmId) {
      await supabase.from('qbo_tokens').upsert({
        organization_id: orgId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        realm_id: realmId
      });
    }

    return NextResponse.redirect(`https://app.ophircre.com/settings?qbo=success`);
  } catch (error: any) {
    return NextResponse.redirect(`https://app.ophircre.com/settings?qbo=error`);
  }
}