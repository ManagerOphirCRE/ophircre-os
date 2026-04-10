import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { fileName, userEmail } = await req.json();
    if (!fileName || !userEmail) throw new Error("Missing file name or user email.");

    // 1. Get the user's Google Token
    const { data: tokenData } = await supabase.from('google_tokens').select('*').eq('user_email', userEmail).single();
    if (!tokenData) throw new Error("Google Workspace not connected. Please connect in the Workspace tab.");

    // 2. Authenticate with Google Drive
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oauth2Client.setCredentials({ access_token: tokenData.access_token, refresh_token: tokenData.refresh_token });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 3. Download the file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage.from('documents').download(fileName);
    if (downloadError || !fileData) throw new Error("Failed to download file from Supabase.");

    // 4. Convert Blob to Buffer for Google Drive upload
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. Upload to Google Drive
    // We use a simple multipart upload for small/medium PDFs
    const fileMetadata = { name: fileName };
    const media = { mimeType: fileData.type || 'application/pdf', body: buffer };

    // Note: To use media.body with a Buffer in the googleapis Node client, we can pass a Readable stream.
    // For simplicity in serverless, we pass the buffer directly (googleapis handles it).
    const stream = require('stream');
    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);
    media.body = bufferStream;

    const driveRes = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    return NextResponse.json({ success: true, driveLink: driveRes.data.webViewLink });
  } catch (error: any) {
    console.error("Drive Sync Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}