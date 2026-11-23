/**
 * Commands and reply-keyboard menu buttons for an authenticated, APPROVED seller:
 * /start, /cancel, ➕ Add Product, 📦 My Products, 🌐 Language.
 */
import crypto from 'crypto';
import { sendTelegramMessage } from '@/lib/telegram/notifier';
import { createSession, deleteSellerSessions } from '../sessions';
import { handleMyProductsMenu } from './my-products';
import type { SellerContext } from '../types';
import {
  LANGUAGE_SELECTOR_KEYBOARD,
  Localized,
  MENU_LABELS,
  DRAFT_CANCELLED,
  cancelButtonRow,
  getLocalizedMenu,
} from '../ui';

function matchesButton(text: string, labels: Localized, aliases: string[]): boolean {
  return Object.values(labels).includes(text) || aliases.includes(text.toLowerCase());
}

/** Handles menu commands/buttons. Returns true if the message was handled. */
export async function handleMenuCommand(ctx: SellerContext, text: string): Promise<boolean> {
  if (text === '/start') {
    await handleStart(ctx);
    return true;
  }
  if (text === '/cancel' || text.toLowerCase() === 'cancel') {
    await handleCancel(ctx);
    return true;
  }
  if (matchesButton(text, MENU_LABELS.addProduct, ['add product', 'добавить товар'])) {
    await handleAddProduct(ctx);
    return true;
  }
  if (
    text === '📦 Mahsulotlarim' ||
    matchesButton(text, MENU_LABELS.myProducts, ['my products', 'мои товары'])
  ) {
    await handleMyProductsMenu(ctx);
    return true;
  }
  if (
    text === '/language' ||
    matchesButton(text, MENU_LABELS.language, ['til', 'язык', 'language'])
  ) {
    await handleLanguageMenu(ctx);
    return true;
  }
  return false;
}

async function handleStart({ chatId, store, lang }: SellerContext) {
  const welcomeTexts: Localized = {
    ru: `👋 <b>Добро пожаловать в TrendMall!</b>\n\nИспользуйте меню ниже для управления магазином <b>${store.name}</b>.`,
    uz: `👋 <b>TrendMall'ga xush kelibsiz!</b>\n\n<b>${store.name}</b> do'koningizni boshqarish uchun quyidagi menyudan foydalaning.`,
    en: `👋 <b>Welcome back to TrendMall!</b>\n\nUse the menu below to manage <b>${store.name}</b>.`,
  };
  await sendTelegramMessage(chatId, welcomeTexts[lang], getLocalizedMenu(lang));
}

/** Safely cancels only the active seller's unfinished draft session. */
async function handleCancel({ supabase, chatId, store, lang }: SellerContext) {
  const deletedIds = await deleteSellerSessions(supabase, chatId, store.id);

  const noSessionMsgs: Localized = {
    ru: 'ℹ️ Нет активного черновика для отмены. Отправьте фото товара в любое время.',
    uz: "ℹ️ Bekor qilish uchun faol qoralama topilmadi. Mahsulot rasmini istalgan vaqtda yuborishingiz mumkin.",
    en: 'ℹ️ No active product draft found to cancel. Send a product photo anytime to add an item.',
  };

  const msg = deletedIds.length > 0 ? DRAFT_CANCELLED[lang] : noSessionMsgs[lang];
  await sendTelegramMessage(chatId, msg, getLocalizedMenu(lang));
}

async function handleAddProduct({ supabase, chatId, store, lang }: SellerContext) {
  // Clean up previous unfinished drafts, then start a fresh one waiting for a photo
  await deleteSellerSessions(supabase, chatId, store.id);

  const freshSessionId = crypto.randomUUID();
  const { error } = await createSession(supabase, {
    id: freshSessionId,
    chatId,
    storeId: store.id,
    step: 'AWAITING_PHOTO',
    draft: {},
  });
  if (error) {
    console.error('Failed to create fresh telegram session:', error);
  }

  const addProductPrompts: Localized = {
    ru: '📸 <b>Отправьте фото товара.</b> Я распознаю его с помощью AI и подготовлю карточку товара.',
    uz: "📸 <b>Mahsulot rasmini yuboring.</b> Men AI yordamida uni tahlil qilib, mahsulot kartasini tayyorlayman.",
    en: "📸 <b>Send a photo of the product.</b> I'll analyze it with AI and prepare the product listing.",
  };
  await sendTelegramMessage(chatId, addProductPrompts[lang], {
    inline_keyboard: [cancelButtonRow(lang, freshSessionId)],
  });
}

async function handleLanguageMenu({ chatId, lang }: SellerContext) {
  const langPromptTexts: Localized = {
    uz: '🌐 <b>Tilni tanlang:</b>',
    ru: '🌐 <b>Выберите язык:</b>',
    en: '🌐 <b>Choose a language:</b>',
  };
  await sendTelegramMessage(chatId, langPromptTexts[lang], LANGUAGE_SELECTOR_KEYBOARD);
}
