'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** Result codes are translation keys, so the client can show them in the user's language. */
export type PasswordActionResult =
  | { ok: true }
  | {
      ok: false;
      errorKey:
        | 'auth.invalidEmail'
        | 'auth.forgotError'
        | 'auth.passwordTooShort'
        | 'auth.passwordsMismatch'
        | 'auth.samePassword'
        | 'auth.resetExpiredTitle'
        | 'auth.resetFailed';
    };

/** Public site origin for links in emails (env first, then the incoming request). */
function getSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'modora.uz';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Sends a password reset email. Always reports success for a well-formed email,
 * so the form never reveals whether an account exists.
 */
export async function requestPasswordResetAction(email: string): Promise<PasswordActionResult> {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, errorKey: 'auth.invalidEmail' };
  }

  // The cookie-aware client stores the PKCE verifier in this browser,
  // so the link must be opened in the same browser.
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${getSiteOrigin()}/auth/callback?next=/reset-password`,
  });

  if (error) {
    // Unknown emails do not produce an error; this is a delivery/rate-limit problem
    console.error('resetPasswordForEmail failed:', error.status, error.message);
    return { ok: false, errorKey: 'auth.forgotError' };
  }
  return { ok: true };
}

/** Sets a new password for the user signed in via the reset link. */
export async function updatePasswordAction(password: string, confirmPassword: string): Promise<PasswordActionResult> {
  if (!password || password.length < 6) {
    return { ok: false, errorKey: 'auth.passwordTooShort' };
  }
  if (password !== confirmPassword) {
    return { ok: false, errorKey: 'auth.passwordsMismatch' };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, errorKey: 'auth.resetExpiredTitle' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === 'same_password') {
      return { ok: false, errorKey: 'auth.samePassword' };
    }
    console.error('updateUser(password) failed:', error.status, error.message);
    return { ok: false, errorKey: 'auth.resetFailed' };
  }

  revalidatePath('/', 'layout');
  redirect('/account');
}
