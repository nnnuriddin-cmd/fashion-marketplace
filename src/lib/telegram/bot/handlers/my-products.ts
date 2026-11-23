/**
 * "📦 My Products": paginated product list, product card, and quick edits from Telegram
 * (price, stock, hide/show), plus links to the seller dashboard and the product page.
 *
 * Callback data (all scoped to the seller's own store):
 *   prod_list_<page>             – show list page
 *   prod_view_<productId>_<page> – show product card
 *   prod_toggle_<productId>_<page> – hide (ARCHIVED) / show (ACTIVE)
 *   prod_price_<productId>       – start price edit
 *   prod_stock_<productId>       – start stock edit
 *   prod_editcancel_<productId>  – cancel the edit
 */
import crypto from 'crypto';
import {
  answerTelegramCallbackQuery,
  sendTelegramMessage,
} from '@/lib/telegram/notifier';
import { validatePriceInput, validateStockInput } from '@/lib/telegram/product-draft';
import { createSession, deleteEditSessions, deleteSession } from '../sessions';
import {
  deleteTelegramMessage,
  editTelegramCaption,
  editTelegramMessage,
  sendTelegramPhoto,
} from '../telegram-api';
import { getProductPhotoUrl, loadProductPhotoJpeg } from '../product-photo';
import { isAiPhotoEnabled } from '@/lib/ai/studio-photos';
import { startProductStudioPhotos } from '../studio-photos';
import type { BotLang, InlineButton, InlineKeyboard, SellerContext, TelegramSession } from '../types';
import { Localized, SELLER_DASHBOARD_URL, SITE_URL, getLocalizedMenu } from '../ui';

const PAGE_SIZE = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProductRow {
  id: string;
  title: string;
  slug: string;
  price: number | string;
  stock_quantity: number | null;
  status: string;
  processed_images?: unknown;
  original_image?: string | null;
}

const PRODUCT_COLUMNS = 'id, title, slug, price, stock_quantity, status, processed_images, original_image';

interface ProductCallbackContext extends SellerContext {
  cbId: string;
  data: string;
  messageId?: number;
  /** The pressed button belongs to a photo message (product card with image). */
  isPhotoMessage?: boolean;
}

/** One bot "screen": text (or photo caption) + keyboard, optionally with a product photo. */
interface Screen {
  text: string;
  keyboard: InlineKeyboard;
  photoUrl?: string | null;
}

