import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { address, sqft, type } = await req.json();

    const prompt = `
      You are an expert Commercial Real Estate Appraiser.
      Estimate the current market rent for a commercial space with these details:
      Address: ${address}
      Size: ${sqft} SqFt
      Type: ${type}
      
      Return ONLY a valid JSON object with these exact keys:
      {
        "price_per_sqft_annual": numeric value (e.g. 24.50),
        "estimated_monthly_rent": numeric value (e.g. 5000),
        "market_trend": "A 1-sentence summary of the current CRE market in this specific city/zip code."
      }
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    return NextResponse.json(JSON.parse(data.choices[0].message.content));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}