import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { to_name, to_address, html_body } = await req.json();

    // Lob requires Address to be broken down, but for this API we will pass a raw string
    // In production, you would map address_line1, city, state, zip from your database.
    
    // We use the Lob API (Basic Auth with API Key as username)
    const lobApiKey = process.env.LOB_API_KEY;
    if (!lobApiKey) throw new Error("Lob API Key is missing from environment variables.");

    const authHeader = 'Basic ' + Buffer.from(lobApiKey + ':').toString('base64');

    const response = await fetch('https://api.lob.com/v1/letters', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        description: `Official Notice to ${to_name}`,
        to: {
          name: to_name,
          address_line1: to_address,
          address_city: "Anytown", // Placeholder: In Phase 6 we will split the address string
          address_state: "NY",
          address_zip: "10001"
        },
        from: {
          name: "OphirCRE Management",
          address_line1: "123 Main Office Blvd",
          address_city: "Miami",
          address_state: "FL",
          address_zip: "33101"
        },
        file: `<html><head><style>body{font-family: serif; padding: 40px;}</style></head><body>${html_body}</body></html>`,
        color: false,
        extra_service: "certified" // Sends it via USPS Certified Mail!
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json({ success: true, tracking_number: data.tracking_number });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}