const T = {
  listHeader: {
    uz: '📦 <b>{store}</b> — mahsulotlar: <b>{count}</b>',
    ru: '📦 <b>{store}</b> — товаров: <b>{count}</b>',
    en: '📦 <b>{store}</b> — products: <b>{count}</b>',
  },
  page: { uz: 'Sahifa {page}/{pages}', ru: 'Страница {page}/{pages}', en: 'Page {page}/{pages}' },
  pickHint: {
    uz: 'Tahrirlash uchun mahsulot raqamini bosing.',
    ru: 'Нажмите номер товара, чтобы открыть и изменить его.',
    en: 'Tap a product number to open and edit it.',
  },
  empty: {
    uz: "📦 <b>{store}</b> do'konida hali mahsulot yo'q.\n\n➕ Mahsulot qo'shish tugmasini bosing yoki rasm yuboring.",
    ru: '📦 В магазине <b>{store}</b> пока нет товаров.\n\nНажмите ➕ Добавить товар или отправьте фото.',
    en: '📦 <b>{store}</b> has no products yet.\n\nTap ➕ Add Product or send a photo.',
  },
  pcs: { uz: 'dona', ru: 'шт.', en: 'pcs' },
  price: { uz: 'Narxi', ru: 'Цена', en: 'Price' },
  stock: { uz: 'Omborda', ru: 'В наличии', en: 'In stock' },
  status: { uz: 'Holati', ru: 'Статус', en: 'Status' },
  active: { uz: '✅ Saytda faol', ru: '✅ Активен на сайте', en: '✅ Live on site' },
  hidden: { uz: '🙈 Yashirilgan', ru: '🙈 Скрыт', en: '🙈 Hidden' },
  btnDashboard: { uz: '🌐 Shaxsiy kabinet', ru: '🌐 Личный кабинет', en: '🌐 Seller dashboard' },
  btnEditPrice: { uz: '✏️ Narx', ru: '✏️ Цена', en: '✏️ Price' },
  btnEditStock: { uz: '📦 Miqdor', ru: '📦 Количество', en: '📦 Stock' },
  btnHide: { uz: '🙈 Yashirish', ru: '🙈 Скрыть', en: '🙈 Hide' },
  btnShow: { uz: '✅ Faollashtirish', ru: '✅ Показать', en: '✅ Show' },
  btnOpenSite: { uz: "🔗 Saytda ko'rish", ru: '🔗 Открыть на сайте', en: '🔗 View on site' },
  btnEnhance: { uz: '✨ Rasmni yaxshilash (AI)', ru: '✨ Улучшить фото (AI)', en: '✨ Enhance photo (AI)' },
  btnBack: { uz: "⬅️ Ro'yxatga qaytish", ru: '⬅️ К списку', en: '⬅️ Back to list' },
  btnCancel: { uz: '❌ Bekor qilish', ru: '❌ Отмена', en: '❌ Cancel' },
  notFound: { uz: 'Mahsulot topilmadi', ru: 'Товар не найден', en: 'Product not found' },
  hiddenAlert: { uz: 'Mahsulot yashirildi', ru: 'Товар скрыт', en: 'Product hidden' },
  shownAlert: { uz: 'Mahsulot saytda faol', ru: 'Товар снова на сайте', en: 'Product is live' },
  askPrice: {
    uz: '✏️ <b>{title}</b>\n\nHozirgi narx: <b>{value} UZS</b>\nYangi narxni so\'mda yuboring (masalan: <code>450000</code>).',
    ru: '✏️ <b>{title}</b>\n\nТекущая цена: <b>{value} UZS</b>\nОтправьте новую цену в сумах (например: <code>450000</code>).',
    en: '✏️ <b>{title}</b>\n\nCurrent price: <b>{value} UZS</b>\nSend the new price in UZS (e.g. <code>450000</code>).',
  },
  askStock: {
    uz: '📦 <b>{title}</b>\n\nHozirgi miqdor: <b>{value}</b>\nYangi miqdorni yuboring (sotilib ketgan bo\'lsa <code>0</code>).',
    ru: '📦 <b>{title}</b>\n\nТекущее количество: <b>{value}</b>\nОтправьте новое количество (<code>0</code>, если товар закончился).',
    en: '📦 <b>{title}</b>\n\nCurrent stock: <b>{value}</b>\nSend the new quantity (<code>0</code> if sold out).',
  },
  priceUpdated: { uz: '✅ Narx yangilandi', ru: '✅ Цена обновлена', en: '✅ Price updated' },
  stockUpdated: { uz: '✅ Miqdor yangilandi', ru: '✅ Количество обновлено', en: '✅ Stock updated' },
  editCancelled: { uz: 'Tahrirlash bekor qilindi', ru: 'Изменение отменено', en: 'Edit cancelled' },
  updateFailed: {
    uz: "⚠️ Saqlab bo'lmadi. Qaytadan urinib ko'ring.",
    ru: '⚠️ Не удалось сохранить. Попробуйте ещё раз.',
    en: '⚠️ Could not save. Please try again.',
  },
} satisfies Record<string, Localized>;

