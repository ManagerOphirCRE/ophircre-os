import { NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);

export async function POST(req: Request) {
  try {
    const { to, subject, text } = await req.json();

    const msg = {
      to: to, 
      from: 'manager@ophircre.com', // MUST match your verified SendGrid email
      subject: subject,
      text: text,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
               <h2 style="color: #1e293b;">OphirCRE Management</h2>
               <p style="font-size: 16px; line-height: 1.5;">${text.replace(/\n/g, '<br>')}</p>
               <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;" />
               <p style="font-size: 12px; color: #999;">This is an automated message from OphirCRE Operating System.</p>
             </div>`,
    };

    await sgMail.send(msg);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}