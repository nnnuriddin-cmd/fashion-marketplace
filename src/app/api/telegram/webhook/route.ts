import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { handleTelegramUpdate } from '@/lib/telegram/bot';

export const preferredRegion = 'bom1';

/**
 * Telegram webhook endpoint. Verifies the secret token and hands the update
 * to the seller bot (see src/lib/telegram/bot).
 */
export async function POST(request: NextRequest) {
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret || secretHeader !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized webhook source' }, { status: 401 });
  }

  try {
    const update = await request.json();
    await handleTelegramUpdate(getServerSupabase(), update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