function t(key: keyof typeof T, lang: BotLang, vars: Record<string, string | number> = {}): string {
  let text: string = T[key][lang] || T[key].uz;
  for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const formatPrice = (p: number | string) => Number(p || 0).toLocaleString('en-US');

function dashboardRow(lang: BotLang): InlineButton[] {
  return [{ text: t('btnDashboard', lang), url: SELLER_DASHBOARD_URL }];
}

async function fetchOwnProduct(ctx: SellerContext, productId: string): Promise<ProductRow | null> {
  if (!UUID_RE.test(productId)) return null;
  const { data } = await ctx.supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('id', productId)
    .eq('store_id', ctx.store.id)
    .maybeSingle();
  return data;
}

/**
 * Shows a screen, keeping the chat tidy:
 * - same kind of message (text→text, photo→photo): edited in place;
 * - different kind (list↔photo card): new message is sent, then the old one is deleted.
 * A photo that cannot be loaded falls back to a text card.
 */
async function render(
  ctx: SellerContext,
  current: { messageId?: number; isPhoto?: boolean },
  screen: Screen
) {
  const { chatId } = ctx;
  const { messageId, isPhoto } = current;

  if (screen.photoUrl) {
    if (messageId && isPhoto && (await editTelegramCaption(chatId, messageId, screen.text, screen.keyboard))) return;
    const photo = await loadProductPhotoJpeg(screen.photoUrl);
    if (photo && (await sendTelegramPhoto(chatId, photo, screen.text, screen.keyboard))) {
      if (messageId) await deleteTelegramMessage(chatId, messageId);
      return;
    }
  }

  if (messageId && !isPhoto && (await editTelegramMessage(chatId, messageId, screen.text, screen.keyboard))) return;
  await sendTelegramMessage(chatId, screen.text, screen.keyboard);
  if (messageId && isPhoto) await deleteTelegramMessage(chatId, messageId);
}

const fromCallback = (ctx: ProductCallbackContext) => ({ messageId: ctx.messageId, isPhoto: ctx.isPhotoMessage });

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

async function buildListView(ctx: SellerContext, requestedPage: number) {
  const { supabase, store, lang } = ctx;

  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id);
  const total = count ?? 0;

  if (total === 0) {
    return {
      text: t('empty', lang, { store: escapeHtml(store.name) }),
      keyboard: { inline_keyboard: [dashboardRow(lang)] } as InlineKeyboard,
    };
  }

  const pages = Math.ceil(total / PAGE_SIZE);
  const page = Math.min(Math.max(0, requestedPage), pages - 1);

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) throw error;
  const products = (data || []) as ProductRow[];

  const lines = products.map((p, i) => {
    const icon = p.status === 'ACTIVE' ? '✅' : '🙈';
    return (
      `<b>${page * PAGE_SIZE + i + 1}.</b> ${icon} ${escapeHtml(p.title)}\n` +
      `     💰 ${formatPrice(p.price)} UZS · 📦 ${p.stock_quantity ?? 0} ${t('pcs', lang)}`
    );
  });

  const text =
    `${t('listHeader', lang, { store: escapeHtml(store.name), count: total })}\n\n` +
    `${lines.join('\n\n')}\n\n` +
    `<i>${t('pickHint', lang)}</i>` +
    (pages > 1 ? `\n${t('page', lang, { page: page + 1, pages })}` : '');

  const numberRow: InlineButton[] = products.map((p, i) => ({
    text: String(page * PAGE_SIZE + i + 1),
    callback_data: `prod_view_${p.id}_${page}`,
  }));
  const navRow: InlineButton[] = [];
  if (page > 0) navRow.push({ text: '◀️', callback_data: `prod_list_${page - 1}` });
  if (page < pages - 1) navRow.push({ text: '▶️', callback_data: `prod_list_${page + 1}` });

  const rows: InlineButton[][] = [numberRow];
  if (navRow.length) rows.push(navRow);
  rows.push(dashboardRow(lang));

  return { text, keyboard: { inline_keyboard: rows } };
}

/** Reply-keyboard "📦 My Products" button. */
export async function handleMyProductsMenu(ctx: SellerContext) {
  const { text, keyboard } = await buildListView(ctx, 0);
  await sendTelegramMessage(ctx.chatId, text, keyboard);
}

// ---------------------------------------------------------------------------
// Product card
// ---------------------------------------------------------------------------

