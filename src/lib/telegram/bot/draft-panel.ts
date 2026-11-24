/**
 * Draft panel: one message that shows the product draft and lets the seller fill it in any order.
 *
 *   🛍 Mahsulot qoralamasi
 *   🖼 Rasm: 👤 Modelda            ← photo choice buttons when AI photos are ready
 *   📝 Tavsif: …                   [📝 Tavsif] [💰 Narx] [📦 Miqdor]
 *   💰 Narx: 450,000 UZS            [🚀 E'lon qilish]
 *   📦 Miqdor: 5 dona               [❌ Bekor qilish]
 *
 * Callback data:
 *   drf_d_<sessionId> – edit description   drf_p_<sessionId> – set price
 *   drf_s_<sessionId> – set stock          drf_b_<sessionId> – back to the panel (cancel input)
 *   publish_<sessionId>, cancel_<sessionId>, aiph_d_<sessionId>_<choice> (photo choice)
 *
 * The panel is always kept as the LAST bot message: re-sending it deletes the previous one
 * (draft.panel_msg_id). Choosing a photo edits it in place.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram/notifier';
import { getTelegramText } from '@/lib/telegram/product-draft';
import { patchJsonRow } from './sessions';
import {
  KIND_CODE,
  PhotoChoice,
  candidatesOf,
  choiceLabel,
  defaultPhotoChoice,
  readyKinds,
} from './studio-photos';
import { deleteTelegramMessage, editTelegramMessage } from './telegram-api';
import type { BotLang, InlineButton, InlineKeyboard } from './types';
import { Localized } from './ui';

const T = {
  title: { uz: '🛍 <b>Mahsulot qoralamasi</b>', ru: '🛍 <b>Черновик товара</b>', en: '🛍 <b>Product draft</b>' },
  photo: { uz: 'Rasm', ru: 'Фото', en: 'Photo' },
  description: { uz: 'Tavsif', ru: 'Описание', en: 'Description' },
  price: { uz: 'Narx', ru: 'Цена', en: 'Price' },
  stock: { uz: 'Miqdor', ru: 'Количество', en: 'Stock' },
  pcs: { uz: 'dona', ru: 'шт.', en: 'pcs' },
  notSet: { uz: '❗ kiritilmagan', ru: '❗ не указано', en: '❗ not set' },
  photoPending: { uz: '⏳ tayyorlanmoqda…', ru: '⏳ готовится…', en: '⏳ being prepared…' },
  hintMissing: {
    uz: '👉 Narx va miqdorni kiriting, so‘ng «🚀 E’lon qilish»ni bosing.',
    ru: '👉 Укажите цену и количество, затем нажмите «🚀 Опубликовать».',
    en: '👉 Set the price and stock, then tap “🚀 Publish”.',
  },
  hintReady: {
    uz: '✅ Hammasi tayyor — «🚀 E’lon qilish»ni bosing.',
    ru: '✅ Всё готово — нажмите «🚀 Опубликовать».',
    en: '✅ All set — tap “🚀 Publish”.',
  },
  btnDescription: { uz: '📝 Tavsif', ru: '📝 Описание', en: '📝 Description' },
  btnPrice: { uz: '💰 Narx', ru: '💰 Цена', en: '💰 Price' },
  btnStock: { uz: '📦 Miqdor', ru: '📦 Количество', en: '📦 Stock' },
  btnPublish: { uz: '🚀 E’lon qilish', ru: '🚀 Опубликовать', en: '🚀 Publish' },
  btnBack: { uz: '⬅️ Orqaga', ru: '⬅️ Назад', en: '⬅️ Back' },
  askDescription: {
    uz: '📝 Mahsulot tavsifini yozing (3–1000 belgi).\n\nHozirgi tavsif:\n<i>{current}</i>',
    ru: '📝 Напишите описание товара (3–1000 символов).\n\nСейчас:\n<i>{current}</i>',
    en: '📝 Write the product description (3–1000 characters).\n\nCurrent:\n<i>{current}</i>',
  },
  askPrice: {
    uz: '💰 Narxni so‘mda kiriting (masalan: <code>450000</code> yoki <code>450 000</code>).',
    ru: '💰 Введите цену в сумах (например: <code>450000</code> или <code>450 000</code>).',
    en: '💰 Enter the price in UZS (e.g. <code>450000</code> or <code>450 000</code>).',
  },
  askStock: {
    uz: '📦 Omborda nechta bor? Raqam yuboring yoki tugmani bosing.',
    ru: '📦 Сколько штук в наличии? Отправьте число или нажмите кнопку.',
    en: '📦 How many in stock? Send a number or tap a button.',
  },
  missingFields: {
    uz: 'Avval narx va miqdorni kiriting',
    ru: 'Сначала укажите цену и количество',
    en: 'Set the price and stock first',
  },
  descTooShort: {
    uz: '⚠️ Tavsif juda qisqa (kamida 3 belgi).',
    ru: '⚠️ Слишком короткое описание (минимум 3 символа).',
    en: '⚠️ Description is too short (min 3 characters).',
  },
} satisfies Record<string, Localized>;

export function panelText(key: keyof typeof T, lang: BotLang, vars: Record<string, string | number> = {}): string {
  let text: string = T[key][lang] || T[key].uz;
  for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Current description of a draft: the seller's text, or the AI one. */
