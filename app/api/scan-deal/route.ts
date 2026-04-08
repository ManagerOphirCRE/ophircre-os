import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    if (typeof global.DOMMatrix === 'undefined') { global.DOMMatrix = class {} as any; }
    if (typeof global.ImageData === 'undefined') { global.ImageData = class {} as any; }
    const pdf = require('pdf-parse'); 

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file uploaded");

    const buffer = Buffer.from(await file.arrayBuffer());
    const isImage = file.type.startsWith('image/');

    let messagesContent: any[] =[];
    const promptText = `
      You are an expert Commercial Real Estate Acquisitions Analyst. 
      Read this broker Offering Memorandum (OM) or pro-forma and extract the key investment metrics. 
      Return ONLY a valid JSON object with these exact keys. If a value is missing, return 0 (for numbers) or an empty string.
      {
        "property_name": "Name or address of the property",
        "asking_price": numeric value only (e.g. 5000000),
        "noi": numeric value only for Net Operating Income (e.g. 350000),
        "cap_rate": numeric value only representing the percentage (e.g. 7.0),
        "price_per_sqft": numeric value only,
        "notes": "A brief 1-sentence summary of the asset class and location"
      }
    `;

    if (isImage) {
      const base64Image = buffer.toString('base64');
      messagesContent =[
        { type: "text", text: promptText },
        { type: "image_url", image_url: { url: `data:${file.type};base64,${base64Image}` } }
      ];
    } else {
      const pdfData = await pdf(buffer);
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