function buildCardView(product: ProductRow, page: number, lang: BotLang): Screen {
  const isActive = product.status === 'ACTIVE';
  const text =
    `🏷 <b>${escapeHtml(product.title)}</b>\n\n` +
    `💰 ${t('price', lang)}: <b>${formatPrice(product.price)} UZS</b>\n` +
    `📦 ${t('stock', lang)}: <b>${product.stock_quantity ?? 0} ${t('pcs', lang)}</b>\n` +
    `📁 ${t('status', lang)}: <b>${isActive ? t('active', lang) : t('hidden', lang)}</b>`;

  const rows: InlineButton[][] = [
    [
      { text: t('btnEditPrice', lang), callback_data: `prod_price_${product.id}` },
      { text: t('btnEditStock', lang), callback_data: `prod_stock_${product.id}` },
    ],
    [
      isActive
        ? { text: t('btnHide', lang), callback_data: `prod_toggle_${product.id}_${page}` }
        : { text: t('btnShow', lang), callback_data: `prod_toggle_${product.id}_${page}` },
    ],
  ];
  if (isAiPhotoEnabled()) {
    rows.push([{ text: t('btnEnhance', lang), callback_data: `prod_aiphoto_${product.id}` }]);
  }
  if (isActive) {
    rows.push([{ text: t('btnOpenSite', lang), url: `${SITE_URL}/product/${encodeURIComponent(product.slug)}` }]);
  }
  rows.push([{ text: t('btnBack', lang), callback_data: `prod_list_${page}` }]);
  rows.push(dashboardRow(lang));

  return { text, keyboard: { inline_keyboard: rows }, photoUrl: getProductPhotoUrl(product) };
}

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------

/** Handles `prod_*` callbacks. Returns true if handled. */
export async function handleProductCallback(ctx: ProductCallbackContext): Promise<boolean> {
  const { data, cbId, lang } = ctx;
  if (!data.startsWith('prod_')) return false;

  // prod_list_<page>
  let m = data.match(/^prod_list_(\d+)$/);
  if (m) {
    await answerTelegramCallbackQuery(cbId);
    await render(ctx, fromCallback(ctx), await buildListView(ctx, Number(m[1])));
    return true;
  }

  // prod_view_<id>_<page>
  m = data.match(/^prod_view_([0-9a-f-]{36})_(\d+)$/i);
  if (m) {
    const product = await fetchOwnProduct(ctx, m[1]);
    if (!product) {
      await answerTelegramCallbackQuery(cbId, t('notFound', lang), true);
      return true;
    }
    await answerTelegramCallbackQuery(cbId);
    await render(ctx, fromCallback(ctx), buildCardView(product, Number(m[2]), lang));
    return true;
  }

  // prod_toggle_<id>_<page>
  m = data.match(/^prod_toggle_([0-9a-f-]{36})_(\d+)$/i);
  if (m) {
    const product = await fetchOwnProduct(ctx, m[1]);
    if (!product) {
      await answerTelegramCallbackQuery(cbId, t('notFound', lang), true);
      return true;
    }
    const newStatus = product.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    const { error } = await ctx.supabase
      .from('products')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', product.id)
      .eq('store_id', ctx.store.id);
    if (error) {
      console.error('Failed to toggle product status:', error);
      await answerTelegramCallbackQuery(cbId, t('updateFailed', lang), true);
      return true;
    }
    await answerTelegramCallbackQuery(cbId, newStatus === 'ACTIVE' ? t('shownAlert', lang) : t('hiddenAlert', lang));
    await render(ctx, fromCallback(ctx), buildCardView({ ...product, status: newStatus }, Number(m[2]), lang));
    return true;
  }

  // prod_aiphoto_<id>: generate AI studio photos for an existing product
  m = data.match(/^prod_aiphoto_([0-9a-f-]{36})$/i);
  if (m) {
    const product = await fetchOwnProduct(ctx, m[1]);
    if (!product) {
      await answerTelegramCallbackQuery(cbId, t('notFound', lang), true);
      return true;
    }
    await startProductStudioPhotos(ctx, product.id, cbId);
    return true;
  }

  // prod_price_<id> / prod_stock_<id>
  m = data.match(/^prod_(price|stock)_([0-9a-f-]{36})$/i);
  if (m) {
    const field = m[1] as 'price' | 'stock';
    const product = await fetchOwnProduct(ctx, m[2]);
    if (!product) {
      await answerTelegramCallbackQuery(cbId, t('notFound', lang), true);
      return true;
    }
    await answerTelegramCallbackQuery(cbId);

    // Only one edit at a time; an unfinished add-product draft is left untouched
    await deleteEditSessions(ctx.supabase, ctx.chatId, ctx.store.id);
    const { error } = await createSession(ctx.supabase, {
      id: crypto.randomUUID(),
      chatId: ctx.chatId,
      storeId: ctx.store.id,
      step: field === 'price' ? 'EDITING_PRICE' : 'EDITING_STOCK',
      draft: { product_id: product.id },
    });
    if (error) throw error;

    const prompt = field === 'price'
      ? t('askPrice', lang, { title: escapeHtml(product.title), value: formatPrice(product.price) })
      : t('askStock', lang, { title: escapeHtml(product.title), value: product.stock_quantity ?? 0 });
    await sendTelegramMessage(ctx.chatId, prompt, {
      inline_keyboard: [[{ text: t('btnCancel', lang), callback_data: `prod_editcancel_${product.id}` }]],
    });
    return true;
  }

  // prod_editcancel_<id>
  m = data.match(/^prod_editcancel_([0-9a-f-]{36})$/i);
  if (m) {
    // The product card above the prompt is unchanged, so just remove the prompt
    await deleteEditSessions(ctx.supabase, ctx.chatId, ctx.store.id);
    await answerTelegramCallbackQuery(cbId, t('editCancelled', lang));
    if (ctx.messageId) await deleteTelegramMessage(ctx.chatId, ctx.messageId);
    return true;
  }

  await answerTelegramCallbackQuery(cbId);
  return true;
}

