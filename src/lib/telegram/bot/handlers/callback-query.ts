/**
 * Inline-button (callback_query) handlers of the Telegram seller bot.
 *
 * Callback data formats:
 *   language_<uz|ru|en>   – change bot language (works for unlinked users too)
 *   cancel_<sessionId>    – cancel the current product draft
 *   set_price_<price>     – accept AI-suggested price
 *   set_stock_<stock>     – quick stock selection
 *   select_cat_<catId>    – manual category selection
 *   publish_<sessionId>   – publish the draft as a product
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerTelegramCallbackQuery,
  clearTelegramInlineKeyboard,
  sendTelegramMessage,
} from '@/lib/telegram/notifier';
import {
  getTelegramText,
  validatePriceInput,
  validateStockInput,
} from '@/lib/telegram/product-draft';
import { resolveTelegramLanguage, saveSellerLanguage } from '../language';
import { buildProductSlug, buildSku, isTelegramApiUrl } from '../product';
import { findUserByChatId, loadStoreAndLanguage } from '../seller';
import {
  advanceSession,
  deleteSellerSessions,
  deleteSession,
  getLatestSession,
  getSessionAi,
} from '../sessions';
import type { BotLang, SellerContext, TelegramSession } from '../types';
import { handleProductCallback } from './my-products';
import {
  DRAFT_CANCELLED,
  LANGUAGE_SELECTOR_KEYBOARD,
  Localized,
  buildPriceStepPromptAndKeyboard,
  buildPublishPreviewAndKeyboard,
  buildStockStepPromptAndKeyboard,
  getAccessDeniedMessage,
  getLocalizedMenu,
} from '../ui';

interface CallbackContext extends SellerContext {
  cbId: string;
  data: string;
  messageId?: number;
}

/** Removes the inline keyboard from the message the button belonged to. */
async function clearButtons(ctx: { chatId: string; messageId?: number }) {
  if (ctx.messageId) {
    await clearTelegramInlineKeyboard(ctx.chatId, ctx.messageId);
  }
}

export async function handleCallbackQuery(supabase: SupabaseClient, cb: any) {
  const cbId: string = cb.id;
  const chatId = String(cb.message?.chat?.id || cb.from?.id);
  const data = String(cb.data || '');
  const messageId: number | undefined = cb.message?.message_id;

  // Language selection handles both linked sellers and unlinked/unknown users
  if (data.startsWith('language_')) {
    await handleLanguageSelection(supabase, { cbId, chatId, data, messageId });
    return;
  }

  // Authenticate Telegram user strictly from chatId (never from callback data)
  const user = await findUserByChatId(supabase, chatId);
  if (!user || user.role !== 'SELLER') {
    await answerTelegramCallbackQuery(cbId, 'Access denied: Registered sellers only', true);
    return;
  }

  const { store, lang } = await loadStoreAndLanguage(supabase, user.id);

  if (!store || store.status !== 'APPROVED') {
    await answerTelegramCallbackQuery(cbId, 'Store is not active', true);
    const storeInactiveTexts: Localized = {
      uz: `⚠️ <b>Do'kon faol emas</b>\n\nSizning "${store?.name || 'Noma\'lum'}" do'koningiz hozirda ${store?.status || 'TASDIQLANMAGAN'}. Mahsulot amallarini bajarish mumkin emas.`,
      ru: `⚠️ <b>Магазин не активен</b>\n\nВаш магазин "${store?.name || 'Неизвестно'}" в настоящее время ${store?.status || 'НЕ ОДОБРЕН'}. Операции с товарами невозможны.`,
      en: `⚠️ <b>Store Inactive</b>\n\nYour store "${store?.name || 'Unknown'}" is currently ${store?.status || 'NOT APPROVED'}. Cannot perform product operations.`,
    };
    await sendTelegramMessage(chatId, storeInactiveTexts[lang]);
    return;
  }

  const ctx: CallbackContext = { supabase, chatId, user, store, lang, cbId, data, messageId };

  if (await handleProductCallback(ctx)) return;
  if (data.startsWith('cancel_')) return handleCancel(ctx);
  if (data.startsWith('set_price_')) return handleSetPrice(ctx);
  if (data.startsWith('set_stock_')) return handleSetStock(ctx);
  if (data.startsWith('select_cat_')) return handleSelectCategory(ctx);
  if (data.startsWith('publish_')) return handlePublish(ctx);

  await answerTelegramCallbackQuery(cbId);
}

