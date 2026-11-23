/**
 * One-time account linking: `/link CODE` or deep-link `/start CODE`.
 */
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram/notifier';
import { fetchSellerLanguage } from '../language';
import { getLocalizedMenu, Localized } from '../ui';

/** Extracts the linking code from `/link CODE` or `/start CODE`, or null. */
export function parseLinkCode(text: string): string | null {
  if (text.startsWith('/link')) {
    return text.replace(/^\/link\s*/i, '').trim() || null;
  }
  if (text.startsWith('/start') && text.length > 6) {
    return text.replace(/^\/start\s*/i, '').trim() || null;
  }
  return null;
}

export async function handleLinkAccount(supabase: SupabaseClient, chatId: string, linkCode: string) {
  const normalizedCode = linkCode.toUpperCase();

  if (!/^[A-F0-9]{32}$/i.test(normalizedCode)) {
    await sendTelegramMessage(
      chatId,
      "⚠️ <b>Noto'g'ri kod</b>\n\nIltimos, TrendMall sotuvchi hisobingizdagi 32 belgidan iborat to'g'ri ulanish kodini kiriting."
    );
    return;
  }

  const submittedHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');

  const { data: matchedUser, error: searchErr } = await supabase
    .from('users')
    .select('id, role, telegram_id, telegram_code')
    .like('telegram_code', `${submittedHash}:%`)
    .maybeSingle();

  if (searchErr || !matchedUser || !matchedUser.telegram_code) {
    await sendTelegramMessage(
      chatId,
      "❌ <b>Kod yaroqsiz yoki muddati o'tgan</b>\n\nUshbu kod uchun faol ulanish so'rovi topilmadi. Iltimos, TrendMall hisobingizda yangi kod yarating."
    );
    return;
  }

  const clearCode = () =>
    supabase.from('users').update({ telegram_code: null }).eq('id', matchedUser.id);

  const expiresAt = parseInt(matchedUser.telegram_code.split(':')[1], 10);
  if (!expiresAt || Date.now() > expiresAt) {
    await clearCode();
    await sendTelegramMessage(
      chatId,
      "⏳ <b>Kod muddati o'tgan</b>\n\nUlanish kodi muddati tugagan (kodlar 10 daqiqa davomida amal qiladi). Iltimos, TrendMall hisobingizda yangi kod yarating."
    );
    return;
  }

  if (matchedUser.role !== 'SELLER') {
    await clearCode();
    await sendTelegramMessage(
      chatId,
      "⛔ <b>Ruxsat berilmadi</b>\n\nFaqat ro'yxatdan o'tgan sotuvchilar Telegram hisobini TrendMall'ga ulashi mumkin."
    );
    return;
  }

  const { data: targetStore, error: storeCheckErr } = await supabase
    .from('stores')
    .select('id, name, status')
    .eq('owner_id', matchedUser.id)
    .maybeSingle();

  if (storeCheckErr || !targetStore) {
    await clearCode();
    await sendTelegramMessage(
      chatId,
      "⚠️ <b>Do'kon topilmadi</b>\n\nUshbu hisobga biriktirilgan do'kon topilmadi. Iltimos, avval do'koningizni ro'yxatdan o'tkazing."
    );
    return;
  }

  const { data: existingUserWithChatId } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', chatId)
    .maybeSingle();

  if (existingUserWithChatId && existingUserWithChatId.id !== matchedUser.id) {
    await sendTelegramMessage(
      chatId,
      "⛔ <b>Boshqa hisobga ulangan</b>\n\nUshbu Telegram hisobi allaqachon boshqa TrendMall sotuvchi akkauntiga ulangan. Iltimos, avval uni avvalgi hisobdan uzing."
    );
    return;
  }

  // Conditional update on the exact code guarantees the code is used only once
  const { data: updatedRows, error: linkErr } = await supabase
    .from('users')
    .update({
      telegram_id: chatId,
      telegram_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchedUser.id)
    .eq('telegram_code', matchedUser.telegram_code)
    .select('id');

  if (linkErr || !updatedRows || updatedRows.length === 0) {
    await sendTelegramMessage(
      chatId,
      "⚠️ <b>Ulanish amalga oshmadi</b>\n\nUshbu kod allaqachon ishlatilgan yoki muddati o'tgan bo'lishi mumkin. Iltimos, TrendMall hisobingizda yangi kod yarating."
    );
    return;
  }

  const lang = await fetchSellerLanguage(supabase, matchedUser.id);
  const welcomeConnected: Localized = {
    ru: `✅ <b>Telegram успешно подключён!</b>\n\nВаш аккаунт связан с магазином <b>${targetStore.name}</b>.\n\nИспользуйте меню ниже для работы с заказами и товарами.`,
    uz: `✅ <b>Telegram muvaffaqiyatli ulandi!</b>\n\nSizning hisobingiz <b>${targetStore.name}</b> do'koniga ulandi.\n\nBuyurtmalar va mahsulotlar bilan ishlash uchun quyidagi menyudan foydalaning.`,
    en: `✅ <b>Telegram Successfully Linked!</b>\n\nYour account is connected to <b>${targetStore.name}</b>.\n\nUse the menu below to manage orders and inventory.`,
  };
  await sendTelegramMessage(chatId, welcomeConnected[lang], getLocalizedMenu(lang));
}
