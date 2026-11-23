/**
 * AI studio photos in the Telegram bot.
 *
 * Flow for a new product (automatic):
 *   photo upload → draft created → job started in the background → ~30s later the seller gets
 *   the white-background (and, for clothing, mannequin) photos plus buttons to choose which
 *   ones the product will use. Publishing before the job finishes uses the original photo;
 *   the late result is then offered for the already-published product.
 *
 * Flow for an existing product: "✨ Enhance photo" on the product card.
 *
 * Callback data:
 *   aiph_d_<sessionId>_<w|m|b|o>  – choose photos for a draft
 *   aiph_p_<productId>_<w|m|b|o>  – choose photos for a published product
 *   (w = white, m = mannequin, b = both, o = original)
 */
import crypto from 'crypto';
import { waitUntil } from '@vercel/functions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { answerTelegramCallbackQuery, sendTelegramMessage } from '@/lib/telegram/notifier';
import {
  generateStudioPhotos,
  getAiPhotoDailyLimit,
  hasAiPhotoQuota,
  isAiPhotoEnabled,
  isApparelCategory,
  StudioPhotoKind,
} from '@/lib/ai/studio-photos';
import { fetchSellerLanguage } from './language';
import { fetchTrustedImage } from './product-photo';
import { isTelegramApiUrl } from './product';
import { editTelegramMessage, sendTelegramMediaGroup } from './telegram-api';
import type { BotLang, InlineButton, InlineKeyboard, SellerContext, TelegramSession } from './types';
import { Localized, SITE_URL } from './ui';

export type PhotoChoice = 'w' | 'm' | 'b' | 'o';

export interface StudioCandidates {
  white?: string | null;
  mannequin?: string | null;
}

export type StudioPhotoJob =
  | { type: 'draft'; sessionId: string }
  | { type: 'product'; productId: string; chatId: string };

const T = {
  preparing: {
    uz: '✨ <b>Studiya rasmlari tayyorlanmoqda</b> (~30 soniya). Bu vaqtda narxni kiritishda davom etishingiz mumkin.',
    ru: '✨ <b>Готовлю студийные фото</b> (~30 сек). Пока можно продолжать вводить цену.',
    en: '✨ <b>Preparing studio photos</b> (~30 sec). You can keep entering the price meanwhile.',
  },
  preparingProduct: {
    uz: '⏳ Studiya rasmlari tayyorlanmoqda (~30 soniya)…',
    ru: '⏳ Готовлю студийные фото (~30 сек)…',
    en: '⏳ Preparing studio photos (~30 sec)…',
  },
  limit: {
    uz: 'ℹ️ Bugungi AI rasm limiti tugadi ({limit} ta mahsulot). Asl rasm ishlatiladi, ertaga yana ishlaydi.',
    ru: 'ℹ️ Дневной лимит AI-фото исчерпан ({limit} товаров). Будет использовано исходное фото, завтра снова заработает.',
    en: 'ℹ️ Daily AI photo limit reached ({limit} products). The original photo will be used; it resets tomorrow.',
  },
  failed: {
    uz: "⚠️ Studiya rasmini tayyorlab bo'lmadi. Asl rasm ishlatiladi.",
    ru: '⚠️ Не удалось подготовить студийное фото. Будет использовано исходное.',
    en: '⚠️ Could not prepare the studio photo. The original photo will be used.',
  },
  noSource: {
    uz: "⚠️ Bu mahsulotda ishlov berish uchun rasm yo'q.",
    ru: '⚠️ У этого товара нет фото для обработки.',
    en: '⚠️ This product has no photo to enhance.',
  },
  ready: {
    uz: "✨ <b>Studiya rasmlari tayyor!</b>\nMahsulotda qaysi rasmlar bo'lsin?",
    ru: '✨ <b>Студийные фото готовы!</b>\nКакие фото поставить на товар?',
    en: '✨ <b>Studio photos are ready!</b>\nWhich photos should the product use?',
  },
  readyLate: {
    uz: "✨ <b>«{title}» uchun studiya rasmlari tayyor!</b>\nMahsulot allaqachon e'lon qilingan — rasmlarni almashtirish uchun tanlang:",
    ru: '✨ <b>Студийные фото для «{title}» готовы!</b>\nТовар уже опубликован — выберите, чтобы заменить фото:',
    en: '✨ <b>Studio photos for “{title}” are ready!</b>\nThe product is already live — choose to replace its photos:',
  },
  captionWhite: { uz: '🤍 Oq fon', ru: '🤍 Белый фон', en: '🤍 White background' },
  captionMannequin: { uz: '🧍 Manekenda', ru: '🧍 На манекене', en: '🧍 On mannequin' },
  btnWhite: { uz: '🤍 Oq fon', ru: '🤍 Белый фон', en: '🤍 White' },
  btnMannequin: { uz: '🧍 Maneken', ru: '🧍 Манекен', en: '🧍 Mannequin' },
  btnBoth: { uz: '✅ Ikkalasi', ru: '✅ Оба', en: '✅ Both' },
  btnOriginal: { uz: '📷 Asl rasm', ru: '📷 Исходное фото', en: '📷 Original' },
  chosen: { uz: '✅ Tanlandi: <b>{choice}</b>', ru: '✅ Выбрано: <b>{choice}</b>', en: '✅ Selected: <b>{choice}</b>' },
  productUpdated: {
    uz: "✅ Mahsulot rasmlari yangilandi: <b>{choice}</b>\n🔗 {url}",
    ru: '✅ Фото товара обновлены: <b>{choice}</b>\n🔗 {url}',
    en: '✅ Product photos updated: <b>{choice}</b>\n🔗 {url}',
  },
  draftGone: {
    uz: "Qoralama topilmadi",
    ru: 'Черновик не найден',
    en: 'Draft not found',
  },
  notAvailable: {
    uz: 'Bu variant mavjud emas',
    ru: 'Этот вариант недоступен',
    en: 'This option is not available',
  },
} satisfies Record<string, Localized>;

