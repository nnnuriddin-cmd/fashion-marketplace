import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Landing point for Supabase email links (password recovery, magic link).
 * Exchanges the one-time code for a session cookie, then redirects to `next`.
 *
 * Supports both the default PKCE link (?code=...) and custom templates (?token_hash=...&type=...).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  // Only allow same-site relative redirects
  const rawNext = url.searchParams.get('next') || '/account';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/account';

  const supabase = createClient();
  let ok = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) console.warn('Auth callback: code exchange failed:', error.message);
    ok = !error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) console.warn('Auth callback: OTP verification failed:', error.message);
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(new URL('/forgot-password?expired=1', url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
