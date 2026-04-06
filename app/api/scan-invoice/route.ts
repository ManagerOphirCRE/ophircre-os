import { NextResponse } from 'next/server';
import pdf from 'pdf-parse';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file uploaded");

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfData = await pdf(buffer);
    const text = pdfData.text;

    const prompt = `
      You are an expert Commercial Real Estate accountant. 
      Read the following invoice or mortgage statement and extract the key financial data. 
      Return ONLY a valid JSON object with these exact keys. If a value is not found, leave it as an empty string (or 0 for numbers).
      {
        "payee_name": "Name of the vendor, lender, or billing company",
        "date": "YYYY-MM-DD (The statement date or due date)",
        "total_amount": numeric value only,
        "is_mortgage": boolean (true ONLY if this is a mortgage/loan statement),
        "principal_amount": numeric value (if mortgage),
        "interest_amount": numeric value (if mortgage),
        "escrow_amount": numeric value (if mortgage),
        "description": "Brief 3-5 word summary of the bill (e.g., Monthly Landscaping, Mortgage Payment)"
      }
      
      DOCUMENT TEXT TO SCAN:
      ${text}
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages:[{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) return NextResponse.json({ error: data.error.message }, { status: 500 });

    const extractedData = JSON.parse(data.choices[0].message.content);
    return NextResponse.json(extractedData);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}