import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { storeId, action } = await req.json();
    if (!storeId || !action) {
      return NextResponse.json({ error: 'Missing parameters.' }, { status: 400 });
    }

    let status = 'APPROVED';
    if (action === 'REJECT') status = 'REJECTED';
    if (action === 'SUSPEND') status = 'SUSPENDED';

    const { error } = await supabase
      .from('stores')
      .update({ status })
      .eq('id', storeId);

    if (error) throw error;

    return NextResponse.json({ success: true, storeId, status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