function t(key: keyof typeof T, lang: BotLang, vars: Record<string, string | number> = {}): string {
  let text: string = T[key][lang] || T[key].uz;
  for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function choiceLabel(choice: PhotoChoice, lang: BotLang): string {
  return {
    w: t('btnWhite', lang),
    m: t('btnMannequin', lang),
    b: t('btnBoth', lang),
    o: t('btnOriginal', lang),
  }[choice];
}

/** Choice keyboard; only offers options that exist. The current choice is marked with ✔️. */
function buildChoiceKeyboard(
  prefix: string,
  candidates: StudioCandidates,
  lang: BotLang,
  selected?: PhotoChoice
): InlineKeyboard {
  const btn = (choice: PhotoChoice): InlineButton => ({
    text: `${selected === choice ? '✔️ ' : ''}${choiceLabel(choice, lang)}`,
    callback_data: `${prefix}_${choice}`,
  });
  const rows: InlineButton[][] = [];
  const first: InlineButton[] = [];
  if (candidates.white) first.push(btn('w'));
  if (candidates.mannequin) first.push(btn('m'));
  if (first.length) rows.push(first);
  if (candidates.white && candidates.mannequin) rows.push([btn('b')]);
  rows.push([btn('o')]);
  return { inline_keyboard: rows };
}

/** Default when the seller has not chosen: all generated photos, or the original if none. */
export function defaultPhotoChoice(candidates: StudioCandidates): PhotoChoice {
  if (candidates.white && candidates.mannequin) return 'b';
  if (candidates.white) return 'w';
  if (candidates.mannequin) return 'm';
  return 'o';
}

/** Resolves a choice into the ordered list of image URLs (falls back to the original). */
export function resolveChosenImages(
  choice: PhotoChoice | undefined,
  candidates: StudioCandidates,
  original: string
): string[] {
  const c = choice || defaultPhotoChoice(candidates);
  const urls =
    c === 'w' ? [candidates.white]
    : c === 'm' ? [candidates.mannequin]
    : c === 'b' ? [candidates.white, candidates.mannequin]
    : [original];
  const clean = urls.filter((u): u is string => typeof u === 'string' && u.length > 0 && !isTelegramApiUrl(u));
  return clean.length ? clean : [original];
}

function isValidChoice(choice: PhotoChoice, candidates: StudioCandidates): boolean {
  if (choice === 'o') return true;
  if (choice === 'w') return Boolean(candidates.white);
  if (choice === 'm') return Boolean(candidates.mannequin);
  return Boolean(candidates.white && candidates.mannequin);
}

// ---------------------------------------------------------------------------
// Starting jobs
// ---------------------------------------------------------------------------

/**
 * Starts a studio photo job in a separate serverless invocation (own 60s budget),
 * so the webhook can answer Telegram immediately. Falls back to running inline.
 */
export function triggerStudioPhotoJob(job: StudioPhotoJob, supabase: SupabaseClient) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const base = (process.env.PHOTO_JOB_BASE_URL || SITE_URL).replace(/\/$/, '');

  const run = async () => {
    if (secret) {
      try {
        const res = await fetch(`${base}/api/telegram/photo-job`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-photo-job-secret': secret },
          body: JSON.stringify(job),
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) return;
        console.warn('[Studio photo] job route returned', res.status, '- running inline');
      } catch (err) {
        console.warn('[Studio photo] job route unreachable, running inline:', err);
      }
    }
    await runStudioPhotoJob(supabase, job);
  };

  waitUntil(run().catch((err) => console.error('[Studio photo] job failed:', err)));
}

