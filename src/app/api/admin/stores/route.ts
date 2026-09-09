import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user strictly from SSR session cookies
    const profile = await getCurrentUserProfile();

    if (!profile) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required.' },
        { status: 401 }
      );
    }

    // 2. Enforce strict ADMIN authorization derived exclusively from public.users.role
    if (profile.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required.' },
        { status: 403 }
      );
    }

    // 3. Process mutation payload
    const body = await req.json();
    const { storeId, action } = body;
    if (!storeId || !action) {
      return NextResponse.json({ error: 'Missing required parameters.' }, { status: 400 });
    }

    let status = 'APPROVED';
    if (action === 'REJECT') status = 'REJECTED';
    if (action === 'SUSPEND') status = 'SUSPENDED';

    // Privileged server client updates store status
    const supabase = getServerSupabase();
    const { error } = await supabase
      .from('stores')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', storeId);

    if (error) {
      console.error('Failed to update store status:', error);
      return NextResponse.json({ error: 'Failed to update store status.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, storeId, status });
  } catch (err) {
    console.error('Admin stores API error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
