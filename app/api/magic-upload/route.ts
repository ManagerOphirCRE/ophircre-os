import { NextResponse } from 'next/server';
import * as xlsx from 'xlsx';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (typeof global.DOMMatrix === 'undefined') { (global as any).DOMMatrix = class {}; }
    if (typeof global.ImageData === 'undefined') { (global as any).ImageData = class {}; }
    const pdfModule: any = await import('pdf-extraction');
    const parsePdf = pdfModule.default || pdfModule;

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file uploaded");

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    
    let messagesContent: any[] =[];
    let extractedText = '';

    // 1. Parse based on file type
    if (fileType.startsWith('image/')) {
      const base64Image = buffer.toString('base64');
      messagesContent.push({ type: "image_url", image_url: { url: `data:${fileType};base64,${base64Image}` } });
    } else if (fileName.endsWith('.pdf')) {
      const pdfData = await parsePdf(buffer);
      extractedText = pdfData.text;
    } else if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      extractedText = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
    } else {
      extractedText = buffer.toString('utf-8'); // Fallback for plain text
    }

    if (extractedText) {
      messagesContent.push({ type: "text", text: `DOCUMENT TEXT:\n${extractedText.substring(0, 30000)}` });
    }

    // 2. The Universal AI Prompt
    const promptText = `
      You are an expert Commercial Real Estate AI Assistant. 
      Analyze the provided document/image. 
      
      Step 1: Classify the document into ONE of these categories: 'INVOICE', 'LEASE', 'TENANT_INFO', 'PROPERTY_INFO', or 'UNKNOWN'.
      Step 2: Extract the relevant data based on the category.
      
      Return ONLY a valid JSON object in this exact format:
      {
        "category": "INVOICE | LEASE | TENANT_INFO | PROPERTY_INFO | UNKNOWN",
        "data": {
          // If INVOICE: "payee", "date", "amount", "description"
          // If LEASE: "tenant_name", "start_date", "end_date", "rent_amount"
          // If TENANT_INFO: "name", "email", "phone", "entity_type"
          // If PROPERTY_INFO: "name", "address", "sqft"
        }
      }
    `;

    messagesContent.unshift({ type: "text", text: promptText });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages:[{ role: 'user', content: messagesContent }], temperature: 0.1, response_format: { type: "json_object" } })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const result = JSON.parse(data.choices[0].message.content);
    return NextResponse.json({ success: true, fileName: file.name, ...result });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}