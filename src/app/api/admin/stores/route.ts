import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { storeId, action } = await req.json();
    const db = getDb();

    if (!storeId || !action) {
      return NextResponse.json({ error: 'Missing parameters.' }, { status: 400 });
    }

    let status = 'APPROVED';
    if (action === 'REJECT') status = 'REJECTED';
    if (action === 'SUSPEND') status = 'SUSPENDED';

    db.prepare(`UPDATE stores SET status = ? WHERE id = ?`).run(status, storeId);

    return NextResponse.json({ success: true, storeId, status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
