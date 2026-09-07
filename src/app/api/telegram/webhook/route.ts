import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '@/lib/supabase';
import { sendTelegramMessage } from '@/lib/telegram/notifier';

const menu = { keyboard: [[{ text: '➕ Add Product' }, { text: '📦 My Products' }]], resize_keyboard: true };

export async function POST(request: NextRequest) {
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
      await sendTelegramMessage(chatId, welcome[language] ?? welcome.en, menu);
      return NextResponse.json({ ok: true });
    }
    const message = update.message;
    if (!message) return NextResponse.json({ ok: true });
    const chatId = String(message.chat.id);
    const text = message.text?.trim() || '';
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
    const { data: user } = await supabase.from('users').select('id').eq('telegram_id', chatId).maybeSingle();
    const { data: store, error: storeError } = user
      ? await supabase.from('stores').select('id,name').eq('owner_id', user.id).maybeSingle()
      : await supabase.from('stores').select('id,name').limit(1).maybeSingle();
    if (storeError) throw storeError;
    if (!store) return NextResponse.json({ ok: true });
    if (text === '📦 My Products') {
      const { count, error } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', store.id);
      if (error) throw error;
      await sendTelegramMessage(chatId, `📦 Products: <b>${count ?? 0}</b>`, menu); return NextResponse.json({ ok: true });
    }
    if (message.photo?.length) {
      const file = message.photo.at(-1);
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || !file) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
      const response = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${file.file_id}`);
      const result = await response.json();
      if (!result.ok) throw new Error('Telegram image could not be read');
      const image = `https://api.telegram.org/file/bot${token}/${result.result.file_path}`;
      const { error } = await supabase.from('telegram_sessions').insert({ id: crypto.randomUUID(), seller_telegram_id: chatId, store_id: store.id, draft: { image }, created_at: new Date().toISOString() });
      if (error) throw error;
      await sendTelegramMessage(chatId, 'Photo saved. Reply: <code>Name | price | description</code>'); return NextResponse.json({ ok: true });
    }
    if (text.includes('|')) {
      const { data: session, error } = await supabase.from('telegram_sessions').select('*').eq('seller_telegram_id', chatId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (session) {
        const [title, priceText, description = ''] = text.split('|').map((part: string) => part.trim()); const price = Number(priceText);
        if (!title || !Number.isFinite(price)) throw new Error('Invalid product details');
        const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Date.now()}`;
        const { error: productError } = await supabase.from('products').insert({ store_id: store.id, title, slug, description, price, image: session.draft.image, status: 'ACTIVE' });
        if (productError) throw productError;
        await supabase.from('telegram_sessions').delete().eq('id', session.id);
        await sendTelegramMessage(chatId, `✅ <b>${title}</b> published.`, menu);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) { console.error('Telegram webhook error:', error); return NextResponse.json({ ok: false }, { status: 500 }); }
}
