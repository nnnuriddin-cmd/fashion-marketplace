/**
 * Telegram seller bot: entry point that routes an incoming webhook update
 * to the matching handler.
 *
 *   callback_query            → handlers/callback-query
 *   /link CODE, /start CODE   → handlers/link-account
 *   (unlinked user)           → Access Denied + language selector
 *   menu commands & buttons   → handlers/menu-commands
 *   photo                     → handlers/photo-upload
 *   text for active draft     → handlers/draft-input
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram/notifier';
import { handleCallbackQuery } from './handlers/callback-query';
import { handleDraftInput } from './handlers/draft-input';
import { handleLinkAccount, parseLinkCode } from './handlers/link-account';
import { handleMenuCommand } from './handlers/menu-commands';
import { handlePhotoUpload } from './handlers/photo-upload';
import { findUserByChatId, loadStoreAndLanguage } from './seller';
import type { SellerContext } from './types';
import { LANGUAGE_SELECTOR_KEYBOARD, Localized, getAccessDeniedMessage } from './ui';

export async function handleTelegramUpdate(supabase: SupabaseClient, update: any): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(supabase, update.callback_query);
    return;
  }

  const message = update.message;
  if (!message) return;
  await handleMessage(supabase, message);
}

async function handleMessage(supabase: SupabaseClient, message: any) {
  const chatId = String(message.chat.id);
  const text: string = message.text?.trim() || '';

  const linkCode = parseLinkCode(text);
  if (linkCode) {
    await handleLinkAccount(supabase, chatId, linkCode);
    return;
  }

  const user = await findUserByChatId(supabase, chatId);
  if (!user || user.role !== 'SELLER') {
    // Unknown / unlinked user: default language is ALWAYS Uzbek, with a selector to switch
    await sendTelegramMessage(chatId, getAccessDeniedMessage('uz'), LANGUAGE_SELECTOR_KEYBOARD);
    return;
  }

  const { store, lang } = await loadStoreAndLanguage(supabase, user.id);

  if (!store) {
    const noStoreMsgs: Localized = {
      uz: "⚠️ <b>Do'kon topilmadi</b>\n\nHisobingizga bog'langan sotuvchi do'koni topilmadi. Mahsulotlarni boshqarishdan oldin Sotuvchi portalida do'koningizni ro'yxatdan o'tkazing.",
      ru: '⚠️ <b>Магазин не найден</b>\n\nК вашему аккаунту не привязан магазин. Пожалуйста, создайте или привяжите магазин в панели продавца перед управлением товарами.',
      en: '⚠️ <b>No Store Found</b>\n\nNo merchant store is linked to your account. Please create or link your store in the Seller Portal before managing inventory.',
    };
    await sendTelegramMessage(chatId, noStoreMsgs[lang]);
    return;
  }

  if (store.status !== 'APPROVED') {
    const storeInactiveMsgs: Localized = {
      uz: `⚠️ <b>Do'kon faol emas</b>\n\nSizning "<b>${store.name}</b>" do'koningiz hozirda <b>${store.status}</b> holatida. Mahsulot operatsiyalari do'kon tasdiqlangandan so'ng mavjud bo'ladi.`,
      ru: `⚠️ <b>Магазин не активен</b>\n\nВаш магазин "<b>${store.name}</b>" в настоящее время находится в статусе <b>${store.status}</b>. Операции с товарами станут доступны после одобрения магазина.`,
      en: `⚠️ <b>Store Not Active</b>\n\nYour store "<b>${store.name}</b>" is currently <b>${store.status}</b>. Product operations will be available once your store is approved.`,
    };
    await sendTelegramMessage(chatId, storeInactiveMsgs[lang]);
    return;
  }

  const ctx: SellerContext = { supabase, chatId, user, store, lang };

  if (await handleMenuCommand(ctx, text)) return;

  if (message.photo?.length) {
    await handlePhotoUpload(ctx, message.photo);
    return;
  }

  if (await handleDraftInput(ctx, text)) return;

  if (text) {
    const safeSnippet = text.replace(/[\r\n\t]/g, ' ').slice(0, 80);
    console.log(`[Telegram] Unhandled text: "${safeSnippet}" chat=${chatId}`);
  }
}