async function handleLanguageSelection(
  supabase: SupabaseClient,
  ctx: { cbId: string; chatId: string; data: string; messageId?: number }
) {
  const selectedLang: BotLang = resolveTelegramLanguage(ctx.data.replace('language_', ''));

  let user = null;
  try {
    user = await findUserByChatId(supabase, ctx.chatId);
  } catch (err) {
    console.warn('Language callback: user lookup failed, treating as unlinked:', err);
  }

  if (!user || user.role !== 'SELLER') {
    // UNLINKED user: runtime-only language change, do NOT save to auth.users
    await answerTelegramCallbackQuery(ctx.cbId);
    await clearButtons(ctx);
    await sendTelegramMessage(ctx.chatId, getAccessDeniedMessage(selectedLang), LANGUAGE_SELECTOR_KEYBOARD);
    return;
  }

  // Persist preferred_language in Supabase Auth user_metadata for linked seller
  const saved = await saveSellerLanguage(supabase, user.id, selectedLang);
  if (!saved) {
    await answerTelegramCallbackQuery(ctx.cbId, 'Failed to update language. Please try again.', true);
    return;
  }

  await answerTelegramCallbackQuery(ctx.cbId);
  await clearButtons(ctx);

  const confirmMsgs: Localized = {
    uz: '✅ <b>Til o‘zgartirildi: O‘zbekcha</b>',
    ru: '✅ <b>Язык изменён: Русский</b>',
    en: '✅ <b>Language changed: English</b>',
  };
  await sendTelegramMessage(ctx.chatId, confirmMsgs[selectedLang], getLocalizedMenu(selectedLang));
}

async function handleCancel(ctx: CallbackContext) {
  await answerTelegramCallbackQuery(ctx.cbId, getTelegramText(ctx.lang, 'alert_draft_cancelled'));
  await clearButtons(ctx);
  await deleteSellerSessions(ctx.supabase, ctx.chatId, ctx.store.id);
  await sendTelegramMessage(ctx.chatId, DRAFT_CANCELLED[ctx.lang], getLocalizedMenu(ctx.lang));
}

async function handleSetPrice(ctx: CallbackContext) {
  const { lang } = ctx;
  const priceRes = validatePriceInput(ctx.data.replace('set_price_', ''), lang);

  if (!priceRes.valid || !priceRes.price || priceRes.price < 1000) {
    await clearButtons(ctx);
    await answerTelegramCallbackQuery(ctx.cbId, getTelegramText(lang, 'alert_invalid_price'), true);
    return;
  }

  const session = await getLatestSession(ctx.supabase, ctx.chatId, ctx.store.id);
  if (!session) {
    await answerTelegramCallbackQuery(ctx.cbId, getTelegramText(lang, 'alert_no_draft'), true);
    return;
  }

  await answerTelegramCallbackQuery(
    ctx.cbId,
    getTelegramText(lang, 'alert_price_set', { price: priceRes.price.toLocaleString() })
  );
  await clearButtons(ctx);

  await advanceSession(ctx.supabase, session, 'AWAITING_STOCK', { price: priceRes.price });

  const { promptText, keyboard } = buildStockStepPromptAndKeyboard(priceRes.price, session.id, lang);
  await sendTelegramMessage(ctx.chatId, promptText, keyboard);
}

