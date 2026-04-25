import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const state = searchParams.get('state'); // Grab the orgId

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `https://app.ophircre.com/api/google-callback`
    );

    const scopes =[
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/tasks'
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state || 'missing_org' // FIX: Ensure it is never blank
    });

    return NextResponse.json({ url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}