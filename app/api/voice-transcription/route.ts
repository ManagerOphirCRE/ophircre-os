import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co', 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy'
);

export async function POST(req: Request) {
  try {
    // Twilio sends the transcription data as URL-encoded form data
    const formData = await req.formData();
    const transcriptionText = formData.get('TranscriptionText') as string;
    const callerPhone = formData.get('From') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;

    // If there is no transcription yet, just return 200 OK to Twilio so it doesn't crash
    if (!transcriptionText) {
      return new NextResponse('OK', { status: 200 });
    }

    // 1. Try to find the tenant by their phone number
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, organization_id')
      .ilike('contact_phone', `%${callerPhone.replace('+1', '')}%`)
      .limit(1)
      .single();

    // 2. Create an Urgent Task on the Kanban Board
    await supabase.from('tasks').insert([{
      title: `🚨 VOICEMAIL EMERGENCY: ${tenant ? tenant.name : 'Unknown Caller'}`,
      description: `Caller Phone: ${callerPhone}\n\nTranscription:\n"${transcriptionText}"\n\nListen to Audio: ${recordingUrl}`,
      status: 'To Do',
      tenant_id: tenant ? tenant.id : null,
      organization_id: tenant ? tenant.organization_id : null
    }]);

    // 3. Send an SMS back to the caller confirming receipt
    if (process.env.TWILIO_ACCOUNT_SID) {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      await client.messages.create({
        body: `OphirCRE: We received your voicemail regarding "${transcriptionText.substring(0, 30)}...". Our maintenance team has been notified.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: callerPhone
      });
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error: any) {
    console.error("Voice Transcription Error:", error.message);
    return new NextResponse('Error', { status: 500 });
  }
}