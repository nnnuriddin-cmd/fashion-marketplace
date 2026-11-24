import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionStep, TelegramSession } from './types';

const EDIT_STEPS = ['EDITING_PRICE', 'EDITING_STOCK'];

/** Latest add-product draft session of this seller in this store (edit sessions excluded), or null. */
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
    .not('step', 'in', `(${EDIT_STEPS.join(',')})`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TelegramSession | null) ?? null;
}

/** Active product-edit session (price/stock edit from "My Products"), or null. */
export async function getEditSession(
  supabase: SupabaseClient,
  chatId: string,
  storeId: string
): Promise<TelegramSession | null> {
  const { data } = await supabase
    .from('telegram_sessions')
    .select('*')
    .eq('seller_telegram_id', chatId)
    .eq('store_id', storeId)
    .in('step', EDIT_STEPS)
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

/** Deletes only product-edit sessions (keeps an unfinished add-product draft intact). */
export async function deleteEditSessions(supabase: SupabaseClient, chatId: string, storeId: string) {
  await supabase
    .from('telegram_sessions')
    .delete()
    .eq('seller_telegram_id', chatId)
    .eq('store_id', storeId)
    .in('step', EDIT_STEPS);
}

export async function deleteSession(supabase: SupabaseClient, sessionId: string) {
  await supabase.from('telegram_sessions').delete().eq('id', sessionId);
}

/**
 * Moves a session to a new step, merging `draftPatch` into its draft.
 * The draft is re-read right before writing so fields written meanwhile by the
 * background studio-photo job (ai_photos, photo_choice) are not lost.
 */
export async function advanceSession(
  supabase: SupabaseClient,
  session: TelegramSession,
  step: SessionStep,
  draftPatch: Record<string, unknown>
) {
  const { data: latest } = await supabase
    .from('telegram_sessions')
    .select('draft')
    .eq('id', session.id)
    .maybeSingle();
  await supabase
    .from('telegram_sessions')
    .update({
      step,
      draft: { ...(latest?.draft || session.draft || {}), ...draftPatch },
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

/**
 * Optimistic read-modify-write of a JSON column (session draft / product ai_metadata),
 * guarded by `updated_at` and retried on conflict, so concurrent writers (seller actions,
 * background photo jobs) never overwrite each other's fields.
 *
 * `mutate` gets the current JSON and the row; returning null aborts.
 * `extra` columns (e.g. { step }) are written in the same update.
 * Returns the new JSON, or null if the row is gone / aborted / kept conflicting.
 */
export async function patchJsonRow<T>(
  supabase: SupabaseClient,
  table: 'telegram_sessions' | 'products',
  id: string,
  column: 'draft' | 'ai_metadata',
  mutate: (current: any, row: any) => T | null,
  extra: Record<string, unknown> = {}
): Promise<T | null> {
  const extraCols = table === 'telegram_sessions' ? ', step, seller_telegram_id, store_id' : '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: row } = await supabase.from(table).select(`${column}, updated_at${extraCols}`).eq('id', id).maybeSingle();
    if (!row) return null;
    const next = mutate((row as any)[column] || {}, row);
    if (next === null) return null;
    let query = supabase
      .from(table)
      .update({ ...extra, [column]: next, updated_at: new Date(Date.now() + attempt).toISOString() })
      .eq('id', id);
    query = (row as any).updated_at ? query.eq('updated_at', (row as any).updated_at) : query;
    const { data: updated } = await query.select('id');
    if (updated && updated.length > 0) return next;
    await new Promise((r) => setTimeout(r, 50 + Math.random() * 150));
  }
  console.warn(`[Bot] could not update ${table}.${column} for ${id} after retries`);
  return null;
}