/**
 * Called right after a draft is created. Checks the daily limit, tells the seller what happens,
 * and starts the job. Returns the initial ai_photos draft state.
 */
export async function startDraftStudioPhotos(ctx: SellerContext, sessionId: string): Promise<void> {
  if (!isAiPhotoEnabled()) return;

  if (!(await hasAiPhotoQuota(ctx.store.id))) {
    await ctx.supabase
      .from('telegram_sessions')
      .update({ draft: await mergeDraft(ctx.supabase, sessionId, { ai_photos: { status: 'limit' } }) })
      .eq('id', sessionId);
    await sendTelegramMessage(ctx.chatId, t('limit', ctx.lang, { limit: getAiPhotoDailyLimit() }));
    return;
  }

  await sendTelegramMessage(ctx.chatId, t('preparing', ctx.lang));
  triggerStudioPhotoJob({ type: 'draft', sessionId }, ctx.supabase);
}

async function mergeDraft(supabase: SupabaseClient, sessionId: string, patch: Record<string, unknown>) {
  const { data } = await supabase.from('telegram_sessions').select('draft').eq('id', sessionId).maybeSingle();
  return { ...(data?.draft || {}), ...patch };
}

// ---------------------------------------------------------------------------
// Running jobs (background invocation)
// ---------------------------------------------------------------------------

async function sellerLangByChat(supabase: SupabaseClient, chatId: string): Promise<BotLang> {
  const { data: user } = await supabase.from('users').select('id').eq('telegram_id', chatId).maybeSingle();
  return user ? fetchSellerLanguage(supabase, user.id) : 'uz';
}

