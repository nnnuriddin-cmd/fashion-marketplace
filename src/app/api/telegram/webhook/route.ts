import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  sendTelegramMessage,
  answerTelegramCallbackQuery,
  clearTelegramInlineKeyboard,
} from '@/lib/telegram/notifier';
import { processAndStoreProductImage } from '@/lib/ai/image-processor';
import { analyzeClothingImage, VisionAnalysisResult } from '@/lib/ai/vision-analyzer';
import {
  validatePriceInput,
  validateStockInput,
  matchCategory,
  matchBrand,
  formatProductPreview,
  formatAiExtractionDetails,
  getTelegramText,
} from '@/lib/telegram/product-draft';

/**
 * Resolves language for a Telegram user with the following priority:
 * 1. Saved explicit seller preference: auth.users.user_metadata.preferred_language (uz | ru | en)
 * 2. Default fallback: 'uz' (Uzbek Latin is ALWAYS the default language)
 */
function resolveTelegramLanguage(preferredLanguage?: unknown): 'uz' | 'ru' | 'en' {
  if (typeof preferredLanguage === 'string') {
    const cleanPref = preferredLanguage.trim().toLowerCase();
    if (cleanPref === 'uz' || cleanPref === 'ru' || cleanPref === 'en') {
      return cleanPref;
    }
  }
  return 'uz';
}

const LANGUAGE_SELECTOR_KEYBOARD = {
  inline_keyboard: [[
    { text: "🇺🇿 O‘zbekcha", callback_data: 'language_uz' },
    { text: '🇷🇺 Русский', callback_data: 'language_ru' },
    { text: '🇬🇧 English', callback_data: 'language_en' },
  ]],
};