export function draftDescription(draft: any): string {
  return String(draft?.description ?? draft?.ai?.description ?? '').trim();
}

export function isDraftComplete(draft: any): boolean {
  return Boolean(draft?.price) && Boolean(draft?.stock);
}

function buildPanel(sessionId: string, draft: any, lang: BotLang): { text: string; keyboard: InlineKeyboard } {
  const studio = draft?.ai_photos || {};
  const c = candidatesOf(studio);
  const ready = readyKinds(c);
  const pending = (studio.kinds || []).some((k: string) => studio.status?.[k] === 'pending');
  const choice: PhotoChoice = draft?.photo_choice || defaultPhotoChoice(c);

  let photo: string;
  if (ready.length && choice !== 'o') photo = choiceLabel(choice, lang);
  else if (pending) photo = panelText('photoPending', lang);
  else photo = choiceLabel('o', lang);
  if (pending && ready.length) photo += ` · ${panelText('photoPending', lang)}`;

  const descFull = draftDescription(draft);
  const desc = descFull ? escapeHtml(descFull.length > 180 ? `${descFull.slice(0, 180)}…` : descFull) : '—';
  const price = draft?.price ? `<b>${Number(draft.price).toLocaleString('en-US')} UZS</b>` : panelText('notSet', lang);
  const stock = draft?.stock ? `<b>${draft.stock} ${panelText('pcs', lang)}</b>` : panelText('notSet', lang);

  const text =
    `${panelText('title', lang)}\n\n` +
    `🖼 ${panelText('photo', lang)}: ${photo}\n` +
    `📝 ${panelText('description', lang)}: ${desc}\n` +
    `💰 ${panelText('price', lang)}: ${price}\n` +
    `📦 ${panelText('stock', lang)}: ${stock}\n\n` +
    (isDraftComplete(draft) ? panelText('hintReady', lang) : panelText('hintMissing', lang));

  const rows: InlineButton[][] = [];
  if (ready.length) {
    const btn = (ch: PhotoChoice): InlineButton => ({
      text: `${choice === ch ? '✔️ ' : ''}${choiceLabel(ch, lang)}`,
      callback_data: `aiph_d_${sessionId}_${ch}`,
    });
    const photoRow = ready.map((k) => btn(KIND_CODE[k]));
    if (ready.length > 1) photoRow.push(btn('b'));
    photoRow.push(btn('o'));
    rows.push(photoRow);
  }
  rows.push([
    { text: panelText('btnDescription', lang), callback_data: `drf_d_${sessionId}` },
    { text: panelText('btnPrice', lang), callback_data: `drf_p_${sessionId}` },
    { text: panelText('btnStock', lang), callback_data: `drf_s_${sessionId}` },
  ]);
  rows.push([{ text: panelText('btnPublish', lang), callback_data: `publish_${sessionId}` }]);
  rows.push([{ text: getTelegramText(lang, 'btn_cancel'), callback_data: `cancel_${sessionId}` }]);
  return { text, keyboard: { inline_keyboard: rows } };
}