async function handleSetStock(ctx: CallbackContext) {
  const { lang } = ctx;
  const stockRes = validateStockInput(ctx.data.replace('set_stock_', ''), lang);

  if (!stockRes.valid || !stockRes.stock) {
    await answerTelegramCallbackQuery(ctx.cbId, getTelegramText(lang, 'alert_invalid_stock'), true);
    return;
  }

  const session = await getLatestSession(ctx.supabase, ctx.chatId, ctx.store.id);
  if (!session || !session.draft?.price) {
    await answerTelegramCallbackQuery(ctx.cbId, getTelegramText(lang, 'alert_enter_price_first'), true);
    return;
  }

  await answerTelegramCallbackQuery(ctx.cbId, getTelegramText(lang, 'alert_stock_set', { stock: stockRes.stock }));
  await clearButtons(ctx);

  await advanceSession(ctx.supabase, session, 'AWAITING_PUBLICATION_CONFIRMATION', { stock: stockRes.stock });

  const { promptText, keyboard } = buildPublishPreviewAndKeyboard(session, stockRes.stock, lang);
  await sendTelegramMessage(ctx.chatId, promptText, keyboard);
}

async function handleSelectCategory(ctx: CallbackContext) {
  const { lang } = ctx;
  const catId = ctx.data.replace('select_cat_', '');
  const { data: cat } = await ctx.supabase
    .from('categories')
    .select('id, name, slug')
    .eq('id', catId)
    .maybeSingle();

  if (!cat) {
    await answerTelegramCallbackQuery(ctx.cbId, getTelegramText(lang, 'alert_category_not_found'), true);
    return;
  }

  const session = await getLatestSession(ctx.supabase, ctx.chatId, ctx.store.id);
  if (!session) {
    await answerTelegramCallbackQuery(ctx.cbId, getTelegramText(lang, 'alert_session_expired'), true);
    return;
  }

  await answerTelegramCallbackQuery(ctx.cbId, `📁 ${cat.name}`);
  await clearButtons(ctx);

  await advanceSession(ctx.supabase, session, 'AWAITING_PRICE', {
    category_id: cat.id,
    category_name: cat.name,
  });

  const { promptText, keyboard } = buildPriceStepPromptAndKeyboard(
    getSessionAi(session),
    cat.name,
    session.draft?.brand_name || null,
    session.id,
    lang
  );
  await sendTelegramMessage(ctx.chatId, promptText, keyboard);
}

