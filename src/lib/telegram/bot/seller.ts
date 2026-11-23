import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchSellerLanguage } from './language';
import type { BotLang, SellerStore, SellerUser } from './types';

/** Finds the user linked to this Telegram chat (strictly by verified telegram_id). */
export async function findUserByChatId(
  supabase: SupabaseClient,
  chatId: string
): Promise<SellerUser | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id, role')
    .eq('telegram_id', chatId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Concurrently loads the seller's store (strictly by owner_id) and preferred language. */
export async function loadStoreAndLanguage(
  supabase: SupabaseClient,
  userId: string
): Promise<{ store: SellerStore | null; lang: BotLang }> {
  const [lang, storeResult] = await Promise.all([
    fetchSellerLanguage(supabase, userId),
    supabase
      .from('stores')
      .select('id, name, status')
      .eq('owner_id', userId)
      .maybeSingle(),
  ]);
  if (storeResult.error) throw storeResult.error;
  return { store: storeResult.data, lang };
}
