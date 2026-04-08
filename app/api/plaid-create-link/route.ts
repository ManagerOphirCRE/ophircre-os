import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox, // We use 'sandbox' for testing. Change to 'production' later!
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const client = new PlaidApi(configuration);

export async function POST() {
  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: 'ophircre-admin' },
      client_name: 'OphirCRE OS',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    return NextResponse.json(response.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}