// ---------------------------------------------------------------------------
// Edit text input (EDITING_PRICE / EDITING_STOCK sessions)
// ---------------------------------------------------------------------------

export async function handleProductEditInput(ctx: SellerContext, session: TelegramSession, text: string) {
  const { supabase, chatId, store, lang } = ctx;
  const product = await fetchOwnProduct(ctx, String(session.draft?.product_id || ''));
  if (!product) {
    await deleteSession(supabase, session.id);
    await sendTelegramMessage(chatId, `⚠️ ${t('notFound', lang)}`, getLocalizedMenu(lang));
    return;
  }

  let update: { price: number } | { stock_quantity: number };
  let doneKey: 'priceUpdated' | 'stockUpdated';

  if (session.step === 'EDITING_PRICE') {
    const res = validatePriceInput(text, lang);
    if (!res.valid || !res.price) {
      await sendTelegramMessage(chatId, `⚠️ ${res.error || ''}`.trim());
      return;
    }
    update = { price: res.price };
    doneKey = 'priceUpdated';
  } else {
    // 0 is allowed here: it marks the item as sold out
    const isZero = /^0+$/.test(text.replace(/\s/g, ''));
    const res = isZero ? { valid: true, stock: 0 } : validateStockInput(text, lang);
    if (!res.valid || res.stock === undefined) {
      await sendTelegramMessage(chatId, `⚠️ ${'error' in res && res.error ? res.error : ''}`.trim());
      return;
    }
    update = { stock_quantity: res.stock };
    doneKey = 'stockUpdated';
  }

  const { error } = await supabase
    .from('products')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', product.id)
    .eq('store_id', store.id);
  if (error) {
    console.error('Failed to update product from Telegram:', error);
    await sendTelegramMessage(chatId, t('updateFailed', lang));
    return;
  }

  await deleteSession(supabase, session.id);
  const card = buildCardView({ ...product, ...update }, 0, lang);
  await render(ctx, {}, { ...card, text: `${t(doneKey, lang)}\n\n${card.text}` });
}
