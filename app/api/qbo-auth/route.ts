import { NextResponse } from 'next/server';
import OAuthClient from 'intuit-oauth';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    // FIX: Added || '' to guarantee it is always a string
    const oauthClient = new OAuthClient({
      clientId: process.env.QBO_CLIENT_ID || '',
      clientSecret: process.env.QBO_CLIENT_SECRET || '',
      environment: 'sandbox', 
      redirectUri: 'https://app.ophircre.com/api/qbo-callback'
    });

    const authUri = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting],
      state: orgId || 'missing_org'
    });

    return NextResponse.redirect(authUri);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}