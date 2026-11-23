/**
 * Text input for the active draft session (state machine):
 *   AWAITING_PRICE   → AWAITING_STOCK
 *   AWAITING_STOCK   → AWAITING_PUBLICATION_CONFIRMATION
 *   AWAITING_DETAILS → product published directly (manual fallback when AI failed)
 */
import { sendTelegramMessage } from '@/lib/telegram/notifier';
import { matchCategory, validatePriceInput, validateStockInput } from '@/lib/telegram/product-draft';
import { buildProductSlug, buildSku } from '../product';
import { advanceSession, deleteSession, getEditSession, getLatestSession } from '../sessions';
import { handleProductEditInput } from './my-products';
import type { SellerContext, TelegramSession } from '../types';
import {
  Localized,
  buildPublishPreviewAndKeyboard,
  buildStockStepPromptAndKeyboard,
  getLocalizedMenu,
} from '../ui';

/** Handles text for the active draft. Returns true if the message was handled. */
export async function handleDraftInput(ctx: SellerContext, text: string): Promise<boolean> {
  // A pending edit from "My Products" takes priority over an unfinished add-product draft
  const editSession = text ? await getEditSession(ctx.supabase, ctx.chatId, ctx.store.id) : null;
  if (editSession) {
    await handleProductEditInput(ctx, editSession, text);
    return true;
  }

  const session = await getLatestSession(ctx.supabase, ctx.chatId, ctx.store.id);
  if (!session) return false;

  switch (session.step) {
    case 'AWAITING_PRICE':
      await handlePriceInput(ctx, session, text);
      return true;
    case 'AWAITING_STOCK':
      await handleStockInput(ctx, session, text);
      return true;
    case 'AWAITING_DETAILS':
      if (!text.includes('|')) return false;
      await handleManualDetailsInput(ctx, session, text);
      return true;
    default:
      return false;
  }
}

async function handlePriceInput(ctx: SellerContext, session: TelegramSession, text: string) {
  const { chatId, lang } = ctx;
  const priceRes = validatePriceInput(text, lang);

  if (!priceRes.valid || !priceRes.price) {
    const header: Localized = {
      uz: "⚠️ <b>Noto'g'ri narx</b>",
      ru: '⚠️ <b>Неверная цена</b>',
      en: '⚠️ <b>Invalid Price</b>',
    };
    const fallbackError: Localized = {
      uz: "Iltimos, so'mda to'g'ri narx kiriting.",
      ru: 'Пожалуйста, введите корректную цену в UZS.',
      en: 'Please enter a valid price in UZS.',
    };
    const example: Localized = {
      uz: "*Misol: <code>450000</code> yoki <code>450 000</code>*\n*Bekor qilish uchun /cancel yuboring*",
      ru: '*Пример: <code>450000</code> или <code>450 000</code>*\n*Для отмены отправьте /cancel*',
      en: '*Example: <code>450000</code> or <code>450 000</code>*\n*To cancel, send /cancel*',
    };
    await sendTelegramMessage(
      chatId,
      `${header[lang]}\n\n${priceRes.error || fallbackError[lang]}\n\n${example[lang]}`
    );
    return;
  }

  await advanceSession(ctx.supabase, session, 'AWAITING_STOCK', { price: priceRes.price });

  const { promptText, keyboard } = buildStockStepPromptAndKeyboard(priceRes.price, session.id, lang);
  await sendTelegramMessage(chatId, promptText, keyboard);
}

