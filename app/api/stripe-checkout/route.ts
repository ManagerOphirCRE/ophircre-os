import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: Request) {
  try {
    // FIX: Moved inside the function with a fallback so Vercel doesn't crash during build!
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
      apiVersion: '2023-10-16' as any
    });

    const { amount, tenantName, tenantId } = await req.json();

    if (!amount || amount <= 0) throw new Error("Invalid payment amount.");

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'],
      line_items:[
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Rent & Balance Payment - ${tenantName}`,
              description: 'OphirCRE Property Management'
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `https://app.ophircre.com/portal?success=true&amount=${amount}`,
      cancel_url: `https://app.ophircre.com/portal?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}