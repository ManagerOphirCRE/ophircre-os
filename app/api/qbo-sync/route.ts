import { NextResponse } from 'next/server';
import OAuthClient from 'intuit-oauth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy');

export async function POST(req: Request) {
  try {
    const { orgId, description, amount, isRevenue } = await req.json();
    if (!orgId) throw new Error("Missing orgId");

    // 1. Get the QuickBooks Token for this specific SaaS customer
    const { data: token } = await supabase.from('qbo_tokens').select('*').eq('organization_id', orgId).single();
    if (!token) throw new Error("QuickBooks not connected for this organization.");

    // 2. Initialize the Intuit Client
    const oauthClient = new OAuthClient({
      clientId: process.env.QBO_CLIENT_ID || 'dummy',
      clientSecret: process.env.QBO_CLIENT_SECRET || 'dummy',
      environment: 'sandbox', // Change to 'production' when live
      redirectUri: 'https://app.ophircre.com/api/qbo-callback'
    });
    oauthClient.setToken(token);

    // 3. Format the payload for QuickBooks Online JournalEntry API
    const qboPayload = {
      "Line":[
        {
          "Id": "0",
          "Description": description || "OphirCRE Sync",
          "Amount": Math.abs(Number(amount)),
          "DetailType": "JournalEntryLineDetail",
          "JournalEntryLineDetail": {
            "PostingType": isRevenue ? "Credit" : "Debit",
            "AccountRef": { "value": "1" } // In production, this maps to the specific QBO Account ID
          }
        }
      ]
    };

    // 4. Push to QuickBooks
    const url = oauthClient.environment === 'sandbox' 
      ? `https://sandbox-quickbooks.api.intuit.com/v3/company/${token.realm_id}/journalentry`
      : `https://quickbooks.api.intuit.com/v3/company/${token.realm_id}/journalentry`;

    const response = await oauthClient.makeApiCall({
      url: url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(qboPayload)
    });

    return NextResponse.json({ success: true, qbo_response: response.getJson() });
  } catch (error: any) {
    console.error("QBO Sync Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}