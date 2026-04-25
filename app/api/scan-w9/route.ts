import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (typeof global.DOMMatrix === 'undefined') { (global as any).DOMMatrix = class {}; }
    if (typeof global.ImageData === 'undefined') { (global as any).ImageData = class {}; }
    const pdfModule: any = await import('pdf-extraction');
    const parsePdf = typeof pdfModule === 'function' ? pdfModule : pdfModule.default || pdfModule;

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file uploaded");

    const buffer = Buffer.from(await file.arrayBuffer());
    const isImage = file.type.startsWith('image/');
    
    let messagesContent: any[] =[];
    const promptText = `
      You are an expert IRS Tax Accountant. Read this W-9 form.
      Extract the Legal Name, Address, and Taxpayer Identification Number (TIN/EIN/SSN).
      Return ONLY a valid JSON object with these exact keys:
      {
        "legal_name": "Name shown on Line 1",
        "address": "Full address from Lines 5 and 6",
        "tax_id": "The 9-digit SSN or EIN (format as XX-XXXXXXX or XXX-XX-XXXX)"
      }
    `;

    if (isImage) {
      const base64Image = buffer.toString('base64');
      messagesContent =[{ type: "text", text: promptText }, { type: "image_url", image_url: { url: `data:${file.type};base64,${base64Image}` } }];
    } else {
      const pdfData = await parsePdf(buffer);
      messagesContent =[{ type: "text", text: promptText + `\n\nDOCUMENT TEXT:\n${pdfData.text}` }];
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages:[{ role: 'user', content: messagesContent }], temperature: 0.1, response_format: { type: "json_object" } })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json(JSON.parse(data.choices[0].message.content));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}