import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// Use the Service Role key to save tokens in the background
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    
    if (!code) throw new Error("No code provided by Google");

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `https://app.ophircre.com/api/google-callback`
    );

    // Exchange the code Google gave us for actual access tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    // Get the user's email to associate with the token
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const userEmail = profile.data.emailAddress?.toLowerCase();

    if (userEmail) {
      // Save the tokens to our secure Supabase table
      await supabase.from('google_tokens').upsert({
        user_email: userEmail,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      });
    }

    // Redirect the user back to the Workspace page inside the app!
    return NextResponse.redirect(`https://app.ophircre.com/workspace?connected=true`);

  } catch (error: any) {
    console.error("Google Callback Error:", error.message);
    return NextResponse.redirect(`https://app.ophircre.com/workspace?error=${encodeURIComponent(error.message)}`);
  }
}