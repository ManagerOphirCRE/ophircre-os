import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST(req: Request) {
  try {
    // FIX: Moved inside the function with a fallback
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID || 'ACdummy', 
      process.env.TWILIO_AUTH_TOKEN || 'dummy'
    );
    
    const { to, body } = await req.json();

    const message = await client.messages.create({
      body: `OphirCRE Notice: ${body}`,
      from: process.env.TWILIO_PHONE_NUMBER || '+15555555555',
      to: to
    });

    return NextResponse.json({ success: true, messageId: message.sid });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}