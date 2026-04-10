import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { tenantEmail, tenantName, documentHtml, subject } = await req.json();

    const apiKey = process.env.DROPBOX_SIGN_API_KEY;
    if (!apiKey) throw new Error("Dropbox Sign API Key missing from Vercel.");

    // Dropbox Sign requires Basic Auth with the API key as the username
    const authHeader = 'Basic ' + Buffer.from(apiKey + ':').toString('base64');

    // We use FormData to send the HTML file to Dropbox Sign
    const formData = new FormData();
    formData.append('title', subject);
    formData.append('subject', subject);
    formData.append('message', 'Please review and sign your lease agreement.');
    formData.append('signers[0][email_address]', tenantEmail);
    formData.append('signers[0][name]', tenantName);
    formData.append('signers[0][role]', 'Tenant');
    formData.append('test_mode', '1'); // Set to 1 so you don't get charged while testing!

    // Convert HTML to a File Blob
    const htmlContent = `<html><body style="font-family:serif; padding:40px;">${documentHtml}</body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    formData.append('file[0]', blob, 'Lease_Agreement.html');

    const response = await fetch('https://api.hellosign.com/v3/signature_request/send', {
      method: 'POST',
      headers: { 'Authorization': authHeader },
      body: formData
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.error_msg);

    return NextResponse.json({ success: true, signature_request_id: data.signature_request.signature_request_id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}