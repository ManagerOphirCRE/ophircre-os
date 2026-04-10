import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    if (!email) throw new Error("Email required");

    // 1. Get the user's Google Token from the database
    const { data: tokenData } = await supabase.from('google_tokens').select('*').eq('user_email', email).single();
    if (!tokenData) return NextResponse.json({ connected: false });

    // 2. Authenticate with Google
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oauth2Client.setCredentials({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client });

    // 3. Fetch the last 10 UNREAD emails
    const gmailRes = await gmail.users.messages.list({ userId: 'me', q: 'is:unread', maxResults: 10 });
    const emails =[];
    if (gmailRes.data.messages) {
      for (const msg of gmailRes.data.messages) {
        const msgData = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
        const headers = msgData.data.payload?.headers;
        emails.push({
          id: msg.id,
          from: headers?.find(h => h.name === 'From')?.value || 'Unknown',
          subject: headers?.find(h => h.name === 'Subject')?.value || 'No Subject',
          snippet: msgData.data.snippet,
          date: headers?.find(h => h.name === 'Date')?.value || ''
        });
      }
    }

    // 4. Fetch Google Tasks
    const taskLists = await tasksApi.tasklists.list();
    const primaryListId = taskLists.data.items?.[0]?.id;
    let tasks: any[] =[];
    if (primaryListId) {
      const tasksRes = await tasksApi.tasks.list({ tasklist: primaryListId, showHidden: true });
      tasks = tasksRes.data.items?.map(t => ({ id: t.id, title: t.title, status: t.status })) ||[];
    }

    return NextResponse.json({ connected: true, emails, tasks, taskListId: primaryListId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}