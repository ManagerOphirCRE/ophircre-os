import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (typeof global.DOMMatrix === 'undefined') { (global as any).DOMMatrix = class {}; }
    if (typeof global.ImageData === 'undefined') { (global as any).ImageData = class {}; }
    
    // FIX: Added ': any' to bypass TypeScript's strict module checking
    const pdfModule: any = await import('pdf-parse');
    const parsePdf = pdfModule.default || pdfModule;

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file uploaded");

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await parsePdf(buffer);
    const text = pdfData.text;

    const prompt = `
      You are an expert Commercial Real Estate attorney and lease abstractor. 
      Read the following lease text and extract the key data points. 
      Return ONLY a valid JSON object with these exact keys. If you cannot find a value, leave it as an empty string.
      {
        "tenant_name": "Legal name of the tenant",
        "start_date": "YYYY-MM-DD",
        "end_date": "YYYY-MM-DD",
        "base_rent": "Numeric value only (e.g. 5000)",
        "cam_provisions": "A brief 1-sentence summary of the CAM/NNN obligations"
      }
      
      LEASE TEXT TO SCAN:
      ${text}
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.1, response_format: { type: "json_object" } })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json(JSON.parse(data.choices[0].message.content));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}