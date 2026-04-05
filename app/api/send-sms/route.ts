import { NextResponse } from 'next/server';
import twilio from 'twilio';

// Initialize Twilio securely
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(req: Request) {
  try {
    const { to, body } = await req.json();

    // Send the text message
    const message = await client.messages.create({
      body: `OphirCRE Notice: ${body}`, // Adds a nice prefix so they know who it's from
      from: process.env.TWILIO_PHONE_NUMBER as string,
      to: to // The tenant's phone number
    });

    return NextResponse.json({ success: true, messageId: message.sid });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}