import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', { apiVersion: '2023-10-16' as any });

export async function POST(req: Request) {
  try {
    const { amount, tenantId, stripeAccountId } = await req.json();
    if (!amount || amount <= 0) throw new Error("Invalid refund amount.");
    if (!stripeAccountId) throw new Error("Tenant has not connected a bank account for payouts.");

    // Trigger the ACH Payout via Stripe Connect
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      destination: stripeAccountId,
      description: 'Security Deposit Refund - OphirCRE'
    });

    return NextResponse.json({ success: true, transferId: transfer.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}