/**
 * Shows the draft panel. With `editMessageId` it is updated in place; otherwise a new panel
 * is sent at the bottom of the chat and the previous one is deleted.
 */
export async function sendDraftPanel(
  supabase: SupabaseClient,
  sessionId: string,
  chatId: string,
  lang: BotLang,
  opts: { editMessageId?: number } = {}
): Promise<void> {
  const { data: session } = await supabase.from('telegram_sessions').select('draft').eq('id', sessionId).maybeSingle();
  if (!session) return;
  const draft = session.draft || {};
  const { text, keyboard } = buildPanel(sessionId, draft, lang);

  if (opts.editMessageId && (await editTelegramMessage(chatId, opts.editMessageId, text, keyboard))) {
    if (draft.panel_msg_id !== opts.editMessageId) {
      await patchJsonRow(supabase, 'telegram_sessions', sessionId, 'draft', (d) => ({ ...d, panel_msg_id: opts.editMessageId }));
    }
    return;
  }

  const res: any = await sendTelegramMessage(chatId, text, keyboard);
  const newId = res?.result?.message_id;
  if (typeof newId !== 'number') return;
  let previous: number | null = null;
  await patchJsonRow(supabase, 'telegram_sessions', sessionId, 'draft', (d) => {
    previous = d.panel_msg_id || null;
    return { ...d, panel_msg_id: newId };
  });
  if (previous && previous !== newId) await deleteTelegramMessage(chatId, previous);
}

/** Puts the draft into an input step and asks for the value; the prompt is removed after input. */
export async function askDraftField(
  supabase: SupabaseClient,
  sessionId: string,
  chatId: string,
  lang: BotLang,
  field: 'description' | 'price' | 'stock'
): Promise<boolean> {
  const step = field === 'description' ? 'AWAITING_DESCRIPTION' : field === 'price' ? 'AWAITING_PRICE' : 'AWAITING_STOCK';
  let current = '';
  const ok = await patchJsonRow(
    supabase,
    'telegram_sessions',
    sessionId,
    'draft',
    (d) => {
      current = draftDescription(d);
      return { ...d };
    },
    { step }
  );
  if (!ok) return false;

  const back: InlineButton[] = [{ text: panelText('btnBack', lang), callback_data: `drf_b_${sessionId}` }];
  let text: string;
  let keyboard: InlineKeyboard;
  if (field === 'description') {
    text = panelText('askDescription', lang, { current: current ? escapeHtml(current) : '—' });
    keyboard = { inline_keyboard: [back] };
  } else if (field === 'price') {
    text = panelText('askPrice', lang);
    keyboard = { inline_keyboard: [back] };
  } else {
    text = panelText('askStock', lang);
    keyboard = {
      inline_keyboard: [
        [
          { text: getTelegramText(lang, 'btn_stock_1'), callback_data: 'set_stock_1' },
          { text: getTelegramText(lang, 'btn_stock_5'), callback_data: 'set_stock_5' },
          { text: getTelegramText(lang, 'btn_stock_10'), callback_data: 'set_stock_10' },
        ],
        back,
      ],
    };
  }
  const res: any = await sendTelegramMessage(chatId, text, keyboard);
  const promptId = res?.result?.message_id;
  if (typeof promptId === 'number') {
    await patchJsonRow(supabase, 'telegram_sessions', sessionId, 'draft', (d) => ({ ...d, prompt_msg_id: promptId }));
  }
  return true;
}

/**
 * Saves a field value, returns the draft to the panel step, removes the input prompt
 * and shows a fresh panel.
 */
export async function saveDraftFieldAndShowPanel(
  supabase: SupabaseClient,
  sessionId: string,
  chatId: string,
  lang: BotLang,
  patch: Record<string, unknown>
): Promise<void> {
  let promptId: number | null = null;
  await patchJsonRow(
    supabase,
    'telegram_sessions',
    sessionId,
    'draft',
    (d) => {
      promptId = d.prompt_msg_id || null;
      return { ...d, ...patch, prompt_msg_id: null };
    },
    { step: 'DRAFT' }
  );
  if (promptId) await deleteTelegramMessage(chatId, promptId);
  await sendDraftPanel(supabase, sessionId, chatId, lang);
}

