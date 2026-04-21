import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const { tenantId } = await req.json();
    
    // Simulate a 3-second background check API call to TransUnion
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const mockFico = Math.floor(Math.random() * (800 - 600 + 1)) + 600; // Random score between 600-800
    const status = mockFico > 650 ? 'Passed' : 'Review Required';

    await supabase.from('tenants').update({ screening_status: status, fico_score: mockFico }).eq('id', tenantId);

    return NextResponse.json({ success: true, fico: mockFico, status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}