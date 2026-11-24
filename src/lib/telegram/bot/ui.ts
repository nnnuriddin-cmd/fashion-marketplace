/**
 * Localized messages and keyboards of the Telegram seller bot.
 */
import { getTelegramText } from '@/lib/telegram/product-draft';
import type { BotLang, InlineKeyboard } from './types';

export type Localized = Record<BotLang, string>;

/** Public site base URL (used for links from the bot to the website). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://modora.uz').replace(/\/$/, '');
export const SELLER_DASHBOARD_URL = `${SITE_URL}/seller/dashboard`;

export const LANGUAGE_SELECTOR_KEYBOARD: InlineKeyboard = {
  inline_keyboard: [[
    { text: "🇺🇿 O‘zbekcha", callback_data: 'language_uz' },
    { text: '🇷🇺 Русский', callback_data: 'language_ru' },
    { text: '🇬🇧 English', callback_data: 'language_en' },
  ]],
};

/** Labels of the persistent reply-keyboard menu, per language. */
export const MENU_LABELS = {
  addProduct: { uz: "➕ Mahsulot qo'shish", ru: '➕ Добавить товар', en: '➕ Add Product' } as Localized,
  myProducts: { uz: '📦 Mening mahsulotlarim', ru: '📦 Мои товары', en: '📦 My Products' } as Localized,
  language: { uz: '🌐 Til', ru: '🌐 Язык', en: '🌐 Language' } as Localized,
};

/** Returns localized ReplyKeyboardMarkup based on preferred language. */
export function getLocalizedMenu(lang?: string | null) {
  const l: BotLang = lang === 'ru' || lang === 'en' ? lang : 'uz';
  return {
    keyboard: [
      [{ text: MENU_LABELS.addProduct[l] }, { text: MENU_LABELS.myProducts[l] }],
      [{ text: MENU_LABELS.language[l] }],
    ],
    resize_keyboard: true,
  };
}

const ACCESS_DENIED: Localized = {
  uz:
    '⛔ <b>Ruxsat berilmadi</b>\n\n' +
    "Sizning Telegram hisobingiz TrendMall sotuvchi akkauntiga ulanmagan.\n\n" +
    "Sotuvchi hisobingizni ulash uchun:\n" +
    "1. TrendMall hisobingizga kiring: https://modora.uz/account\n" +
    "2. Bir martalik ulanish kodini olish uchun <b>Telegram'ni ulash</b> tugmasini bosing\n" +
    "3. Ushbu chatga <code>/link KOD</code> xabarini yuboring.",
  ru:
    '⛔ <b>Доступ запрещен</b>\n\n' +
    'Ваш аккаунт Telegram не привязан к аккаунту продавца TrendMall.\n\n' +
    'Чтобы привязать аккаунт продавца:\n' +
    '1. Войдите в свой аккаунт TrendMall: https://modora.uz/account\n' +
    '2. Нажмите <b>Подключить Telegram</b>, чтобы получить одноразовый код\n' +
    '3. Отправьте <code>/link КОД</code> сюда в этот чат.',
  en:
    '⛔ <b>Access Denied</b>\n\n' +
    'Your Telegram account is not registered with any TrendMall seller account.\n\n' +
    'To link your seller account:\n' +
    '1. Log in to your TrendMall account at https://modora.uz/account\n' +
    '2. Click <b>Connect Telegram</b> to get a one-time linking code\n' +
    '3. Send <code>/link CODE</code> here in this chat.',
};

export function getAccessDeniedMessage(lang: BotLang): string {
  return ACCESS_DENIED[lang] || ACCESS_DENIED.uz;
}

export const DRAFT_CANCELLED: Localized = {
  ru: '❌ <b>Черновик товара отменён</b>\n\nНажмите ➕ Добавить товар или отправьте фото в любое время.',
  uz: "❌ <b>Mahsulot qoralamasi bekor qilindi</b>\n\n➕ Mahsulot qo'shish tugmasini bosing yoki rasm yuboring.",
  en: '❌ <b>Product Draft Cancelled</b>\n\nTap ➕ Add Product or send a photo anytime.',
};

export function cancelButtonRow(lang: BotLang, sessionId: string) {
  return [{ text: getTelegramText(lang, 'btn_cancel'), callback_data: `cancel_${sessionId}` }];
}
