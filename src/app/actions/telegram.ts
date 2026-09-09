'use server';

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { getCurrentUserProfile } from '@/lib/auth';
import { getServerSupabase } from '@/lib/supabase-server';

export interface GenerateLinkCodeResult {
  success: boolean;
  code?: string;
  expiresAt?: number;
  error?: string;
}

export interface UnlinkTelegramResult {
  success: boolean;
  error?: string;
}

/**
 * Generates a cryptographically random, short-lived (10 min), single-use linking code
 * for an authenticated seller.
 *
 * Security:
 * - Seller identity is resolved exclusively from the verified Supabase Auth session.
 * - Raw code is NEVER stored in the database or logged anywhere.
 * - Only SHA-256 hash + expiration epoch are stored in `public.users.telegram_code`.
 * - Overwrites and invalidates any prior unconsumed linking codes for this user.
 */
export async function generateTelegramLinkCode(): Promise<GenerateLinkCodeResult> {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile) {
      return { success: false, error: 'Unauthorized: Authentication required.' };
    }

    if (profile.role !== 'SELLER') {
      return { success: false, error: 'Forbidden: Only sellers can connect a Telegram account.' };
    }

    // 1. Generate 32-character uppercase hex code (128 bits of cryptographic randomness)
    const rawCode = crypto.randomBytes(16).toString('hex').toUpperCase();

    // 2. Compute SHA-256 hash
    const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');

    // 3. Expiration: exactly 10 minutes from now
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // 4. Stored payload format: <hash>:<expiresAtMs>
    const storedPayload = `${codeHash}:${expiresAt}`;

    // 5. Persist hash and expiry to user record
    const supabase = getServerSupabase();
    const { error: updateErr } = await supabase
      .from('users')
      .update({
        telegram_code: storedPayload,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (updateErr) {
      console.error('Failed to store telegram linking code for user:', profile.id, updateErr);
      return { success: false, error: 'Failed to generate linking code. Please try again.' };
    }

    return {
      success: true,
      code: rawCode,
      expiresAt,
    };
  } catch (err) {
    console.error('generateTelegramLinkCode unexpected error:', err);
    return { success: false, error: 'Internal server error while generating linking code.' };
  }
}

/**
 * Disconnects the Telegram account for the authenticated seller.
 *
 * Security:
 * - Operates strictly on the authenticated user's own record (resolved via session).
 * - Clears both `telegram_id` and any outstanding `telegram_code`.
 */
export async function unlinkTelegramAccount(): Promise<UnlinkTelegramResult> {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile) {
      return { success: false, error: 'Unauthorized: Authentication required.' };
    }

    if (profile.role !== 'SELLER') {
      return { success: false, error: 'Forbidden: Only sellers can disconnect a Telegram account.' };
    }

    const supabase = getServerSupabase();
    const { error } = await supabase
      .from('users')
      .update({
        telegram_id: null,
        telegram_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    if (error) {
      console.error('Failed to unlink Telegram account for user:', profile.id, error);
      return { success: false, error: 'Failed to disconnect Telegram account.' };
    }

    revalidatePath('/account');
    return { success: true };
  } catch (err) {
    console.error('unlinkTelegramAccount unexpected error:', err);
    return { success: false, error: 'Internal server error while disconnecting Telegram.' };
  }
}
