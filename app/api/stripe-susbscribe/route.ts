import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  try {
    // FIX: Moved inside the function with a fallback
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
      apiVersion: '2023-10-16' as any
    });

    const { email, companyName } = await req.json();
    if (!email || !companyName) throw new Error("Email and Company Name are required.");

    const customer = await stripe.customers.create({
      email: email,
      name: companyName,
    });

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items:[
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'OphirCRE OS - Professional Tier',
              description: 'Full access to the Property Management Operating System'
            },
            unit_amount: 29900,
            recurring: { interval: 'month' }
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `https://app.ophircre.com/saas-onboarding?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(email)}&company=${encodeURIComponent(companyName)}`,
      cancel_url: `https://app.ophircre.com/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Subscription Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}