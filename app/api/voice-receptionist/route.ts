import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // TwiML is the XML language Twilio uses to control phone calls
    const twiml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Polly.Matthew-Neural">
          Hello. You have reached the Ophir C R E automated maintenance line. 
          Please state your name, your property, and your maintenance emergency after the beep. 
          Press the pound key when you are finished.
        </Say>
        <Record 
          action="https://app.ophircre.com/api/voice-transcription" 
          method="POST" 
          maxLength="60" 
          finishOnKey="#" 
          transcribe="true" 
          transcribeCallback="https://app.ophircre.com/api/voice-transcription" 
        />
        <Say voice="Polly.Matthew-Neural">We did not receive any input. Goodbye.</Say>
      </Response>
    `;

    // Twilio requires the response to be formatted as XML, not JSON!
    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error: any) {
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>System error.</Say></Response>`, { 
      status: 500, 
      headers: { 'Content-Type': 'text/xml' } 
    });
  }
}