function getAccessDeniedMessage(lang: 'uz' | 'ru' | 'en'): string {
  const msgs: Record<'uz' | 'ru' | 'en', string> = {
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
  return msgs[lang] || msgs.uz;
}

/**
 * Sends chat action (e.g. 'typing') to Telegram so user sees immediate feedback.
 * Non-blocking / fire-and-forget safe so network errors never break product flow.
 */
async function sendTelegramChatAction(chatId: string | number, action: string = 'typing') {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (err) {
    console.warn('sendChatAction failed (non-critical):', err);
  }
}

/**
 * Returns localized ReplyKeyboardMarkup based on preferred language.
 */
function getLocalizedMenu(lang?: string | null) {
  if (lang === 'ru') {
    return {
      keyboard: [
        [{ text: '➕ Добавить товар' }, { text: '📦 Мои товары' }],
        [{ text: '🌐 Язык' }],
      ],
      resize_keyboard: true,
    };
  }
  if (lang === 'en') {
    return {
      keyboard: [
        [{ text: '➕ Add Product' }, { text: '📦 My Products' }],
        [{ text: '🌐 Language' }],
      ],
      resize_keyboard: true,
    };
  }
  return {
    keyboard: [
      [{ text: "➕ Mahsulot qo'shish" }, { text: '📦 Mening mahsulotlarim' }],
      [{ text: '🌐 Til' }],
    ],
    resize_keyboard: true,
  };
}

/**
 * Formats the AI extraction card, step 1 price prompt, and inline keyboard.
 * Only offers the "Use {price} UZS" button if suggestedPrice is an integer >= 1000.
 */
function buildPriceStepPromptAndKeyboard(
  ai: any,
  categoryName: string,
  brandName: string | null,
  sessionId: string,
  lang: 'uz' | 'ru' | 'en' = 'uz'
) {
  const suggestedPrice = ai?.suggestedPrice;
  const hasValidSuggestedPrice =
    typeof suggestedPrice === 'number' &&
    Number.isInteger(suggestedPrice) &&
    suggestedPrice >= 1000;

  const rawDetails = formatAiExtractionDetails(
    { ...ai, suggestedPrice: undefined },
    categoryName,
    brandName,
    lang
  );
  const stepHeader = getTelegramText(lang, 'step1_header');
  const baseCard = rawDetails.includes(stepHeader)
    ? rawDetails.split(stepHeader)[0] + stepHeader
    : rawDetails;

  let promptText = '';
  let keyboard: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };

  const cancelLabel = getTelegramText(lang, 'btn_cancel');

  if (hasValidSuggestedPrice) {
    const formattedPrice = suggestedPrice.toLocaleString();
    promptText = `${baseCard}\n\n${getTelegramText(lang, 'suggested_price_prompt', { price: formattedPrice })}`;
    keyboard = {
      inline_keyboard: [
        [{ text: getTelegramText(lang, 'btn_use_price', { price: formattedPrice }), callback_data: `set_price_${suggestedPrice}` }],
        [{ text: cancelLabel, callback_data: `cancel_${sessionId}` }],
      ],
    };
  } else {
    promptText = `${baseCard}\n\n${getTelegramText(lang, 'enter_price_prompt')}`;
    keyboard = {
      inline_keyboard: [[{ text: cancelLabel, callback_data: `cancel_${sessionId}` }]],
    };
  }

  return { promptText, keyboard };
}

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
    const supabase = getServerSupabase();

    // =========================================================================
    // 2. Handle Telegram Callback Queries (Inline Buttons)
    // =========================================================================
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbId = cb.id;
      const chatId = String(cb.message?.chat?.id || cb.from?.id);
      const data = String(cb.data || '');

      // 2.1 Language selection callback (language_ru, language_uz, language_en)
      // Handles both linked sellers and unlinked/unknown users
      if (data.startsWith('language_')) {
        const rawLang = data.replace('language_', '');
        const validLang: 'ru' | 'uz' | 'en' = ['ru', 'uz', 'en'].includes(rawLang)
          ? (rawLang as 'ru' | 'uz' | 'en')
          : 'uz';

        // Check if user is an authenticated seller
        const { data: user } = await supabase
          .from('users')
          .select('id, role')
          .eq('telegram_id', chatId)
          .maybeSingle();

        if (user && user.role === 'SELLER') {
          // Persist preferred_language in Supabase Auth user_metadata for linked seller
          let updateFailed = false;
          try {
            const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
              user_metadata: { preferred_language: validLang },
            });
            if (updateErr) {
              console.error('Failed to persist preferred_language in auth user_metadata:', updateErr);
              updateFailed = true;
            }
          } catch (metaErr) {
            console.error('Failed to persist preferred_language in auth user_metadata:', metaErr);
            updateFailed = true;
          }

          if (updateFailed) {
            await answerTelegramCallbackQuery(cbId, 'Failed to update language. Please try again.', true);
            return NextResponse.json({ ok: true });
          }

          await answerTelegramCallbackQuery(cbId);

          if (cb.message?.message_id) {
            await clearTelegramInlineKeyboard(chatId, cb.message.message_id);
          }

          const confirmMsgs: Record<string, string> = {
            uz: '✅ <b>Til o‘zgartirildi: O‘zbekcha</b>',
            ru: '✅ <b>Язык изменён: Русский</b>',
            en: '✅ <b>Language changed: English</b>',
          };

          await sendTelegramMessage(chatId, confirmMsgs[validLang], getLocalizedMenu(validLang));
          return NextResponse.json({ ok: true });
        } else {
          // UNLINKED user: runtime-only language change, do NOT save to auth.users
          await answerTelegramCallbackQuery(cbId);

          if (cb.message?.message_id) {
            await clearTelegramInlineKeyboard(chatId, cb.message.message_id);
          }

          await sendTelegramMessage(
            chatId,
            getAccessDeniedMessage(validLang),
            LANGUAGE_SELECTOR_KEYBOARD
          );
          return NextResponse.json({ ok: true });
        }
      }

      // Authenticate Telegram user strictly from chatId (never from callback data)
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('telegram_id', chatId)
        .maybeSingle();

      if (userError) throw userError;

      if (!user || user.role !== 'SELLER') {
        await answerTelegramCallbackQuery(cbId, 'Access denied: Registered sellers only', true);
        return NextResponse.json({ ok: true });
      }

      // Authorize seller store (strictly by owner_id)
      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id, name, status')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (storeError) throw storeError;

      // Read seller's current preferred language from Supabase Auth user_metadata
      let sellerPrefLang: string | null = null;
      try {
        const { data: authData } = await supabase.auth.admin.getUserById(user.id);
        const l = authData?.user?.user_metadata?.preferred_language;
        if (l && ['ru', 'uz', 'en'].includes(l)) sellerPrefLang = l;
      } catch (e) {
        console.warn('Could not read seller preferred_language:', e);
      }
      const sellerLang = resolveTelegramLanguage(sellerPrefLang);

      if (!store || store.status !== 'APPROVED') {
        await answerTelegramCallbackQuery(cbId, 'Store is not active', true);
        const storeInactiveTexts: Record<string, string> = {
          uz: `⚠️ <b>Do'kon faol emas</b>\n\nSizning "${store?.name || 'Noma\'lum'}" do'koningiz hozirda ${store?.status || 'TASDIQLANMAGAN'}. Mahsulot amallarini bajarish mumkin emas.`,
          ru: `⚠️ <b>Магазин не активен</b>\n\nВаш магазин "${store?.name || 'Неизвестно'}" в настоящее время ${store?.status || 'НЕ ОДОБРЕН'}. Операции с товарами невозможны.`,
          en: `⚠️ <b>Store Inactive</b>\n\nYour store "${store?.name || 'Unknown'}" is currently ${store?.status || 'NOT APPROVED'}. Cannot perform product operations.`,
        };
        await sendTelegramMessage(
          chatId,
          storeInactiveTexts[sellerLang]
        );
        return NextResponse.json({ ok: true });
      }

      // 2.2 Cancel Draft Callback (e.g. cancel_<sessionId> or cancel_draft)
      if (data.startsWith('cancel_')) {
        await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_draft_cancelled'));

        if (cb.message?.message_id) {
          await clearTelegramInlineKeyboard(chatId, cb.message.message_id);
        }

        await supabase
          .from('telegram_sessions')
          .delete()
          .eq('seller_telegram_id', chatId)
          .eq('store_id', store.id);

        const cancelMsgs: Record<string, string> = {
          ru: '❌ <b>Черновик товара отменён</b>\n\nНажмите ➕ Добавить товар или отправьте фото в любое время.',
          uz: "❌ <b>Mahsulot qoralamasi bekor qilindi</b>\n\n➕ Mahsulot qo'shish tugmasini bosing yoki rasm yuboring.",
          en: '❌ <b>Product Draft Cancelled</b>\n\nTap ➕ Add Product or send a photo anytime.',
        };

        await sendTelegramMessage(
          chatId,
          cancelMsgs[sellerLang],
          getLocalizedMenu(sellerLang)
        );
        return NextResponse.json({ ok: true });
      }

      // 2.3 Set Suggested Price Callback (set_price_<price>)
      if (data.startsWith('set_price_')) {
        const priceStr = data.replace('set_price_', '');
        const priceRes = validatePriceInput(priceStr, sellerLang);

        if (!priceRes.valid || !priceRes.price || priceRes.price < 1000) {
          if (cb.message?.message_id) {
            await clearTelegramInlineKeyboard(chatId, cb.message.message_id);
          }
          await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_invalid_price'), true);
          return NextResponse.json({ ok: true });
        }

        const { data: session } = await supabase
          .from('telegram_sessions')
          .select('*')
          .eq('seller_telegram_id', chatId)
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!session) {
          await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_no_draft'), true);
          return NextResponse.json({ ok: true });
        }

        await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_price_set', { price: priceRes.price.toLocaleString() }));

        if (cb.message?.message_id) {
          await clearTelegramInlineKeyboard(chatId, cb.message.message_id);
        }

        const updatedDraft = { ...(session.draft || {}), price: priceRes.price };
        await supabase
          .from('telegram_sessions')
          .update({
            step: 'AWAITING_STOCK',
            draft: updatedDraft,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        await sendTelegramMessage(
          chatId,
          `${getTelegramText(sellerLang, 'price_confirmed', { price: priceRes.price.toLocaleString() })}\n\n` +
          `${getTelegramText(sellerLang, 'step2_header')}\n` +
          getTelegramText(sellerLang, 'enter_stock_prompt'),
          {
            inline_keyboard: [
              [
                { text: getTelegramText(sellerLang, 'btn_stock_1'), callback_data: 'set_stock_1' },
                { text: getTelegramText(sellerLang, 'btn_stock_5'), callback_data: 'set_stock_5' },
                { text: getTelegramText(sellerLang, 'btn_stock_10'), callback_data: 'set_stock_10' },
              ],
              [{ text: getTelegramText(sellerLang, 'btn_cancel'), callback_data: `cancel_${session.id}` }],
            ],
          }
        );
        return NextResponse.json({ ok: true });
      }

      // 2.4 Set Quick Stock Callback (set_stock_<stock>)
      if (data.startsWith('set_stock_')) {
        const stockStr = data.replace('set_stock_', '');
        const stockRes = validateStockInput(stockStr, sellerLang);

        if (!stockRes.valid || !stockRes.stock) {
          await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_invalid_stock'), true);
          return NextResponse.json({ ok: true });
        }

        const { data: session } = await supabase
          .from('telegram_sessions')
          .select('*')
          .eq('seller_telegram_id', chatId)
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!session || !session.draft?.price) {
          await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_enter_price_first'), true);
          return NextResponse.json({ ok: true });
        }

        // 1. Acknowledge callback promptly
        await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_stock_set', { stock: stockRes.stock }));

        // 2. Clear old stock keyboard
        if (cb.message?.message_id) {
          await clearTelegramInlineKeyboard(chatId, cb.message.message_id);
        }

        // 3. Update session to AWAITING_PUBLICATION_CONFIRMATION
        const updatedDraft = { ...(session.draft || {}), stock: stockRes.stock };
        await supabase
          .from('telegram_sessions')
          .update({
            step: 'AWAITING_PUBLICATION_CONFIRMATION',
            draft: updatedDraft,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        const ai = session.draft?.ai || session.extracted_metadata || {};
        const previewText = formatProductPreview({
          title: ai.title || 'Fashion Item',
          categoryName: session.draft?.category_name || 'Fashion',
          brandName: session.draft?.brand_name || null,
          color: ai.color || 'Standard',
          material: ai.material || null,
          gender: ai.gender || 'UNISEX',
          style: ai.style || null,
          occasion: ai.occasion || null,
          season: ai.season || null,
          description: ai.description || '',
          price: session.draft.price,
          stock: stockRes.stock,
          tags: ai.tags || [],
        }, sellerLang);

        await sendTelegramMessage(chatId, previewText, {
          inline_keyboard: [
            [{ text: getTelegramText(sellerLang, 'btn_publish'), callback_data: `publish_${session.id}` }],
            [{ text: getTelegramText(sellerLang, 'btn_cancel'), callback_data: `cancel_${session.id}` }],
          ],
        });
        return NextResponse.json({ ok: true });
      }

      // 2.5 Select Category Callback (select_cat_<categoryId>)
      if (data.startsWith('select_cat_')) {
        const catId = data.replace('select_cat_', '');
        const { data: cat } = await supabase
          .from('categories')
          .select('id, name, slug')
          .eq('id', catId)
          .maybeSingle();

        if (!cat) {
          await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_category_not_found'), true);
          return NextResponse.json({ ok: true });
        }

        const { data: session } = await supabase
          .from('telegram_sessions')
          .select('*')
          .eq('seller_telegram_id', chatId)
          .eq('store_id', store.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!session) {
          await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_session_expired'), true);
          return NextResponse.json({ ok: true });
        }

        await answerTelegramCallbackQuery(cbId, `📁 ${cat.name}`);

        if (cb.message?.message_id) {
          await clearTelegramInlineKeyboard(chatId, cb.message.message_id);
        }

        const updatedDraft = {
          ...(session.draft || {}),
          category_id: cat.id,
          category_name: cat.name,
        };

        await supabase
          .from('telegram_sessions')
          .update({
            step: 'AWAITING_PRICE',
            draft: updatedDraft,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        const ai = session.draft?.ai || session.extracted_metadata || {};
        const { promptText, keyboard } = buildPriceStepPromptAndKeyboard(
          ai,
          cat.name,
          session.draft?.brand_name || null,
          session.id,
          sellerLang
        );

        await sendTelegramMessage(chatId, promptText, keyboard);
        return NextResponse.json({ ok: true });
      }

      // 2.6 Publish Product Callback (publish_<sessionId>)
      if (data.startsWith('publish_')) {
        const sessionId = data.replace('publish_', '');

        // Security check: Atomic lock on session to guarantee idempotency and prevent duplicate inserts
        const { data: lockedSession, error: lockErr } = await supabase
          .from('telegram_sessions')
          .update({
            step: 'PUBLISHING',
            updated_at: new Date().toISOString(),
          })
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
            await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_already_published'), true);
            await sendTelegramMessage(
              chatId,
              getTelegramText(sellerLang, 'msg_already_published', { title: existingProd.title }),
              getLocalizedMenu(sellerLang)
            );
            return NextResponse.json({ ok: true });
          }

          await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_session_expired'), true);
          return NextResponse.json({ ok: true });
        }

        // Acknowledge callback promptly so the Telegram client stops spinning
        await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_publishing'));

        // Clear the original inline keyboard so Publish cannot be repeatedly tapped
        if (cb.message?.message_id) {
          await clearTelegramInlineKeyboard(chatId, cb.message.message_id);
        }

        const draft = lockedSession.draft || {};
        const ai = draft.ai || lockedSession.extracted_metadata || {};
        const price = draft.price;
        const stock = draft.stock;
        const categoryId = draft.category_id;
        const brandId = draft.brand_id || null;
        const imageUrl = lockedSession.processed_image_url || draft.image;

        // Validation of required product fields
        if (!price || !stock || !categoryId || !imageUrl) {
          await supabase
            .from('telegram_sessions')
            .update({ step: 'AWAITING_PUBLICATION_CONFIRMATION' })
            .eq('id', sessionId);

          await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'msg_incomplete_draft'), true);
          await sendTelegramMessage(
            chatId,
            getTelegramText(sellerLang, 'msg_incomplete_draft')
          );
          return NextResponse.json({ ok: true });
        }

        // SECURITY INVARIANT: Image URL must be from permanent Supabase Storage, never Telegram Bot API
        if (imageUrl.includes('api.telegram.org') || imageUrl.includes('/bot')) {
          console.error('CRITICAL SECURITY: Refusing product publication with Telegram Bot API URL');
          await supabase.from('telegram_sessions').delete().eq('id', sessionId);
          await answerTelegramCallbackQuery(cbId, 'Image security error', true);
          await sendTelegramMessage(chatId, '❌ Security error: Invalid image source. Please upload the photo again.');
          return NextResponse.json({ ok: true });
        }

        // Generate clean unique slug
        const title = ai.title || 'Fashion Item';
        const baseSlug = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const slug = `${baseSlug || 'product'}-${Date.now().toString().slice(-6)}`;

        // Insert product into Supabase products table
        const { data: newProduct, error: insertErr } = await supabase
          .from('products')
          .insert({
            store_id: store.id,
            category_id: categoryId,
            brand_id: brandId,
            title,
            slug,
            description: ai.description || '',
            price,
            currency: 'UZS',
            sku: `SKU-${Date.now().toString().slice(-6)}`,
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
          await supabase
            .from('telegram_sessions')
            .update({ step: 'AWAITING_PUBLICATION_CONFIRMATION' })
            .eq('id', sessionId);

          await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'msg_publish_db_error'), true);
          await sendTelegramMessage(
            chatId,
            getTelegramText(sellerLang, 'msg_publish_db_error')
          );
          return NextResponse.json({ ok: true });
        }

        // Product created successfully! Clean up session
        await supabase.from('telegram_sessions').delete().eq('id', sessionId);
        await answerTelegramCallbackQuery(cbId, getTelegramText(sellerLang, 'alert_published_live'));

        const publishSuccessMsgs: Record<string, string> = {
          ru: `🎉 <b>Товар успешно опубликован!</b>\n\n` +
              `Товар <b>"${newProduct.title}"</b> теперь активен в магазине <b>${store.name}</b>.\n\n` +
              `💰 Цена: <b>${newProduct.price.toLocaleString()} UZS</b>\n` +
              `📦 В наличии: <b>${newProduct.stock_quantity} шт.</b>\n` +
              `📁 Статус: <b>ACTIVE</b>\n\n` +
              `Покупатели уже могут найти и заказать этот товар на TrendMall.`,
          uz: `🎉 <b>Mahsulot muvaffaqiyatli e'lon qilindi!</b>\n\n` +
              `<b>"${newProduct.title}"</b> endi <b>${store.name}</b> do'konida faol.\n\n` +
              `💰 Narxi: <b>${newProduct.price.toLocaleString()} UZS</b>\n` +
              `📦 Omborda: <b>${newProduct.stock_quantity} dona</b>\n` +
              `📁 Holati: <b>ACTIVE</b>\n\n` +
              `Xaridorlar ushbu mahsulotni TrendMall'da xarid qilishlari mumkin.`,
          en: `🎉 <b>Product Published Successfully!</b>\n\n` +
              `Your product <b>"${newProduct.title}"</b> is now live in <b>${store.name}</b>.\n\n` +
              `💰 Price: <b>${newProduct.price.toLocaleString()} UZS</b>\n` +
              `📦 Available Stock: <b>${newProduct.stock_quantity} pcs</b>\n` +
              `📁 Status: <b>ACTIVE</b>\n\n` +
              `Customers can now discover and purchase this item on TrendMall.`,
        };

        await sendTelegramMessage(
          chatId,
          publishSuccessMsgs[sellerLang],
          getLocalizedMenu(sellerLang)
        );
        return NextResponse.json({ ok: true });
      }

      await answerTelegramCallbackQuery(cbId);
      return NextResponse.json({ ok: true });
    }

    // =========================================================================
    // 3. Handle Telegram Messages (Text, Photos, Commands)
    // =========================================================================
    const message = update.message;
    if (!message) return NextResponse.json({ ok: true });
    const chatId = String(message.chat.id);
    const text = message.text?.trim() || '';

    // 3.1 Handle One-Time Account Linking (/link CODE or /start CODE)
    let linkCode: string | null = null;
    if (text.startsWith('/link')) {
      linkCode = text.replace(/^\/link\s*/i, '').trim();
    } else if (text.startsWith('/start') && text.length > 6) {
      linkCode = text.replace(/^\/start\s*/i, '').trim();
    }

    if (linkCode) {
      const normalizedCode = linkCode.toUpperCase();

      if (!/^[A-F0-9]{32}$/i.test(normalizedCode)) {
        await sendTelegramMessage(
          chatId,
          "⚠️ <b>Noto'g'ri kod</b>\n\nIltimos, TrendMall sotuvchi hisobingizdagi 32 belgidan iborat to'g'ri ulanish kodini kiriting."
        );
        return NextResponse.json({ ok: true });
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
        return NextResponse.json({ ok: true });
      }

      const parts = matchedUser.telegram_code.split(':');
      const expiresAt = parseInt(parts[1], 10);
      if (!expiresAt || Date.now() > expiresAt) {
        await supabase.from('users').update({ telegram_code: null }).eq('id', matchedUser.id);
        await sendTelegramMessage(
          chatId,
          "⏳ <b>Kod muddati o'tgan</b>\n\nUlanish kodi muddati tugagan (kodlar 10 daqiqa davomida amal qiladi). Iltimos, TrendMall hisobingizda yangi kod yarating."
        );
        return NextResponse.json({ ok: true });
      }

      if (matchedUser.role !== 'SELLER') {
        await supabase.from('users').update({ telegram_code: null }).eq('id', matchedUser.id);
        await sendTelegramMessage(
          chatId,
          "⛔ <b>Ruxsat berilmadi</b>\n\nFaqat ro'yxatdan o'tgan sotuvchilar Telegram hisobini TrendMall'ga ulashi mumkin."
        );
        return NextResponse.json({ ok: true });
      }

      const { data: targetStore, error: storeCheckErr } = await supabase
        .from('stores')
        .select('id, name, status')
        .eq('owner_id', matchedUser.id)
        .maybeSingle();

      if (storeCheckErr || !targetStore) {
        await supabase.from('users').update({ telegram_code: null }).eq('id', matchedUser.id);
        await sendTelegramMessage(
          chatId,
          "⚠️ <b>Do'kon topilmadi</b>\n\nUshbu hisobga biriktirilgan do'kon topilmadi. Iltimos, avval do'koningizni ro'yxatdan o'tkazing."
        );
        return NextResponse.json({ ok: true });
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
        return NextResponse.json({ ok: true });
      }

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
        return NextResponse.json({ ok: true });
      }

      // Check if language was previously selected in user_metadata
      let savedPrefLang: string | null = null;
      try {
        const { data: authU } = await supabase.auth.admin.getUserById(matchedUser.id);
        const l = authU?.user?.user_metadata?.preferred_language;
        if (l && ['ru', 'uz', 'en'].includes(l)) savedPrefLang = l;
      } catch (e) {
        // silent
      }

      const linkLang = resolveTelegramLanguage(savedPrefLang);

      const welcomeConnected: Record<string, string> = {
        ru: `✅ <b>Telegram успешно подключён!</b>\n\nВаш аккаунт связан с магазином <b>${targetStore.name}</b>.\n\nИспользуйте меню ниже для работы с заказами и товарами.`,
        uz: `✅ <b>Telegram muvaffaqiyatli ulandi!</b>\n\nSizning hisobingiz <b>${targetStore.name}</b> do'koniga ulandi.\n\nBuyurtmalar va mahsulotlar bilan ishlash uchun quyidagi menyudan foydalaning.`,
        en: `✅ <b>Telegram Successfully Linked!</b>\n\nYour account is connected to <b>${targetStore.name}</b>.\n\nUse the menu below to manage orders and inventory.`,
      };
      await sendTelegramMessage(chatId, welcomeConnected[linkLang], getLocalizedMenu(linkLang));
      return NextResponse.json({ ok: true });
    }

    // Timing diagnostics for /start command latency analysis
    const isStartCommand = text === '/start';
    const startHandlerTime = isStartCommand ? Date.now() : 0;
    let usersMs = 0;
    let authMs = 0;
    let storesMs = 0;
    let telegramMs = 0;

    // 3.2 Authenticate user strictly by verified telegram_id
    const tUsersStart = isStartCommand ? Date.now() : 0;
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('telegram_id', chatId)
      .maybeSingle();
    if (isStartCommand) {
      usersMs = Date.now() - tUsersStart;
    }

    if (userError) throw userError;

    if (!user || user.role !== 'SELLER') {
      // Unknown / unlinked Telegram user:
      // Default response language is ALWAYS Uzbek.
      // Show Access Denied in Uzbek and provide language selector so user can choose another language.
      const tTelegramStart = isStartCommand ? Date.now() : 0;
      await sendTelegramMessage(
        chatId,
        getAccessDeniedMessage('uz'),
        LANGUAGE_SELECTOR_KEYBOARD
      );
      if (isStartCommand) {
        telegramMs = Date.now() - tTelegramStart;
        const totalMs = Date.now() - startHandlerTime;
        console.log(
          `[TELEGRAM_START_TIMING]\n${JSON.stringify(
            {
              totalMs,
              usersMs,
              authMs,
              storesMs,
              telegramMs,
            },
            null,
            2
          )}`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Read seller's preferred language from Supabase Auth user_metadata
    let preferredLanguage: 'ru' | 'uz' | 'en' | null = null;
    const tAuthStart = isStartCommand ? Date.now() : 0;
    try {
      const { data: authUserData, error: authUserErr } = await supabase.auth.admin.getUserById(user.id);
      if (authUserErr) {
        console.warn('Failed to retrieve user_metadata for seller:', user.id, authUserErr);
      }
      const savedLang = authUserData?.user?.user_metadata?.preferred_language;
      if (savedLang && ['ru', 'uz', 'en'].includes(savedLang)) {
        preferredLanguage = savedLang as 'ru' | 'uz' | 'en';
      }
    } catch (langErr) {
      console.warn('Failed to retrieve user_metadata for seller:', user.id, langErr);
    } finally {
      if (isStartCommand) {
        authMs = Date.now() - tAuthStart;
      }
    }

    const currentLangKey: 'ru' | 'uz' | 'en' = resolveTelegramLanguage(preferredLanguage);

    // 3.3 Authorize seller store (strictly by owner_id)
    const tStoresStart = isStartCommand ? Date.now() : 0;
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('id, name, status')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (isStartCommand) {
      storesMs = Date.now() - tStoresStart;
    }

    if (storeError) throw storeError;

    if (!store) {
      const noStoreMsgs: Record<string, string> = {
        uz: "⚠️ <b>Do'kon topilmadi</b>\n\nHisobingizga bog'langan sotuvchi do'koni topilmadi. Mahsulotlarni boshqarishdan oldin Sotuvchi portalida do'koningizni ro'yxatdan o'tkazing.",
        ru: '⚠️ <b>Магазин не найден</b>\n\nК вашему аккаунту не привязан магазин. Пожалуйста, создайте или привяжите магазин в панели продавца перед управлением товарами.',
        en: '⚠️ <b>No Store Found</b>\n\nNo merchant store is linked to your account. Please create or link your store in the Seller Portal before managing inventory.',
      };
      const tTelegramStart = isStartCommand ? Date.now() : 0;
      await sendTelegramMessage(chatId, noStoreMsgs[currentLangKey]);
      if (isStartCommand) {
        telegramMs = Date.now() - tTelegramStart;
        const totalMs = Date.now() - startHandlerTime;
        console.log(
          `[TELEGRAM_START_TIMING]\n${JSON.stringify(
            {
              totalMs,
              usersMs,
              authMs,
              storesMs,
              telegramMs,
            },
            null,
            2
          )}`
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (store.status !== 'APPROVED') {
      const storeInactiveMsgs: Record<string, string> = {
        uz: `⚠️ <b>Do'kon faol emas</b>\n\nSizning "<b>${store.name}</b>" do'koningiz hozirda <b>${store.status}</b> holatida. Mahsulot operatsiyalari do'kon tasdiqlangandan so'ng mavjud bo'ladi.`,
        ru: `⚠️ <b>Магазин не активен</b>\n\nВаш магазин "<b>${store.name}</b>" в настоящее время находится в статусе <b>${store.status}</b>. Операции с товарами станут доступны после одобрения магазина.`,
        en: `⚠️ <b>Store Not Active</b>\n\nYour store "<b>${store.name}</b>" is currently <b>${store.status}</b>. Product operations will be available once your store is approved.`,
      };
      const tTelegramStart = isStartCommand ? Date.now() : 0;
      await sendTelegramMessage(chatId, storeInactiveMsgs[currentLangKey]);
      if (isStartCommand) {
        telegramMs = Date.now() - tTelegramStart;
        const totalMs = Date.now() - startHandlerTime;
        console.log(
          `[TELEGRAM_START_TIMING]\n${JSON.stringify(
            {
              totalMs,
              usersMs,
              authMs,
              storesMs,
              telegramMs,
            },
            null,
            2
          )}`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // 3.5 Handle /start for authenticated APPROVED seller
    if (text === '/start') {
      const welcomeTexts: Record<string, string> = {
        ru: `👋 <b>Добро пожаловать в TrendMall!</b>\n\nИспользуйте меню ниже для управления магазином <b>${store.name}</b>.`,
        uz: `👋 <b>TrendMall'ga xush kelibsiz!</b>\n\n<b>${store.name}</b> do'koningizni boshqarish uchun quyidagi menyudan foydalaning.`,
        en: `👋 <b>Welcome back to TrendMall!</b>\n\nUse the menu below to manage <b>${store.name}</b>.`,
      };

      const tTelegramStart = Date.now();
      await sendTelegramMessage(chatId, welcomeTexts[currentLangKey], getLocalizedMenu(currentLangKey));
      telegramMs = Date.now() - tTelegramStart;

      const totalMs = Date.now() - startHandlerTime;

      console.log(
        `[TELEGRAM_START_TIMING]\n${JSON.stringify(
          {
            totalMs,
            usersMs,
            authMs,
            storesMs,
            telegramMs,
          },
          null,
          2
        )}`
      );

      return NextResponse.json({ ok: true });
    }

    // 3.6 /cancel command: Safely cancels only the active seller's unfinished draft session
    if (text === '/cancel' || text.toLowerCase() === 'cancel') {
      const { data: deletedSession } = await supabase
        .from('telegram_sessions')
        .delete()
        .eq('seller_telegram_id', chatId)
        .eq('store_id', store.id)
        .select('id');

      const cancelMsgs: Record<string, string> = {
        ru: '❌ <b>Черновик товара отменён</b>\n\nНажмите ➕ Добавить товар или отправьте фото в любое время.',
        uz: "❌ <b>Mahsulot qoralamasi bekor qilindi</b>\n\n➕ Mahsulot qo'shish tugmasini bosing yoki rasm yuboring.",
        en: '❌ <b>Product Draft Cancelled</b>\n\nTap ➕ Add Product or send a photo anytime.',
      };

      const noSessionMsgs: Record<string, string> = {
        ru: 'ℹ️ Нет активного черновика для отмены. Отправьте фото товара в любое время.',
        uz: "ℹ️ Bekor qilish uchun faol qoralama topilmadi. Mahsulot rasmini istalgan vaqtda yuborishingiz mumkin.",
        en: 'ℹ️ No active product draft found to cancel. Send a product photo anytime to add an item.',
      };

      const msg = deletedSession && deletedSession.length > 0
        ? cancelMsgs[currentLangKey]
        : noSessionMsgs[currentLangKey];

      await sendTelegramMessage(chatId, msg, getLocalizedMenu(currentLangKey));
      return NextResponse.json({ ok: true });
    }

    // 3.7 Add Product button handler (ReplyKeyboardMarkup)
    const isAddProductText =
      text === '➕ Add Product' ||
      text === '➕ Добавить товар' ||
      text === "➕ Mahsulot qo'shish" ||
      text.toLowerCase() === 'add product' ||
      text.toLowerCase() === 'добавить товар';

    if (isAddProductText) {
      // Clean up previous unfinished draft sessions for this seller & store
      await supabase
        .from('telegram_sessions')
        .delete()
        .eq('seller_telegram_id', chatId)
        .eq('store_id', store.id);

      // Create a fresh telegram session using the existing schema
      const freshSessionId = crypto.randomUUID();
      const { error: newSessionErr } = await supabase.from('telegram_sessions').insert({
        id: freshSessionId,
        seller_telegram_id: chatId,
        store_id: store.id,
        step: 'AWAITING_PHOTO',
        raw_image_url: null,
        processed_image_url: null,
        extracted_metadata: null,
        draft: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (newSessionErr) {
        console.error('Failed to create fresh telegram session:', newSessionErr);
      }

      // Localized prompt for uploading a photo
      const addProductPrompts: Record<string, string> = {
        ru: '📸 <b>Отправьте фото товара.</b> Я распознаю его с помощью AI и подготовлю карточку товара.',
        uz: "📸 <b>Mahsulot rasmini yuboring.</b> Men AI yordamida uni tahlil qilib, mahsulot kartasini tayyorlayman.",
        en: "📸 <b>Send a photo of the product.</b> I'll analyze it with AI and prepare the product listing.",
      };

      const promptText = addProductPrompts[currentLangKey];
      await sendTelegramMessage(chatId, promptText, {
        inline_keyboard: [[{ text: getTelegramText(currentLangKey, 'btn_cancel'), callback_data: `cancel_${freshSessionId}` }]],
      });
      return NextResponse.json({ ok: true });
    }

    // 3.8 Inventory query ('📦 My Products' / '📦 Мои товары' / '📦 Mening mahsulotlarim')
    const isMyProductsText =
      text === '📦 My Products' ||
      text === '📦 Мои товары' ||
      text === '📦 Mening mahsulotlarim' ||
      text === "📦 Mahsulotlarim" ||
      text.toLowerCase() === 'my products' ||
      text.toLowerCase() === 'мои товары';

    if (isMyProductsText) {
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id);

      if (error) throw error;

      const inventoryMsgs: Record<string, string> = {
        ru: `📦 Товаров в магазине <b>${store.name}</b>: <b>${count ?? 0}</b>`,
        uz: `📦 <b>${store.name}</b> do'konidagi mahsulotlar: <b>${count ?? 0}</b>`,
        en: `📦 Products in <b>${store.name}</b>: <b>${count ?? 0}</b>`,
      };

      await sendTelegramMessage(chatId, inventoryMsgs[currentLangKey], getLocalizedMenu(currentLangKey));
      return NextResponse.json({ ok: true });
    }

    // 3.8.1 Language selection button handler ('🌐 Til' / '🌐 Язык' / '🌐 Language')
    const isLanguageButtonText =
      text === '🌐 Til' ||
      text === '🌐 Язык' ||
      text === '🌐 Language' ||
      text === '/language' ||
      text.toLowerCase() === 'til' ||
      text.toLowerCase() === 'язык' ||
      text.toLowerCase() === 'language';

    if (isLanguageButtonText) {
      const langPromptTexts: Record<string, string> = {
        uz: '🌐 <b>Tilni tanlang:</b>',
        ru: '🌐 <b>Выберите язык:</b>',
        en: '🌐 <b>Choose a language:</b>',
      };

      await sendTelegramMessage(
        chatId,
        langPromptTexts[currentLangKey] || langPromptTexts.uz,
        LANGUAGE_SELECTOR_KEYBOARD
      );
      return NextResponse.json({ ok: true });
    }

    // 3.9 Seller Uploads Photo
    if (message.photo?.length) {
      const file = message.photo.at(-1);
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || !file) {
        console.error('Telegram photo upload: TELEGRAM_BOT_TOKEN or file payload is missing');
        await sendTelegramMessage(chatId, '⚠️ Bot service configuration error. Please contact platform support.');
        return NextResponse.json({ ok: true });
      }

      // Send immediate feedback so user sees "typing..." in chat header before heavy processing
      sendTelegramChatAction(chatId, 'typing').catch(() => {});

      // Download photo bytes into server memory
      const getFileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${file.file_id}`);
      const getFileResult = await getFileRes.json();
      if (!getFileResult.ok || !getFileResult.result?.file_path) {
        console.warn('Telegram getFile returned error for file_id:', file.file_id);
        await sendTelegramMessage(
          chatId,
          getTelegramText(currentLangKey, 'msg_photo_get_error')
        );
        return NextResponse.json({ ok: true });
      }

      // SECURITY INVARIANT: The download URL is kept strictly in local memory and NEVER saved or exposed.
      const downloadUrl = `https://api.telegram.org/file/bot${token}/${getFileResult.result.file_path}`;
      const imgRes = await fetch(downloadUrl);
      if (!imgRes.ok) {
        console.warn('Failed to download image bytes from Telegram API for file_id:', file.file_id);
        await sendTelegramMessage(chatId, getTelegramText(currentLangKey, 'msg_photo_download_error'));
        return NextResponse.json({ ok: true });
      }

      const arrayBuf = await imgRes.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuf);

      // Re-trigger typing indicator so user sees activity throughout parallel processing
      sendTelegramChatAction(chatId, 'typing').catch(() => {});

      // Concurrently execute Sharp image processing / Supabase Storage upload AND Gemini Vision extraction
      const sessionId = crypto.randomUUID();

      const imageProcessingPromise = processAndStoreProductImage({
        inputBuffer: imageBuffer,
        storeId: store.id,
        fileId: sessionId,
      });

      const aiAnalysisPromise = analyzeClothingImage(imageBuffer, 'image/jpeg', currentLangKey).catch(
        (aiErr: any) => {
          console.warn('Gemini Vision extraction failed for store:', store.id, aiErr?.message || aiErr);
          return null;
        }
      );

      let processedImage;
      let aiResult: VisionAnalysisResult | null = null;
      try {
        [processedImage, aiResult] = await Promise.all([imageProcessingPromise, aiAnalysisPromise]);
      } catch (procErr: any) {
        console.warn('Product image processing failed for store:', store.id, procErr?.message || procErr);
        const fallbackHelp = currentLangKey === 'uz'
          ? "Iltimos, hajmi 15MB dan kam bo'lgan aniq rasm (JPEG, PNG yoki WebP) yuboring."
          : currentLangKey === 'ru'
          ? 'Пожалуйста, отправьте четкое фото (JPEG, PNG или WebP) размером менее 15 МБ.'
          : 'Please send a clear photo (JPEG, PNG, or WebP) under 15MB.';
        await sendTelegramMessage(
          chatId,
          `${getTelegramText(currentLangKey, 'msg_image_processing_failed')}\n\n${procErr?.message || fallbackHelp}`
        );
        return NextResponse.json({ ok: true });
      }

      // Clean up previous uncompleted draft sessions for this seller & store
      await supabase
        .from('telegram_sessions')
        .delete()
        .eq('seller_telegram_id', chatId)
        .eq('store_id', store.id);

      if (aiResult) {
        // Load real categories & brands from database concurrently
        const [{ data: categories }, { data: brands }] = await Promise.all([
          supabase.from('categories').select('*'),
          supabase.from('brands').select('*'),
        ]);

        const mappedCat = matchCategory(aiResult.category, aiResult.gender, categories || []);
        const mappedBrand = matchBrand(aiResult.brand, brands || []);

        if (mappedCat) {
          // Category matched successfully: proceed to AWAITING_PRICE
          const { error: sessionErr } = await supabase.from('telegram_sessions').insert({
            id: sessionId,
            seller_telegram_id: chatId,
            store_id: store.id,
            step: 'AWAITING_PRICE',
            raw_image_url: null,
            processed_image_url: processedImage.publicUrl,
            extracted_metadata: aiResult,
            draft: {
              image: processedImage.publicUrl,
              storagePath: processedImage.storagePath,
              ai: aiResult,
              category_id: mappedCat.categoryId,
              category_name: mappedCat.categoryName,
              brand_id: mappedBrand.brandId,
              brand_name: mappedBrand.brandName,
              price: null,
              stock: null,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (sessionErr) throw sessionErr;

          const { promptText, keyboard } = buildPriceStepPromptAndKeyboard(
            aiResult,
            mappedCat.categoryName,
            mappedBrand.brandName,
            sessionId,
            currentLangKey
          );

          await sendTelegramMessage(chatId, promptText, keyboard);
        } else {
          // Category could not be safely determined: ask seller to pick a valid category
          const { error: sessionErr } = await supabase.from('telegram_sessions').insert({
            id: sessionId,
            seller_telegram_id: chatId,
            store_id: store.id,
            step: 'AWAITING_CATEGORY',
            raw_image_url: null,
            processed_image_url: processedImage.publicUrl,
            extracted_metadata: aiResult,
            draft: {
              image: processedImage.publicUrl,
              storagePath: processedImage.storagePath,
              ai: aiResult,
              brand_id: mappedBrand.brandId,
              brand_name: mappedBrand.brandName,
              category_id: null,
              category_name: null,
              price: null,
              stock: null,
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (sessionErr) throw sessionErr;

          // Provide root categories for seller selection
          const rootCats = (categories || []).filter((c) => !c.parent_id).slice(0, 5);
          const inlineCatButtons = rootCats.map((c) => [
            { text: `📁 ${c.name}`, callback_data: `select_cat_${c.id}` },
          ]);
          inlineCatButtons.push([{ text: getTelegramText(currentLangKey, 'btn_cancel'), callback_data: `cancel_${sessionId}` }]);

          await sendTelegramMessage(
            chatId,
            `✨ <b>${getTelegramText(currentLangKey, 'ai_complete')}</b>\n\n` +
            `🏷 <b>${getTelegramText(currentLangKey, 'label_title')}:</b> ${aiResult.title}\n` +
            `🎨 <b>${getTelegramText(currentLangKey, 'label_color')}:</b> ${aiResult.color}\n` +
            `👤 <b>${getTelegramText(currentLangKey, 'label_gender')}:</b> ${aiResult.gender}\n\n` +
            `❓ <b>${getTelegramText(currentLangKey, 'choose_category_prompt')}</b>`,
            { inline_keyboard: inlineCatButtons }
          );
        }
      } else {
        // AI extraction failed or unconfigured: save draft and offer manual details entry
        await supabase.from('telegram_sessions').insert({
          id: sessionId,
          seller_telegram_id: chatId,
          store_id: store.id,
          step: 'AWAITING_DETAILS',
          raw_image_url: null,
          processed_image_url: processedImage.publicUrl,
          extracted_metadata: null,
          draft: {
            image: processedImage.publicUrl,
            storagePath: processedImage.storagePath,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        await sendTelegramMessage(
          chatId,
          '📸 <b>Photo processed & saved securely (1000x1000 WebP)!</b>\n\n' +
          'Please reply with the product details in format:\n' +
          '<code>Title | price | stock | description</code>\n\n' +
          '<i>Example: Linen Summer Blazer | 450000 | 10 | Premium European linen blazer</i>',
          { inline_keyboard: [[{ text: '❌ Cancel', callback_data: `cancel_${sessionId}` }]] }
        );
      }

      return NextResponse.json({ ok: true });
    }

    // 3.10 Handle Text Inputs for Active Session State Machine
    const { data: activeSession } = await supabase
      .from('telegram_sessions')
      .select('*')
      .eq('seller_telegram_id', chatId)
      .eq('store_id', store.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeSession) {
      // Step A: AWAITING_PRICE
      if (activeSession.step === 'AWAITING_PRICE') {
        const priceRes = validatePriceInput(text, currentLangKey);

        if (!priceRes.valid || !priceRes.price) {
          const invalidPriceHeader = currentLangKey === 'uz'
            ? "⚠️ <b>Noto'g'ri narx</b>"
            : currentLangKey === 'ru'
            ? '⚠️ <b>Неверная цена</b>'
            : '⚠️ <b>Invalid Price</b>';

          const priceExample = currentLangKey === 'uz'
            ? "*Misol: <code>450000</code> yoki <code>450 000</code>*\n*Bekor qilish uchun /cancel yuboring*"
            : currentLangKey === 'ru'
            ? '*Пример: <code>450000</code> или <code>450 000</code>*\n*Для отмены отправьте /cancel*'
            : '*Example: <code>450000</code> or <code>450 000</code>*\n*To cancel, send /cancel*';

          await sendTelegramMessage(
            chatId,
            `${invalidPriceHeader}\n\n${priceRes.error || (currentLangKey === 'uz' ? "Iltimos, so'mda to'g'ri narx kiriting." : currentLangKey === 'ru' ? 'Пожалуйста, введите корректную цену в UZS.' : 'Please enter a valid price in UZS.')}\n\n${priceExample}`
          );
          return NextResponse.json({ ok: true });
        }

        const updatedDraft = { ...(activeSession.draft || {}), price: priceRes.price };
        await supabase
          .from('telegram_sessions')
          .update({
            step: 'AWAITING_STOCK',
            draft: updatedDraft,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeSession.id);

        await sendTelegramMessage(
          chatId,
          `${getTelegramText(currentLangKey, 'price_confirmed', { price: priceRes.price.toLocaleString() })}\n\n` +
          `${getTelegramText(currentLangKey, 'step2_header')}\n` +
          `${getTelegramText(currentLangKey, 'enter_stock_prompt')}`,
          {
            inline_keyboard: [
              [
                { text: getTelegramText(currentLangKey, 'btn_stock_1'), callback_data: 'set_stock_1' },
                { text: getTelegramText(currentLangKey, 'btn_stock_5'), callback_data: 'set_stock_5' },
                { text: getTelegramText(currentLangKey, 'btn_stock_10'), callback_data: 'set_stock_10' },
              ],
              [{ text: getTelegramText(currentLangKey, 'btn_cancel'), callback_data: `cancel_${activeSession.id}` }],
            ],
          }
        );
        return NextResponse.json({ ok: true });
      }

      // Step B: AWAITING_STOCK
      if (activeSession.step === 'AWAITING_STOCK') {
        const stockRes = validateStockInput(text, currentLangKey);

        if (!stockRes.valid || !stockRes.stock) {
          const invalidStockHeader = currentLangKey === 'uz'
            ? "⚠️ <b>Noto'g'ri miqdor</b>"
            : currentLangKey === 'ru'
            ? '⚠️ <b>Неверное количество</b>'
            : '⚠️ <b>Invalid Stock</b>';

          const stockExample = currentLangKey === 'uz'
            ? "*Misol: <code>5</code> yoki <code>10</code>*\n*Bekor qilish uchun /cancel yuboring*"
            : currentLangKey === 'ru'
            ? '*Пример: <code>5</code> или <code>10</code>*\n*Для отмены отправьте /cancel*'
            : '*Example: <code>5</code> or <code>10</code>*\n*To cancel, send /cancel*';

          await sendTelegramMessage(
            chatId,
            `${invalidStockHeader}\n\n${stockRes.error || (currentLangKey === 'uz' ? "Iltimos, butun son kiriting." : currentLangKey === 'ru' ? 'Пожалуйста, введите целое число.' : 'Please enter a valid whole number.')}\n\n${stockExample}`
          );
          return NextResponse.json({ ok: true });
        }

        const updatedDraft = { ...(activeSession.draft || {}), stock: stockRes.stock };
        await supabase
          .from('telegram_sessions')
          .update({
            step: 'AWAITING_PUBLICATION_CONFIRMATION',
            draft: updatedDraft,
            updated_at: new Date().toISOString(),
          })
          .eq('id', activeSession.id);

        const ai = activeSession.draft?.ai || activeSession.extracted_metadata || {};
        const previewText = formatProductPreview({
          title: ai.title || 'Fashion Item',
          categoryName: activeSession.draft?.category_name || 'Fashion',
          brandName: activeSession.draft?.brand_name || null,
          color: ai.color || 'Standard',
          material: ai.material || null,
          gender: ai.gender || 'UNISEX',
          style: ai.style || null,
          occasion: ai.occasion || null,
          season: ai.season || null,
          description: ai.description || '',
          price: activeSession.draft?.price || 0,
          stock: stockRes.stock,
          tags: ai.tags || [],
        }, currentLangKey);

        await sendTelegramMessage(chatId, previewText, {
          inline_keyboard: [
            [{ text: getTelegramText(currentLangKey, 'btn_publish'), callback_data: `publish_${activeSession.id}` }],
            [{ text: getTelegramText(currentLangKey, 'btn_cancel'), callback_data: `cancel_${activeSession.id}` }],
          ],
        });
        return NextResponse.json({ ok: true });
      }

      // Step C: AWAITING_DETAILS (Manual fallback with pipe delimiter)
      if (activeSession.step === 'AWAITING_DETAILS' && text.includes('|')) {
        const parts = text.split('|').map((p: string) => p.trim());
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
          return NextResponse.json({ ok: true });
        }

        // Map category deterministically from available categories
        const { data: categories } = await supabase.from('categories').select('*');
        const mappedCat = matchCategory(title, 'UNISEX', categories || []) || (categories && categories[0]);

        if (!mappedCat) {
          await sendTelegramMessage(chatId, '⚠️ No category available in database. Please contact support.');
          return NextResponse.json({ ok: true });
        }

        const imageUrl = activeSession.processed_image_url || activeSession.draft?.image;
        if (!imageUrl) {
          await sendTelegramMessage(chatId, '⚠️ No active photo found for this draft. Please send a photo first.');
          return NextResponse.json({ ok: true });
        }

        const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const slug = `${baseSlug || 'product'}-${Date.now().toString().slice(-6)}`;

        const { data: newProd, error: prodErr } = await supabase
          .from('products')
          .insert({
            store_id: store.id,
            category_id: mappedCat.id,
            title,
            slug,
            description: description || '',
            price: priceRes.price,
            stock_quantity: stockRes.stock,
            currency: 'UZS',
            sku: `SKU-${Date.now().toString().slice(-6)}`,
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
          return NextResponse.json({ ok: true });
        }

        await supabase.from('telegram_sessions').delete().eq('id', activeSession.id);
        await sendTelegramMessage(
          chatId,
          `🎉 <b>${newProd.title}</b> published to <b>${store.name}</b> live!\n\n` +
          `💰 Price: <b>${newProd.price.toLocaleString()} UZS</b>\n` +
          `📦 Stock: <b>${newProd.stock_quantity} pcs</b>\n` +
          `📁 Status: <b>ACTIVE</b>`,
          getLocalizedMenu(currentLangKey)
        );
        return NextResponse.json({ ok: true });
      }
    }

    // Diagnostic logging for unhandled text messages
    if (text) {
      const safeSnippet = text.replace(/[\r\n\t]/g, ' ').slice(0, 80);
      console.log(`[Telegram] Unhandled text: "${safeSnippet}" chat=${chatId}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