async function handlePublish(ctx: CallbackContext) {
  const { supabase, chatId, store, lang, cbId } = ctx;
  const sessionId = ctx.data.replace('publish_', '');

  // Security check: Atomic lock on session to guarantee idempotency and prevent duplicate inserts
  const { data: lockedSession, error: lockErr } = await supabase
    .from('telegram_sessions')
    .update({ step: 'PUBLISHING', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('seller_telegram_id', chatId)
    .eq('store_id', store.id)
    .eq('step', 'AWAITING_PUBLICATION_CONFIRMATION')
    .select('*')
    .maybeSingle();

  if (lockErr || !lockedSession) {
    // Check if product was already created previously (idempotent callback repeat)
    const { data: existingProd } = await supabase
      .from('products')
      .select('id, title')
      .eq('store_id', store.id)
      .eq('ai_metadata->>telegram_session_id', sessionId)
      .maybeSingle();

    if (existingProd) {
      await answerTelegramCallbackQuery(cbId, getTelegramText(lang, 'alert_already_published'), true);
      await sendTelegramMessage(
        chatId,
        getTelegramText(lang, 'msg_already_published', { title: existingProd.title }),
        getLocalizedMenu(lang)
      );
      return;
    }

    await answerTelegramCallbackQuery(cbId, getTelegramText(lang, 'alert_session_expired'), true);
    return;
  }

  // Acknowledge promptly and remove buttons so Publish cannot be repeatedly tapped
  await answerTelegramCallbackQuery(cbId, getTelegramText(lang, 'alert_publishing'));
  await clearButtons(ctx);

  const session = lockedSession as TelegramSession;
  const draft = session.draft || {};
  const ai = getSessionAi(session);
  const price = draft.price;
  const stock = draft.stock;
  const categoryId = draft.category_id;
  const brandId = draft.brand_id || null;
  const imageUrl: string | undefined = session.processed_image_url || draft.image;

  const releaseLock = () =>
    supabase
      .from('telegram_sessions')
      .update({ step: 'AWAITING_PUBLICATION_CONFIRMATION' })
      .eq('id', sessionId);

  if (!price || !stock || !categoryId || !imageUrl) {
    await releaseLock();
    await answerTelegramCallbackQuery(cbId, getTelegramText(lang, 'msg_incomplete_draft'), true);
    await sendTelegramMessage(chatId, getTelegramText(lang, 'msg_incomplete_draft'));
    return;
  }

  if (isTelegramApiUrl(imageUrl)) {
    console.error('CRITICAL SECURITY: Refusing product publication with Telegram Bot API URL');
    await deleteSession(supabase, sessionId);
    await answerTelegramCallbackQuery(cbId, 'Image security error', true);
    await sendTelegramMessage(chatId, '❌ Security error: Invalid image source. Please upload the photo again.');
    return;
  }

  const title = ai.title || 'Fashion Item';
  const { data: newProduct, error: insertErr } = await supabase
    .from('products')
    .insert({
      store_id: store.id,
      category_id: categoryId,
      brand_id: brandId,
      title,
      slug: buildProductSlug(title),
      description: ai.description || '',
      price,
      currency: 'UZS',
      sku: buildSku(),
      stock_quantity: stock,
      sizes: ['One Size'],
      colors: ai.color ? [ai.color] : [],
      material: ai.material || null,
      gender: ai.gender || 'UNISEX',
      style: ai.style || null,
      occasion: ai.occasion || null,
      season: ai.season || null,
      tags: Array.isArray(ai.tags) ? ai.tags : [],
      original_image: imageUrl,
      processed_images: [imageUrl],
      ai_metadata: {
        ...ai,
        telegram_session_id: sessionId,
        studioProcessed: true,
        publishedVia: 'TELEGRAM_BOT',
      },
      status: 'ACTIVE',
    })
    .select('id, title, slug, price, stock_quantity')
    .single();

  if (insertErr || !newProduct) {
    console.error('Failed to insert product from telegram session:', insertErr);
    await releaseLock();
    await answerTelegramCallbackQuery(cbId, getTelegramText(lang, 'msg_publish_db_error'), true);
    await sendTelegramMessage(chatId, getTelegramText(lang, 'msg_publish_db_error'));
    return;
  }

  await deleteSession(supabase, sessionId);
  await answerTelegramCallbackQuery(cbId, getTelegramText(lang, 'alert_published_live'));

  const price$ = newProduct.price.toLocaleString();
  const publishSuccessMsgs: Localized = {
    ru: `🎉 <b>Товар успешно опубликован!</b>\n\n` +
        `Товар <b>"${newProduct.title}"</b> теперь активен в магазине <b>${store.name}</b>.\n\n` +
        `💰 Цена: <b>${price$} UZS</b>\n` +
        `📦 В наличии: <b>${newProduct.stock_quantity} шт.</b>\n` +
        `📁 Статус: <b>ACTIVE</b>\n\n` +
        `Покупатели уже могут найти и заказать этот товар на TrendMall.`,
    uz: `🎉 <b>Mahsulot muvaffaqiyatli e'lon qilindi!</b>\n\n` +
        `<b>"${newProduct.title}"</b> endi <b>${store.name}</b> do'konida faol.\n\n` +
        `💰 Narxi: <b>${price$} UZS</b>\n` +
        `📦 Omborda: <b>${newProduct.stock_quantity} dona</b>\n` +
        `📁 Holati: <b>ACTIVE</b>\n\n` +
        `Xaridorlar ushbu mahsulotni TrendMall'da xarid qilishlari mumkin.`,
    en: `🎉 <b>Product Published Successfully!</b>\n\n` +
        `Your product <b>"${newProduct.title}"</b> is now live in <b>${store.name}</b>.\n\n` +
        `💰 Price: <b>${price$} UZS</b>\n` +
        `📦 Available Stock: <b>${newProduct.stock_quantity} pcs</b>\n` +
        `📁 Status: <b>ACTIVE</b>\n\n` +
        `Customers can now discover and purchase this item on TrendMall.`,
  };

  await sendTelegramMessage(chatId, publishSuccessMsgs[lang], getLocalizedMenu(lang));
}
