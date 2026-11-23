import type { SupabaseClient } from '@supabase/supabase-js';
import type { BotLang } from './types';

export const SUPPORTED_LANGS: readonly BotLang[] = ['uz', 'ru', 'en'];

/**
 * Resolves language for a Telegram user with the following priority:
 * 1. Saved explicit seller preference: auth.users.user_metadata.preferred_language (uz | ru | en)
 * 2. Default fallback: 'uz' (Uzbek Latin is ALWAYS the default language)
 */
export function resolveTelegramLanguage(preferredLanguage?: unknown): BotLang {
  if (typeof preferredLanguage === 'string') {
    const cleanPref = preferredLanguage.trim().toLowerCase();
    if ((SUPPORTED_LANGS as readonly string[]).includes(cleanPref)) {
      return cleanPref as BotLang;
    }
  }
  return 'uz';
}

/**
 * Reads the seller's preferred language from Supabase Auth user_metadata.
 * Never throws: any failure falls back to the default language.
 */
export async function fetchSellerLanguage(
  supabase: SupabaseClient,
  userId: string
): Promise<BotLang> {
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) {
      console.warn('Failed to retrieve user_metadata for seller:', userId, error);
    }
    return resolveTelegramLanguage(data?.user?.user_metadata?.preferred_language);
  } catch (err) {
    console.warn('Could not read seller preferred_language:', err);
    return 'uz';
  }
}

/** Persists the seller's preferred language. Returns false on failure. */
export async function saveSellerLanguage(
  supabase: SupabaseClient,
  userId: string,
  lang: BotLang
): Promise<boolean> {
  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { preferred_language: lang },
    });
    if (error) {
      console.error('Failed to persist preferred_language in auth user_metadata:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to persist preferred_language in auth user_metadata:', err);
    return false;
  }
}