export async function runStudioPhotoJob(supabase: SupabaseClient, job: StudioPhotoJob): Promise<void> {
  if (job.type === 'draft') await runDraftJob(supabase, job.sessionId);
  else await runProductJob(supabase, job.productId, job.chatId);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runDraftJob(supabase: SupabaseClient, sessionId: string) {
  const { data: session } = await supabase.from('telegram_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (!session) return;
  const s = session as TelegramSession;
  const chatId = s.seller_telegram_id;
  const lang = await sellerLangByChat(supabase, chatId);

  const source = await fetchTrustedImage(s.processed_image_url || s.draft?.image);
  if (!source) {
    await sendTelegramMessage(chatId, t('failed', lang));
    return;
  }

  const categoryName = s.draft?.category_name || s.draft?.ai?.category || null;
  const kinds: StudioPhotoKind[] = isApparelCategory(categoryName) ? ['white', 'mannequin'] : ['white'];
  const photos = await generateStudioPhotos({ source, storeId: s.store_id, jobId: sessionId, kinds });

  const candidates: StudioCandidates = {
    white: photos.find((p) => p.kind === 'white')?.publicUrl || null,
    mannequin: photos.find((p) => p.kind === 'mannequin')?.publicUrl || null,
  };

  // The seller may have advanced (or published) while we were generating: re-read
  let fresh = (await supabase.from('telegram_sessions').select('*').eq('id', sessionId).maybeSingle()).data;
  if (fresh?.step === 'PUBLISHING') {
    await sleep(3000);
    fresh = (await supabase.from('telegram_sessions').select('*').eq('id', sessionId).maybeSingle()).data;
  }

  if (photos.length === 0) {
    if (fresh) {
      await supabase
        .from('telegram_sessions')
        .update({ draft: { ...(fresh.draft || {}), ai_photos: { status: 'failed' } } })
        .eq('id', sessionId);
    }
    await sendTelegramMessage(chatId, t('failed', lang));
    return;
  }

  const album = photos.map((p) => ({
    jpeg: p.jpeg,
    caption: p.kind === 'white' ? t('captionWhite', lang) : t('captionMannequin', lang),
  }));

  if (fresh && fresh.step !== 'PUBLISHING') {
    const choice = defaultPhotoChoice(candidates);
    await supabase
      .from('telegram_sessions')
      .update({
        draft: { ...(fresh.draft || {}), ai_photos: { status: 'done', ...candidates }, photo_choice: choice },
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
    await sendTelegramMediaGroup(chatId, album);
    await sendTelegramMessage(
      chatId,
      `${t('ready', lang)}\n\n${t('chosen', lang, { choice: choiceLabel(choice, lang) })}`,
      buildChoiceKeyboard(`aiph_d_${sessionId}`, candidates, lang, choice)
    );
    return;
  }

  // Draft already published: offer the photos for the live product
  const { data: product } = await supabase
    .from('products')
    .select('id, title, ai_metadata')
    .eq('store_id', s.store_id)
    .eq('ai_metadata->>telegram_session_id', sessionId)
    .maybeSingle();
  if (!product) return;

  await supabase
    .from('products')
    .update({ ai_metadata: { ...(product.ai_metadata || {}), ai_photo_candidates: candidates } })
    .eq('id', product.id);
  await sendTelegramMediaGroup(chatId, album);
  await sendTelegramMessage(
    chatId,
    t('readyLate', lang, { title: escapeHtml(product.title) }),
    buildChoiceKeyboard(`aiph_p_${product.id}`, candidates, lang)
  );
}

async function runProductJob(supabase: SupabaseClient, productId: string, chatId: string) {
  const lang = await sellerLangByChat(supabase, chatId);

  // Authorize: the product must belong to the store owned by the seller linked to this chat
  const { data: user } = await supabase.from('users').select('id, role').eq('telegram_id', chatId).maybeSingle();
  if (!user || user.role !== 'SELLER') return;
  const { data: store } = await supabase.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
  if (!store) return;
  const { data: product } = await supabase
    .from('products')
    .select('id, title, original_image, processed_images, category_id, ai_metadata')
    .eq('id', productId)
    .eq('store_id', store.id)
    .maybeSingle();
  if (!product) return;

  const sourceUrl = product.original_image || (Array.isArray(product.processed_images) ? product.processed_images[0] : null);
  const source = await fetchTrustedImage(sourceUrl);
  if (!source) {
    await sendTelegramMessage(chatId, t('noSource', lang));
    return;
  }

  let categoryName: string | null = product.ai_metadata?.category || null;
  if (product.category_id) {
    const { data: cat } = await supabase.from('categories').select('name').eq('id', product.category_id).maybeSingle();
    categoryName = cat?.name || categoryName;
  }
  const kinds: StudioPhotoKind[] = isApparelCategory(categoryName) ? ['white', 'mannequin'] : ['white'];

  const photos = await generateStudioPhotos({ source, storeId: store.id, jobId: crypto.randomUUID(), kinds });
  if (photos.length === 0) {
    await sendTelegramMessage(chatId, t('failed', lang));
    return;
  }

  const candidates: StudioCandidates = {
    white: photos.find((p) => p.kind === 'white')?.publicUrl || null,
    mannequin: photos.find((p) => p.kind === 'mannequin')?.publicUrl || null,
  };
  await supabase
    .from('products')
    .update({ ai_metadata: { ...(product.ai_metadata || {}), ai_photo_candidates: candidates } })
    .eq('id', product.id);

  await sendTelegramMediaGroup(
    chatId,
    photos.map((p) => ({ jpeg: p.jpeg, caption: p.kind === 'white' ? t('captionWhite', lang) : t('captionMannequin', lang) }))
  );
  await sendTelegramMessage(
    chatId,
    t('readyLate', lang, { title: escapeHtml(product.title) }),
    buildChoiceKeyboard(`aiph_p_${product.id}`, candidates, lang)
  );
}

// ---------------------------------------------------------------------------
// "✨ Enhance photo" for an existing product
// ---------------------------------------------------------------------------

export async function startProductStudioPhotos(ctx: SellerContext, productId: string, cbId: string) {
  if (!isAiPhotoEnabled()) {
    await answerTelegramCallbackQuery(cbId);
    return;
  }
  if (!(await hasAiPhotoQuota(ctx.store.id))) {
    await answerTelegramCallbackQuery(cbId, t('limit', ctx.lang, { limit: getAiPhotoDailyLimit() }), true);
    return;
  }
  await answerTelegramCallbackQuery(cbId);
  await sendTelegramMessage(ctx.chatId, t('preparingProduct', ctx.lang));
  triggerStudioPhotoJob({ type: 'product', productId, chatId: ctx.chatId }, ctx.supabase);
}

// ---------------------------------------------------------------------------
// Choice buttons
// ---------------------------------------------------------------------------

interface ChoiceCallbackContext extends SellerContext {
  cbId: string;
  data: string;
  messageId?: number;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Handles `aiph_*` callbacks. Returns true if handled. */
export async function handleStudioPhotoCallback(ctx: ChoiceCallbackContext): Promise<boolean> {
  const { data, cbId, lang, chatId, store, supabase } = ctx;
  if (!data.startsWith('aiph_')) return false;

  const m = data.match(new RegExp(`^aiph_([dp])_(${UUID})_([wmbo])$`, 'i'));
  if (!m) {
    await answerTelegramCallbackQuery(cbId);
    return true;
  }
  const [, scope, id, rawChoice] = m;
  const choice = rawChoice as PhotoChoice;

  if (scope === 'd') {
    const { data: session } = await supabase
      .from('telegram_sessions')
      .select('*')
      .eq('id', id)
      .eq('seller_telegram_id', chatId)
      .eq('store_id', store.id)
      .maybeSingle();
    if (!session) {
      await answerTelegramCallbackQuery(cbId, t('draftGone', lang), true);
      return true;
    }
    const candidates: StudioCandidates = session.draft?.ai_photos || {};
    if (!isValidChoice(choice, candidates)) {
      await answerTelegramCallbackQuery(cbId, t('notAvailable', lang), true);
      return true;
    }
    await supabase
      .from('telegram_sessions')
      .update({ draft: { ...(session.draft || {}), photo_choice: choice }, updated_at: new Date().toISOString() })
      .eq('id', id);
    await answerTelegramCallbackQuery(cbId, choiceLabel(choice, lang));
    if (ctx.messageId) {
      await editTelegramMessage(
        chatId,
        ctx.messageId,
        `${t('ready', lang)}\n\n${t('chosen', lang, { choice: choiceLabel(choice, lang) })}`,
        buildChoiceKeyboard(`aiph_d_${id}`, candidates, lang, choice)
      );
    }
    return true;
  }

  // scope === 'p': published product
  const { data: product } = await supabase
    .from('products')
    .select('id, slug, status, original_image, processed_images, ai_metadata')
    .eq('id', id)
    .eq('store_id', store.id)
    .maybeSingle();
  if (!product) {
    await answerTelegramCallbackQuery(cbId, t('notAvailable', lang), true);
    return true;
  }
  const candidates: StudioCandidates = product.ai_metadata?.ai_photo_candidates || {};
  if (!isValidChoice(choice, candidates)) {
    await answerTelegramCallbackQuery(cbId, t('notAvailable', lang), true);
    return true;
  }
  const original =
    product.original_image || (Array.isArray(product.processed_images) ? product.processed_images[0] : '') || '';
  const images = resolveChosenImages(choice, candidates, original);
  const { error } = await supabase
    .from('products')
    .update({ processed_images: images, updated_at: new Date().toISOString() })
    .eq('id', product.id)
    .eq('store_id', store.id);
  if (error) {
    console.error('Failed to update product photos:', error);
    await answerTelegramCallbackQuery(cbId, t('notAvailable', lang), true);
    return true;
  }
  await answerTelegramCallbackQuery(cbId, choiceLabel(choice, lang));
  if (ctx.messageId) {
    await editTelegramMessage(
      chatId,
      ctx.messageId,
      t('productUpdated', lang, {
        choice: choiceLabel(choice, lang),
        url: `${SITE_URL}/product/${encodeURIComponent(product.slug)}`,
      }),
      buildChoiceKeyboard(`aiph_p_${product.id}`, candidates, lang, choice)
    );
  }
  return true;
}
