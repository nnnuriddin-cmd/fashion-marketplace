import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { sendTelegramMessage } from '@/lib/telegram/notifier';

const menu = { keyboard: [[{ text: '➕ Add Product' }, { text: '📦 My Products' }]], resize_keyboard: true };

export async function POST(request: NextRequest) {
  // 1. Enforce Telegram Webhook Secret Token validation
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret || secretHeader !== expectedSecret) {
    return NextResponse.json(
      { error: 'Unauthorized webhook source' },
      { status: 401 }
    );
  }

  try {
    const update = await request.json();
    if (update.callback_query?.data?.startsWith('language_')) {
      const chatId = String(update.callback_query.message.chat.id);
      const language = update.callback_query.data.replace('language_', '');
      const welcome: Record<string, string> = {
        ru: '✅ Русский выбран. Отправьте фото товара, чтобы добавить его в магазин.',
        uz: "✅ O'zbek tili tanlandi. Mahsulot qo'shish uchun rasmini yuboring.",
        en: '✅ English selected. Send a product photo to add it to your store.',
      };
      const localizedMenu = language === 'uz'
        ? { keyboard: [[{ text: "➕ Mahsulot qo'shish" }, { text: '📦 Mahsulotlarim' }]], resize_keyboard: true }
        : language === 'ru'
          ? { keyboard: [[{ text: '➕ Добавить товар' }, { text: '📦 Мои товары' }]], resize_keyboard: true }
          : menu;
      await sendTelegramMessage(chatId, welcome[language] ?? welcome.en, localizedMenu);
      return NextResponse.json({ ok: true });
    }

    const message = update.message;
    if (!message) return NextResponse.json({ ok: true });
    const chatId = String(message.chat.id);
    const text = message.text?.trim() || '';

    // Privileged server client to authenticate Telegram sellers and manage sessions
    const supabase = getServerSupabase();

    // 2. Handle One-Time Account Linking (/link CODE or /start CODE)
    let linkCode: string | null = null;
    if (text.startsWith('/link')) {
      linkCode = text.replace(/^\/link\s*/i, '').trim();
    } else if (text.startsWith('/start') && text.length > 6) {
      linkCode = text.replace(/^\/start\s*/i, '').trim();
    }

    if (linkCode) {
      const normalizedCode = linkCode.toUpperCase();

      // Basic input format validation: 32 hexadecimal characters (128 bits entropy)
      if (!/^[A-F0-9]{32}$/i.test(normalizedCode)) {
        await sendTelegramMessage(
          chatId,
          '⚠️ <b>Invalid Linking Code / Noto\'g\'ri kod</b>\n\n' +
          'Please provide a valid 32-character linking code from your TrendMall seller account.'
        );
        return NextResponse.json({ ok: true });
      }

      // Compute SHA-256 hash of submitted code
      const submittedHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');

      // Search for candidate user where telegram_code matches the hash prefix
      const { data: matchedUser, error: searchErr } = await supabase
        .from('users')
        .select('id, role, telegram_id, telegram_code')
        .like('telegram_code', `${submittedHash}:%`)
        .maybeSingle();

      if (searchErr || !matchedUser || !matchedUser.telegram_code) {
        await sendTelegramMessage(
          chatId,
          '❌ <b>Invalid or Expired Code / Kod yaroqsiz yoki muddati o\'tgan</b>\n\n' +
          'No active linking request found for this code. Please generate a fresh code in your TrendMall account.'
        );
        return NextResponse.json({ ok: true });
      }

      // Parse and validate expiration epoch (10 minutes)
      const parts = matchedUser.telegram_code.split(':');
      const expiresAt = parseInt(parts[1], 10);
      if (!expiresAt || Date.now() > expiresAt) {
        // Expired - clear code to prevent lingering entries
        await supabase.from('users').update({ telegram_code: null }).eq('id', matchedUser.id);
        await sendTelegramMessage(
          chatId,
          '⏳ <b>Code Expired / Kod muddati o\'tdi</b>\n\n' +
          'This linking code has expired (codes are valid for 10 minutes). Please generate a fresh code in your TrendMall account.'
        );
        return NextResponse.json({ ok: true });
      }

      // Enforce SELLER role validation strictly
      if (matchedUser.role !== 'SELLER') {
        await supabase.from('users').update({ telegram_code: null }).eq('id', matchedUser.id);
        await sendTelegramMessage(
          chatId,
          '⛔ <b>Access Denied / Ruxsat berilmadi</b>\n\n' +
          'Only registered sellers can connect a Telegram account to TrendMall.'
        );
        return NextResponse.json({ ok: true });
      }

      // Verify seller store ownership & status
      const { data: targetStore, error: storeCheckErr } = await supabase
        .from('stores')
        .select('id, name, status')
        .eq('owner_id', matchedUser.id)
        .maybeSingle();

      if (storeCheckErr || !targetStore) {
        await supabase.from('users').update({ telegram_code: null }).eq('id', matchedUser.id);
        await sendTelegramMessage(
          chatId,
          '⚠️ <b>No Store Found / Do\'kon topilmadi</b>\n\n' +
          'No merchant boutique is associated with this account. Please register your store first.'
        );
        return NextResponse.json({ ok: true });
      }

      // Duplicate Telegram ID protection: check if this Telegram chat ID is already linked to ANOTHER user
      const { data: existingUserWithChatId } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', chatId)
        .maybeSingle();

      if (existingUserWithChatId && existingUserWithChatId.id !== matchedUser.id) {
        await sendTelegramMessage(
          chatId,
          '⛔ <b>Account Conflict / Boshqa hisobga ulangan</b>\n\n' +
          'This Telegram account is already linked to another TrendMall seller account. Please unlink it from that account first.'
        );
        return NextResponse.json({ ok: true });
      }

      // Atomically link Telegram chat ID and consume the single-use token (optimistic lock on telegram_code)
      const { data: updatedRows, error: linkErr } = await supabase
        .from('users')
        .update({
          telegram_id: chatId,
          telegram_code: null, // Single-use consumption
          updated_at: new Date().toISOString(),
        })
        .eq('id', matchedUser.id)
        .eq('telegram_code', matchedUser.telegram_code)
        .select('id');

      if (linkErr || !updatedRows || updatedRows.length === 0) {
        await sendTelegramMessage(
          chatId,
          '⚠️ <b>Linking Failed / Ulanish amalga oshmadi</b>\n\n' +
          'This code may have already been consumed or expired. Please generate a new code in your TrendMall account.'
        );
        return NextResponse.json({ ok: true });
      }

      // Linking successful! Send localized confirmation with menu
      await sendTelegramMessage(
        chatId,
        `✅ <b>Telegram Successfully Linked! / Telegram muvaffaqiyatli ulandi!</b>\n\n` +
        `Your Telegram account is now connected to <b>${targetStore.name}</b>.\n\n` +
        `You will receive instant alerts when customers place orders, and you can upload photos directly to publish products.`,
        menu
      );
      return NextResponse.json({ ok: true });
    }

    // 3. Welcome / Language Selection for /start without parameters
    if (text === '/start') {
      await sendTelegramMessage(chatId, '🌐 <b>Выберите язык / Tilni tanlang / Choose a language</b>', {
        inline_keyboard: [[
          { text: 'Русский', callback_data: 'language_ru' },
          { text: "O'zbekcha", callback_data: 'language_uz' },
          { text: 'English', callback_data: 'language_en' },
        ]],
      });
      return NextResponse.json({ ok: true });
    }

    // 4. Authenticate user by verified telegram_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('telegram_id', chatId)
      .maybeSingle();

    if (userError) throw userError;

    if (!user) {
      await sendTelegramMessage(
        chatId,
        '⛔ <b>Access Denied / Ruxsat berilmadi</b>\n\n' +
        'Your Telegram account is not registered with any TrendMall seller account.\n\n' +
        'To link your seller account:\n' +
        '1. Log in to your TrendMall account at https://modora.uz/account\n' +
        '2. Click <b>Connect Telegram</b> to get a one-time linking code\n' +
        '3. Send <code>/link CODE</code> here in this chat.'
      );
      return NextResponse.json({ ok: true });
    }

    // 5. Authorize seller store (strictly by owner_id, with zero fallback to other stores)
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, status')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (storeError) throw storeError;

    if (!store) {
      await sendTelegramMessage(
        chatId,
        '⚠️ <b>No Store Found / Do\'kon topilmadi</b>\n\nNo merchant store is linked to your account. Please create or link your store in the Seller Portal before managing inventory.'
      );
      return NextResponse.json({ ok: true });
    }

    if (store.status !== 'APPROVED') {
      await sendTelegramMessage(
        chatId,
        `⚠️ <b>Store Not Active / Do'kon faol emas</b>\n\nYour store "<b>${store.name}</b>" is currently <b>${store.status}</b>. Product operations will be available once your store is approved.`
      );
      return NextResponse.json({ ok: true });
    }

    // 6. Authorized Seller Actions
    if (text === '📦 My Products' || text === '📦 Мои товары' || text === "📦 Mahsulotlarim") {
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id);
      if (error) throw error;
      await sendTelegramMessage(chatId, `📦 Products in <b>${store.name}</b>: <b>${count ?? 0}</b>`, menu);
      return NextResponse.json({ ok: true });
    }

    if (message.photo?.length) {
      const file = message.photo.at(-1);
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || !file) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
      const response = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${file.file_id}`);
      const result = await response.json();
      if (!result.ok) throw new Error('Telegram image could not be read');
      const image = `https://api.telegram.org/file/bot${token}/${result.result.file_path}`;
      const { error } = await supabase.from('telegram_sessions').insert({
        id: crypto.randomUUID(),
        seller_telegram_id: chatId,
        store_id: store.id,
        draft: { image },
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      await sendTelegramMessage(chatId, 'Photo saved. Reply: <code>Name | price | description</code>');
      return NextResponse.json({ ok: true });
    }

    if (text.includes('|')) {
      const { data: session, error } = await supabase
        .from('telegram_sessions')
        .select('*')
        .eq('seller_telegram_id', chatId)
        .eq('store_id', store.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (session) {
        const [title, priceText, description = ''] = text.split('|').map((part: string) => part.trim());
        const price = Number(priceText);
        if (!title || !Number.isFinite(price)) throw new Error('Invalid product details');
        const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}`;
        const { error: productError } = await supabase.from('products').insert({
          store_id: store.id,
          title,
          slug,
          description,
          price,
          original_image: session.draft?.image || null,
          status: 'ACTIVE',
        });
        if (productError) throw productError;
        await supabase.from('telegram_sessions').delete().eq('id', session.id);
        await sendTelegramMessage(chatId, `✅ <b>${title}</b> published to <b>${store.name}</b>.`, menu);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
