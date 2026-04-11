import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { propertyId, prospectName, prospectEmail, prospectPhone, tourDate } = await req.json();

    // 1. Save the Tour to the database (Unassigned broker for now)
    const { error: tourError } = await supabase.from('tours').insert([{
      property_id: propertyId,
      prospect_name: `${prospectName} (${prospectPhone} | ${prospectEmail})`,
      tour_date: tourDate,
      status: 'Scheduled'
    }]);
    if (tourError) throw tourError;

    // 2. Drop an alert on the Admin Task Board
    await supabase.from('tasks').insert([{
      title: `NEW TOUR SCHEDULED: ${prospectName}`,
      description: `A prospect booked a tour for ${tourDate}.\nEmail: ${prospectEmail}\nPhone: ${prospectPhone}\n\nPlease go to the Broker CRM to assign a leasing agent.`,
      status: 'To Do'
    }]);

    // 3. Send a confirmation email to the prospect
    await fetch('https://app.ophircre.com/api/send-email', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: prospectEmail,
        subject: "Tour Confirmation - OphirCRE",
        text: `Hello ${prospectName},\n\nYour property tour has been successfully scheduled for ${new Date(tourDate).toLocaleString()}.\n\nOne of our leasing agents will reach out shortly to confirm the exact meeting details.\n\nThank you,\nOphirCRE Management`
      })
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}