async function handleStockInput(ctx: SellerContext, session: TelegramSession, text: string) {
  const { chatId, lang } = ctx;
  const stockRes = validateStockInput(text, lang);

  if (!stockRes.valid || !stockRes.stock) {
    const header: Localized = {
      uz: "⚠️ <b>Noto'g'ri miqdor</b>",
      ru: '⚠️ <b>Неверное количество</b>',
      en: '⚠️ <b>Invalid Stock</b>',
    };
    const fallbackError: Localized = {
      uz: 'Iltimos, butun son kiriting.',
      ru: 'Пожалуйста, введите целое число.',
      en: 'Please enter a valid whole number.',
    };
    const example: Localized = {
      uz: "*Misol: <code>5</code> yoki <code>10</code>*\n*Bekor qilish uchun /cancel yuboring*",
      ru: '*Пример: <code>5</code> или <code>10</code>*\n*Для отмены отправьте /cancel*',
      en: '*Example: <code>5</code> or <code>10</code>*\n*To cancel, send /cancel*',
    };
    await sendTelegramMessage(
      chatId,
      `${header[lang]}\n\n${stockRes.error || fallbackError[lang]}\n\n${example[lang]}`
    );
    return;
  }

  await advanceSession(ctx.supabase, session, 'AWAITING_PUBLICATION_CONFIRMATION', { stock: stockRes.stock });

  const { promptText, keyboard } = buildPublishPreviewAndKeyboard(session, stockRes.stock, lang);
  await sendTelegramMessage(chatId, promptText, keyboard);
}

/** Manual fallback: `Title | price | stock | description` (stock and description optional). */
async function handleManualDetailsInput(ctx: SellerContext, session: TelegramSession, text: string) {
  const { supabase, chatId, store, lang } = ctx;
  const parts = text.split('|').map((p) => p.trim());
  let title = '';
  let priceRaw = '';
  let stockRaw = '1';
  let description = '';

  if (parts.length >= 4) {
    [title, priceRaw, stockRaw, description] = parts;
  } else if (parts.length === 3) {
    [title, priceRaw, description] = parts;
  } else {
    [title, priceRaw] = parts;
  }

  const priceRes = validatePriceInput(priceRaw);
  const stockRes = validateStockInput(stockRaw);

  if (!title || !priceRes.valid || !priceRes.price || !stockRes.valid || !stockRes.stock) {
    await sendTelegramMessage(
      chatId,
      '⚠️ <b>Invalid Details Format</b>\n\nPlease reply in format:\n<code>Title | price | stock | description</code>\n\n*Example: Silk Blouse | 350000 | 5 | Luxury 100% mulberry silk*'
    );
    return;
  }

  // Map category deterministically from available categories
  const { data: categories } = await supabase.from('categories').select('*');
  const mappedCat = matchCategory(title, 'UNISEX', categories || []) || (categories && categories[0]);

  if (!mappedCat) {
    await sendTelegramMessage(chatId, '⚠️ No category available in database. Please contact support.');
    return;
  }

  const imageUrl = session.processed_image_url || session.draft?.image;
  if (!imageUrl) {
    await sendTelegramMessage(chatId, '⚠️ No active photo found for this draft. Please send a photo first.');
    return;
  }

  const { data: newProd, error: prodErr } = await supabase
    .from('products')
    .insert({
      store_id: store.id,
      category_id: mappedCat.id,
      title,
      slug: buildProductSlug(title),
      description: description || '',
      price: priceRes.price,
      stock_quantity: stockRes.stock,
      currency: 'UZS',
      sku: buildSku(),
      original_image: imageUrl,
      processed_images: [imageUrl],
      status: 'ACTIVE',
      sizes: ['One Size'],
      colors: [],
      tags: [mappedCat.name.toLowerCase()],
      ai_metadata: { publishedVia: 'TELEGRAM_BOT_MANUAL' },
    })
    .select('id, title, slug, price, stock_quantity')
    .single();

  if (prodErr || !newProd) {
    console.error('Failed to manually create product:', prodErr);
    await sendTelegramMessage(chatId, '⚠️ Database error while publishing. Please try again.');
    return;
  }

  await deleteSession(supabase, session.id);
  await sendTelegramMessage(
    chatId,
    `🎉 <b>${newProd.title}</b> published to <b>${store.name}</b> live!\n\n` +
    `💰 Price: <b>${newProd.price.toLocaleString()} UZS</b>\n` +
    `📦 Stock: <b>${newProd.stock_quantity} pcs</b>\n` +
    `📁 Status: <b>ACTIVE</b>`,
    getLocalizedMenu(lang)
  );
}
