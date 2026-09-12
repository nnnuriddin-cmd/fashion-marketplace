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
} from '@/lib/telegram/product-draft';

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
  sessionId: string
) {
  const suggestedPrice = ai?.suggestedPrice;
  const hasValidSuggestedPrice =
    typeof suggestedPrice === 'number' &&
    Number.isInteger(suggestedPrice) &&
    suggestedPrice >= 1000;

  const rawDetails = formatAiExtractionDetails(
    { ...ai, suggestedPrice: undefined },
    categoryName,
    brandName
  );
  const stepHeader = '💰 <b>Step 1/2 — Set Product Price</b>';
  const baseCard = rawDetails.includes(stepHeader)
    ? rawDetails.split(stepHeader)[0] + stepHeader
    : rawDetails;

  let promptText = '';
  let keyboard: { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };

  if (hasValidSuggestedPrice) {
    promptText = `${baseCard}\n\n💡 Suggested price: ${suggestedPrice.toLocaleString()} UZS\nTap below to use it, or type your own price in UZS:`;
    keyboard = {
      inline_keyboard: [
        [{ text: `✅ Use ${suggestedPrice.toLocaleString()} UZS`, callback_data: `set_price_${suggestedPrice}` }],
        [{ text: '❌ Cancel', callback_data: `cancel_${sessionId}` }],
      ],
    };
  } else {
    promptText = `${baseCard}\n\n✍️ Please enter the price in UZS (minimum 1,000 UZS):\nExample: 150000`;
    keyboard = {
      inline_keyboard: [[{ text: '❌ Cancel', callback_data: `cancel_${sessionId}` }]],
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

      if (!store || store.status !== 'APPROVED') {
        await answerTelegramCallbackQuery(cbId, 'Store is not active', true);
        await sendTelegramMessage(
          chatId,
          `⚠️ <b>Store Inactive</b>\n\nYour store "${store?.name || 'Unknown'}" is currently ${store?.status || 'NOT APPROVED'}. Cannot perform product operations.`
        );
        return NextResponse.json({ ok: true });
      }

      // Read seller's current preferred language from Supabase Auth user_metadata
      let sellerLang: 'uz' | 'ru' | 'en' = 'uz';
      try {
        const { data: authData } = await supabase.auth.admin.getUserById(user.id);
        const l = authData?.user?.user_metadata?.preferred_language;
        if (l && ['ru', 'uz', 'en'].includes(l)) sellerLang = l as 'uz' | 'ru' | 'en';
      } catch (e) {
        console.warn('Could not read seller preferred_language:', e);
      }

      // 2.1 Language selection callback (language_ru, language_uz, language_en)
      if (data.startsWith('language_')) {
        const rawLang = data.replace('language_', '');
        const validLang: 'ru' | 'uz' | 'en' = ['ru', 'uz', 'en'].includes(rawLang)
          ? (rawLang as 'ru' | 'uz' | 'en')
          : 'uz';

        // Persist preferred_language in Supabase Auth user_metadata
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

        // Clear the inline keyboard from the original language-picker message
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
      }

      // 2.2 Cancel Draft Callback (e.g. cancel_<sessionId> or cancel_draft)
      if (data.startsWith('cancel_')) {
        await answerTelegramCallbackQuery(cbId, 'Draft cancelled');

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
        const priceRes = validatePriceInput(priceStr);

        if (!priceRes.valid || !priceRes.price || priceRes.price < 1000) {
          if (cb.message?.message_id) {
            await clearTelegramInlineKeyboard(chatId, cb.message.message_id);
          }
          await answerTelegramCallbackQuery(cbId, 'Invalid price (min 1,000 UZS)', true);
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
          await answerTelegramCallbackQuery(cbId, 'No active draft session', true);
          return NextResponse.json({ ok: true });
        }

        await answerTelegramCallbackQuery(cbId, `Price set: ${priceRes.price.toLocaleString()} UZS`);

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
          `✅ <b>Price Confirmed:</b> <b>${priceRes.price.toLocaleString()} UZS</b>\n\n` +
          `📦 <b>Step 2/2 — Set Available Stock</b>\n` +
          `Please enter the inventory quantity (whole number ≥ 1, e.g. <code>10</code>) or select a quick option below:`,
          {
            inline_keyboard: [
              [
                { text: '1 pc', callback_data: 'set_stock_1' },
                { text: '5 pcs', callback_data: 'set_stock_5' },
                { text: '10 pcs', callback_data: 'set_stock_10' },
              ],
              [{ text: '❌ Cancel', callback_data: `cancel_${session.id}` }],
            ],
          }
        );
        return NextResponse.json({ ok: true });
      }

      // 2.4 Set Quick Stock Callback (set_stock_<stock>)
      if (data.startsWith('set_stock_')) {
        const stockStr = data.replace('set_stock_', '');
        const stockRes = validateStockInput(stockStr);

        if (!stockRes.valid || !stockRes.stock) {
          await answerTelegramCallbackQuery(cbId, 'Invalid stock quantity', true);
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
          await answerTelegramCallbackQuery(cbId, 'Please enter product price first', true);
          return NextResponse.json({ ok: true });
        }

        // 1. Acknowledge callback promptly
        await answerTelegramCallbackQuery(cbId, `Stock set: ${stockRes.stock} pcs`);

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
        });

        await sendTelegramMessage(chatId, previewText, {
          inline_keyboard: [
            [{ text: '🚀 Publish Product', callback_data: `publish_${session.id}` }],
            [{ text: '❌ Cancel', callback_data: `cancel_${session.id}` }],
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
          await answerTelegramCallbackQuery(cbId, 'Category not found', true);
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
          await answerTelegramCallbackQuery(cbId, 'Session expired', true);
          return NextResponse.json({ ok: true });
        }

        await answerTelegramCallbackQuery(cbId, `Category: ${cat.name}`);

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
          session.id
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
            await answerTelegramCallbackQuery(cbId, 'Already published!', true);
            await sendTelegramMessage(
              chatId,
              `✅ <b>${existingProd.title}</b> is already live on TrendMall!`,
              getLocalizedMenu(sellerLang)
            );
            return NextResponse.json({ ok: true });
          }

          await answerTelegramCallbackQuery(cbId, 'Draft session expired or already processed', true);
          return NextResponse.json({ ok: true });
        }

        // Acknowledge callback promptly so the Telegram client stops spinning
        await answerTelegramCallbackQuery(cbId, 'Publishing product live...');

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

          await answerTelegramCallbackQuery(cbId, 'Missing required product information');
          await sendTelegramMessage(
            chatId,
            '⚠️ <b>Incomplete Draft</b>\n\nSome required product details are missing. Please enter price and stock before publishing.'
          );
          return NextResponse.json({ ok: true });
        }

        // SECURITY INVARIANT: Image URL must be from permanent Supabase Storage, never Telegram Bot API
        if (imageUrl.includes('api.telegram.org') || imageUrl.includes('/bot')) {
          console.error('CRITICAL SECURITY: Refusing product publication with Telegram Bot API URL');
          await supabase.from('telegram_sessions').delete().eq('id', sessionId);
          await answerTelegramCallbackQuery(cbId, 'Image security error');
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

          await answerTelegramCallbackQuery(cbId, 'Database error while publishing');
          await sendTelegramMessage(
            chatId,
            '⚠️ <b>Publication Failed</b>\n\nA database error occurred while creating your product. Please tap <b>🚀 Publish Product</b> to retry, or /cancel.'
          );
          return NextResponse.json({ ok: true });
        }

        // Product created successfully! Clean up session
        await supabase.from('telegram_sessions').delete().eq('id', sessionId);
        await answerTelegramCallbackQuery(cbId, '🎉 Product published live!');

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
          '⚠️ <b>Invalid Linking Code / Noto\'g\'ri kod</b>\n\n' +
          'Please provide a valid 32-character linking code from your TrendMall seller account.'
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
          '❌ <b>Invalid or Expired Code / Kod yaroqsiz yoki muddati o\'tgan</b>\n\n' +
          'No active linking request found for this code. Please generate a fresh code in your TrendMall account.'
        );
        return NextResponse.json({ ok: true });
      }

      const parts = matchedUser.telegram_code.split(':');
      const expiresAt = parseInt(parts[1], 10);
      if (!expiresAt || Date.now() > expiresAt) {
        await supabase.from('users').update({ telegram_code: null }).eq('id', matchedUser.id);
        await sendTelegramMessage(
          chatId,
          '⏳ <b>Code Expired / Kod muddati o\'tdi</b>\n\n' +
          'This linking code has expired (codes are valid for 10 minutes). Please generate a fresh code in your TrendMall account.'
        );
        return NextResponse.json({ ok: true });
      }

      if (matchedUser.role !== 'SELLER') {
        await supabase.from('users').update({ telegram_code: null }).eq('id', matchedUser.id);
        await sendTelegramMessage(
          chatId,
          '⛔ <b>Access Denied / Ruxsat berilmadi</b>\n\n' +
          'Only registered sellers can connect a Telegram account to TrendMall.'
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
          '⚠️ <b>No Store Found / Do\'kon topilmadi</b>\n\n' +
          'No merchant boutique is associated with this account. Please register your store first.'
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
          '⛔ <b>Account Conflict / Boshqa hisobga ulangan</b>\n\n' +
          'This Telegram account is already linked to another TrendMall seller account. Please unlink it from that account first.'
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
          '⚠️ <b>Linking Failed / Ulanish amalga oshmadi</b>\n\n' +
          'This code may have already been consumed or expired. Please generate a new code in your TrendMall account.'
        );
        return NextResponse.json({ ok: true });
      }

      // Check if language was previously selected in user_metadata
      let initialLang: 'ru' | 'uz' | 'en' | null = null;
      try {
        const { data: authU } = await supabase.auth.admin.getUserById(matchedUser.id);
        const l = authU?.user?.user_metadata?.preferred_language;
        if (l && ['ru', 'uz', 'en'].includes(l)) initialLang = l as 'ru' | 'uz' | 'en';
      } catch (e) {
        // silent
      }

      if (initialLang) {
        const welcomeConnected: Record<string, string> = {
          ru: `✅ <b>Telegram успешно подключён!</b>\n\nВаш аккаунт связан с бутиком <b>${targetStore.name}</b>.\n\nИспользуйте меню ниже для работы с заказами и товарами.`,
          uz: `✅ <b>Telegram muvaffaqiyatli ulandi!</b>\n\nSizning hisobingiz <b>${targetStore.name}</b> butigiga ulandi.\n\nBuyurtmalar va mahsulotlar bilan ishlash uchun quyidagi menyudan foydalaning.`,
          en: `✅ <b>Telegram Successfully Linked!</b>\n\nYour account is connected to <b>${targetStore.name}</b>.\n\nUse the menu below to manage orders and inventory.`,
        };
        await sendTelegramMessage(chatId, welcomeConnected[initialLang], getLocalizedMenu(initialLang));
      } else {
        // First connection: default to 'uz' and persist it
        const fallbackLang: 'uz' = 'uz';
        try {
          const { error: persistErr } = await supabase.auth.admin.updateUserById(matchedUser.id, {
            user_metadata: { preferred_language: fallbackLang },
          });
          if (persistErr) {
            console.error('Failed to persist fallback language on link for user:', matchedUser.id, persistErr);
          }
        } catch (e) {
          console.error('Unexpected error persisting fallback language on link:', e);
        }

        // a) Send welcome/menu message with ReplyKeyboardMarkup (bottom keyboard armed immediately)
        const welcomeConnectedFirst = `✅ <b>Telegram muvaffaqiyatli ulandi!</b>\n\nSizning hisobingiz <b>${targetStore.name}</b> butigiga ulandi.\n\nBuyurtmalar va mahsulotlar bilan ishlash uchun quyidagi menyudan foydalaning.`;
        await sendTelegramMessage(chatId, welcomeConnectedFirst, getLocalizedMenu(fallbackLang));

        // b) Also prompt for language choice via InlineKeyboardMarkup so seller can change if desired
        await sendTelegramMessage(
          chatId,
          `🌐 <b>Tilni tanlang / Пожалуйста, выберите язык / Choose a language:</b>`,
          {
            inline_keyboard: [[
              { text: "🇺🇿 O‘zbekcha", callback_data: 'language_uz' },
              { text: '🇷🇺 Русский', callback_data: 'language_ru' },
              { text: '🇬🇧 English', callback_data: 'language_en' },
            ]],
          }
        );
      }
      return NextResponse.json({ ok: true });
    }

    // 3.2 Authenticate user strictly by verified telegram_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('telegram_id', chatId)
      .maybeSingle();

    if (userError) throw userError;

    if (!user || user.role !== 'SELLER') {
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

    // 3.3 Authorize seller store (strictly by owner_id)
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

    // 3.4 Read seller's preferred language from Supabase Auth user_metadata
    let preferredLanguage: 'ru' | 'uz' | 'en' | null = null;
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
    }

    const currentLangKey: 'ru' | 'uz' | 'en' = preferredLanguage || 'uz';

    // 3.5 Handle /start for authenticated APPROVED seller
    if (text === '/start') {
      const welcomeTexts: Record<string, string> = {
        ru: `👋 <b>Добро пожаловать в TrendMall!</b>\n\nИспользуйте меню ниже для управления магазином <b>${store.name}</b>.`,
        uz: `👋 <b>TrendMall'ga xush kelibsiz!</b>\n\n<b>${store.name}</b> do'koningizni boshqarish uchun quyidagi menyudan foydalaning.`,
        en: `👋 <b>Welcome back to TrendMall!</b>\n\nUse the menu below to manage <b>${store.name}</b>.`,
      };

      if (preferredLanguage) {
        // Seller has already chosen language: immediately send localized welcome message with ReplyKeyboardMarkup
        await sendTelegramMessage(chatId, welcomeTexts[preferredLanguage], getLocalizedMenu(preferredLanguage));
        return NextResponse.json({ ok: true });
      }

      // First-time /start when language is missing: fallback to 'uz' and persist it
      const fallbackLang: 'uz' = 'uz';
      try {
        const { error: persistErr } = await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: { preferred_language: fallbackLang },
        });
        if (persistErr) {
          console.error('Failed to persist fallback preferred_language for seller:', user.id, persistErr);
        }
      } catch (persistErr) {
        console.error('Unexpected error persisting fallback preferred_language:', persistErr);
      }

      // a) Send welcome/menu message with ReplyKeyboardMarkup (seller gets bottom keyboard immediately)
      await sendTelegramMessage(chatId, welcomeTexts[fallbackLang], getLocalizedMenu(fallbackLang));

      // b) Also show inline language picker so seller can choose another language without replacing the keyboard
      await sendTelegramMessage(chatId, '🌐 <b>Tilni tanlang / Выберите язык / Choose a language:</b>', {
        inline_keyboard: [[
          { text: "🇺🇿 O‘zbekcha", callback_data: 'language_uz' },
          { text: '🇷🇺 Русский', callback_data: 'language_ru' },
          { text: '🇬🇧 English', callback_data: 'language_en' },
        ]],
      });

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
        inline_keyboard: [[{ text: '❌ Cancel', callback_data: `cancel_${freshSessionId}` }]],
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
        {
          inline_keyboard: [[
            { text: "🇺🇿 O‘zbekcha", callback_data: 'language_uz' },
            { text: '🇷🇺 Русский', callback_data: 'language_ru' },
            { text: '🇬🇧 English', callback_data: 'language_en' },
          ]],
        }
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

      // Download photo bytes into server memory
      const getFileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${file.file_id}`);
      const getFileResult = await getFileRes.json();
      if (!getFileResult.ok || !getFileResult.result?.file_path) {
        console.warn('Telegram getFile returned error for file_id:', file.file_id);
        await sendTelegramMessage(
          chatId,
          '⚠️ <b>Could not retrieve photo from Telegram</b>. Please try sending the photo again.'
        );
        return NextResponse.json({ ok: true });
      }

      // SECURITY INVARIANT: The download URL is kept strictly in local memory and NEVER saved or exposed.
      const downloadUrl = `https://api.telegram.org/file/bot${token}/${getFileResult.result.file_path}`;
      const imgRes = await fetch(downloadUrl);
      if (!imgRes.ok) {
        console.warn('Failed to download image bytes from Telegram API for file_id:', file.file_id);
        await sendTelegramMessage(chatId, '⚠️ <b>Failed to download photo</b>. Please try sending it again.');
        return NextResponse.json({ ok: true });
      }

      const arrayBuf = await imgRes.arrayBuffer();
      const imageBuffer = Buffer.from(arrayBuf);

      // Process with Sharp to 1000x1000 WebP & upload to Supabase Storage bucket 'product-images'
      const sessionId = crypto.randomUUID();
      let processedImage;
      try {
        processedImage = await processAndStoreProductImage({
          inputBuffer: imageBuffer,
          storeId: store.id,
          fileId: sessionId,
        });
      } catch (procErr: any) {
        console.warn('Product image processing failed for store:', store.id, procErr?.message || procErr);
        await sendTelegramMessage(
          chatId,
          `❌ <b>Image processing failed</b>\n\n${procErr?.message || 'Please send a clear photo (JPEG, PNG, or WebP) under 15MB.'}`
        );
        return NextResponse.json({ ok: true });
      }

      // Extract structured product attributes via Gemini Vision in seller's preferred language
      let aiResult: VisionAnalysisResult | null = null;
      try {
        aiResult = await analyzeClothingImage(imageBuffer, 'image/jpeg', currentLangKey);
      } catch (aiErr: any) {
        console.warn('Gemini Vision extraction failed for store:', store.id, aiErr?.message || aiErr);
      }

      // Clean up previous uncompleted draft sessions for this seller & store
      await supabase
        .from('telegram_sessions')
        .delete()
        .eq('seller_telegram_id', chatId)
        .eq('store_id', store.id);

      if (aiResult) {
        // Load real categories & brands from database
        const { data: categories } = await supabase.from('categories').select('*');
        const { data: brands } = await supabase.from('brands').select('*');

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
            sessionId
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
          inlineCatButtons.push([{ text: '❌ Cancel', callback_data: `cancel_${sessionId}` }]);

          await sendTelegramMessage(
            chatId,
            `✨ <b>AI Fashion Recognition Complete!</b>\n\n` +
            `🏷 <b>Title:</b> ${aiResult.title}\n` +
            `🎨 <b>Color:</b> ${aiResult.color}\n` +
            `👤 <b>Target:</b> ${aiResult.gender}\n\n` +
            `❓ <b>Please choose the closest category for this item:</b>`,
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
        const priceRes = validatePriceInput(text);

        if (!priceRes.valid || !priceRes.price) {
          await sendTelegramMessage(
            chatId,
            `⚠️ <b>Invalid Price / Noto'g'ri narx</b>\n\n${priceRes.error || 'Please enter a valid price in UZS.'}\n\n*Example: <code>450000</code> or <code>450 000</code>*\n*To cancel, send /cancel*`
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
          `✅ <b>Price Confirmed:</b> <b>${priceRes.price.toLocaleString()} UZS</b>\n\n` +
          `📦 <b>Step 2/2 — Set Available Stock</b>\n` +
          `Please enter the inventory quantity (whole number ≥ 1, e.g. <code>10</code>) or select a quick option below:`,
          {
            inline_keyboard: [
              [
                { text: '1 pc', callback_data: 'set_stock_1' },
                { text: '5 pcs', callback_data: 'set_stock_5' },
                { text: '10 pcs', callback_data: 'set_stock_10' },
              ],
              [{ text: '❌ Cancel', callback_data: `cancel_${activeSession.id}` }],
            ],
          }
        );
        return NextResponse.json({ ok: true });
      }

      // Step B: AWAITING_STOCK
      if (activeSession.step === 'AWAITING_STOCK') {
        const stockRes = validateStockInput(text);

        if (!stockRes.valid || !stockRes.stock) {
          await sendTelegramMessage(
            chatId,
            `⚠️ <b>Invalid Stock / Noto'g'ri miqdor</b>\n\n${stockRes.error || 'Please enter a valid whole number.'}\n\n*Example: <code>5</code> or <code>10</code>*\n*To cancel, send /cancel*`
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
        });

        await sendTelegramMessage(chatId, previewText, {
          inline_keyboard: [
            [{ text: '🚀 Publish Product', callback_data: `publish_${activeSession.id}` }],
            [{ text: '❌ Cancel', callback_data: `cancel_${activeSession.id}` }],
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
