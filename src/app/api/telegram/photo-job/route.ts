import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getServerSupabase } from '@/lib/supabase-server';
import { runStudioPhotoJob, StudioPhotoJob } from '@/lib/telegram/bot/studio-photos';

export const preferredRegion = 'bom1';
// Image generation takes ~15-45s; it runs here so the Telegram webhook can answer immediately
export const maxDuration = 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const given = request.headers.get('x-photo-job-secret');
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseJob(body: any): StudioPhotoJob | null {
  const kind = body?.kind;
  if (kind !== 'white' && kind !== 'mannequin') return null;
  if (body?.type === 'draft' && typeof body.sessionId === 'string' && UUID_RE.test(body.sessionId)) {
    return { type: 'draft', sessionId: body.sessionId, kind };
  }
  if (
    body?.type === 'product' &&
    typeof body.productId === 'string' && UUID_RE.test(body.productId) &&
    typeof body.jobId === 'string' && UUID_RE.test(body.jobId) &&
    typeof body.chatId === 'string' && /^-?\d+$/.test(body.chatId)
  ) {
    return { type: 'product', productId: body.productId, chatId: body.chatId, jobId: body.jobId, kind };
  }
  return null;
}

/** Internal endpoint: starts an AI studio photo job (called by the Telegram webhook). */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const job = parseJob(await request.json().catch(() => null));
  if (!job) {
    return NextResponse.json({ error: 'Invalid job' }, { status: 400 });
  }

  waitUntil(
    runStudioPhotoJob(getServerSupabase(), job).catch((err) =>
      console.error('[Studio photo] background job failed:', err)
    )
  );
  return NextResponse.json({ accepted: true }, { status: 202 });
}
