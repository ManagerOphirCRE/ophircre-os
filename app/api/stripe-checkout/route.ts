import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Initialize Stripe securely
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2023-10-16' as any
});

export async function POST(req: Request) {
  try {
    const { amount, tenantName, tenantId } = await req.json();

    if (!amount || amount <= 0) throw new Error("Invalid payment amount.");

    // Create a secure Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'us_bank_account'], // Allows Credit Card OR ACH Bank Transfer
      line_items:[
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Rent & Balance Payment - ${tenantName}`,
              description: 'OphirCRE Property Management'
            },
            unit_amount: Math.round(amount * 100), // Stripe calculates in cents (e.g., $50.00 = 5000)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Send them back to the portal with a success flag so we can update their balance!
      success_url: `https://app.ophircre.com/portal?success=true&amount=${amount}`,
      cancel_url: `https://app.ophircre.com/portal?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}