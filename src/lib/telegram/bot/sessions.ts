import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionStep, TelegramSession } from './types';

/** Latest draft session of this seller in this store, or null. */
export async function getLatestSession(
  supabase: SupabaseClient,
  chatId: string,
  storeId: string
): Promise<TelegramSession | null> {
  const { data } = await supabase
    .from('telegram_sessions')
    .select('*')
    .eq('seller_telegram_id', chatId)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TelegramSession | null) ?? null;
}

/** Deletes all unfinished draft sessions of this seller in this store. Returns deleted ids. */
export async function deleteSellerSessions(
  supabase: SupabaseClient,
  chatId: string,
  storeId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('telegram_sessions')
    .delete()
    .eq('seller_telegram_id', chatId)
    .eq('store_id', storeId)
    .select('id');
  return (data || []).map((row: { id: string }) => row.id);
}

export async function deleteSession(supabase: SupabaseClient, sessionId: string) {
  await supabase.from('telegram_sessions').delete().eq('id', sessionId);
}

/** Moves a session to a new step, merging `draftPatch` into its draft. */
export async function advanceSession(
  supabase: SupabaseClient,
  session: TelegramSession,
  step: SessionStep,
  draftPatch: Record<string, unknown>
) {
  await supabase
    .from('telegram_sessions')
    .update({
      step,
      draft: { ...(session.draft || {}), ...draftPatch },
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id);
}

export async function createSession(
  supabase: SupabaseClient,
  fields: {
    id: string;
    chatId: string;
    storeId: string;
    step: SessionStep;
    processedImageUrl?: string | null;
    extractedMetadata?: unknown;
    draft: Record<string, unknown>;
  }
) {
  const now = new Date().toISOString();
  return supabase.from('telegram_sessions').insert({
    id: fields.id,
    seller_telegram_id: fields.chatId,
    store_id: fields.storeId,
    step: fields.step,
    raw_image_url: null,
    processed_image_url: fields.processedImageUrl ?? null,
    extracted_metadata: fields.extractedMetadata ?? null,
    draft: fields.draft,
    created_at: now,
    updated_at: now,
  });
}

/** AI metadata of a draft (stored in draft.ai, with legacy fallback). */
export function getSessionAi(session: TelegramSession): any {
  return session.draft?.ai || session.extracted_metadata || {};
}
