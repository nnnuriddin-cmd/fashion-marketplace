import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { sendTelegramMessage, answerTelegramCallbackQuery } from '@/lib/telegram/notifier';
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
    const supabase = getServerSupabase();

    // =========================================================================
    // 2. Handle Telegram Callback Queries (Inline Buttons)
    // =========================================================================
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbId = cb.id;
      const chatId = String(cb.message?.chat?.id || cb.from?.id);
      const data = String(cb.data || '');

      // 2.1 Language selection
      if (data.startsWith('language_')) {
        await answerTelegramCallbackQuery(cbId);
        const language = data.replace('language_', '');
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

      // Authenticate Telegram user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('telegram_id', chatId)
        .maybeSingle();

      if (userError) throw userError;

      if (!user || user.role !== 'SELLER') {
        await answerTelegramCallbackQuery(cbId, 'Access denied: Registered sellers only');
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
        await answerTelegramCallbackQuery(cbId, 'Store is not active');
        await sendTelegramMessage(
          chatId,
          `⚠️ <b>Store Inactive</b>\n\nYour store "${store?.name || 'Unknown'}" is currently ${store?.status || 'NOT APPROVED'}. Cannot perform product operations.`
        );
        return NextResponse.json({ ok: true });
      }

      // 2.2 Cancel Draft Callback (e.g. cancel_<sessionId> or cancel_draft)
      if (data.startsWith('cancel_')) {
        await answerTelegramCallbackQuery(cbId, 'Draft cancelled');
        await supabase
          .from('telegram_sessions')
          .delete()
          .eq('seller_telegram_id', chatId)
          .eq('store_id', store.id);

        await sendTelegramMessage(
          chatId,
          '❌ <b>Product Draft Cancelled</b>\n\nYour product draft has been safely discarded. You can send a new photo anytime.',
          menu
        );
        return NextResponse.json({ ok: true });
      }

      // 2.3 Set Suggested Price Callback (set_price_<price>)
      if (data.startsWith('set_price_')) {
        const priceStr = data.replace('set_price_', '');
        const priceRes = validatePriceInput(priceStr);

        if (!priceRes.valid || !priceRes.price) {
          await answerTelegramCallbackQuery(cbId, 'Invalid price');
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
          await answerTelegramCallbackQuery(cbId, 'No active draft session');
          return NextResponse.json({ ok: true });
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

        await answerTelegramCallbackQuery(cbId, `Price set: ${priceRes.price.toLocaleString()} UZS`);
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
          await answerTelegramCallbackQuery(cbId, 'Invalid stock');
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
          await answerTelegramCallbackQuery(cbId, 'Please enter price first');
          return NextResponse.json({ ok: true });
        }

        const updatedDraft = { ...(session.draft || {}), stock: stockRes.stock };
        await supabase
          .from('telegram_sessions')
          .update({
            step: 'AWAITING_PUBLICATION_CONFIRMATION',
            draft: updatedDraft,
            updated_at: new Date().toISOString(),
          })
          .eq('id', session.id);

        await answerTelegramCallbackQuery(cbId, `Stock set: ${stockRes.stock} pcs`);

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
          await answerTelegramCallbackQuery(cbId, 'Category not found');
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
          await answerTelegramCallbackQuery(cbId, 'Session expired');
          return NextResponse.json({ ok: true });
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

        await answerTelegramCallbackQuery(cbId, `Category: ${cat.name}`);

        const ai = session.draft?.ai || session.extracted_metadata || {};
        const msg = formatAiExtractionDetails(ai, cat.name, session.draft?.brand_name || null);
        const keyboard = ai.suggestedPrice && ai.suggestedPrice > 0
          ? {
              inline_keyboard: [
                [{ text: `✅ Use ${ai.suggestedPrice.toLocaleString()} UZS`, callback_data: `set_price_${ai.suggestedPrice}` }],
                [{ text: '❌ Cancel', callback_data: `cancel_${session.id}` }],
              ],
            }
          : {
              inline_keyboard: [[{ text: '❌ Cancel', callback_data: `cancel_${session.id}` }]],
            };

        await sendTelegramMessage(chatId, msg, keyboard);
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
            await answerTelegramCallbackQuery(cbId, 'Already published!');
            await sendTelegramMessage(chatId, `✅ <b>${existingProd.title}</b> is already live on TrendMall!`, menu);
            return NextResponse.json({ ok: true });
          }

          await answerTelegramCallbackQuery(cbId, 'Draft session expired or already processed');
          return NextResponse.json({ ok: true });
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

        await sendTelegramMessage(
          chatId,
          `🎉 <b>Product Published Successfully! / Mahsulot e'lon qilindi!</b>\n\n` +
          `Your product <b>"${newProduct.title}"</b> is now live in <b>${store.name}</b>.\n\n` +
          `💰 Price: <b>${newProduct.price.toLocaleString()} UZS</b>\n` +
          `📦 Available Stock: <b>${newProduct.stock_quantity} pcs</b>\n` +
          `📁 Status: <b>ACTIVE</b>\n\n` +
          `Customers can now discover and purchase this item on TrendMall.`,
          menu
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

    // Handle One-Time Account Linking (/link CODE or /start CODE)
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

      await sendTelegramMessage(
        chatId,
        `✅ <b>Telegram Successfully Linked! / Telegram muvaffaqiyatli ulandi!</b>\n\n` +
        `Your Telegram account is now connected to <b>${targetStore.name}</b>.\n\n` +
        `You will receive instant alerts when customers place orders, and you can upload photos directly to publish products.`,
        menu
      );
      return NextResponse.json({ ok: true });
    }

    // Welcome / Language Selection for /start without parameters
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

    // Authenticate user by verified telegram_id
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

    // Authorize seller store (strictly by owner_id)
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

    // /cancel command: Safely cancels the active seller's draft session
    if (text === '/cancel' || text.toLowerCase() === 'cancel') {
      const { data: deletedSession } = await supabase
        .from('telegram_sessions')
        .delete()
        .eq('seller_telegram_id', chatId)
        .eq('store_id', store.id)
        .select('id');

      if (deletedSession && deletedSession.length > 0) {
        await sendTelegramMessage(
          chatId,
          '❌ <b>Product Draft Cancelled</b>\n\nYour product draft was safely cancelled. Send a photo anytime to start a new product.',
          menu
        );
      } else {
        await sendTelegramMessage(
          chatId,
          'ℹ️ No active product draft found to cancel. Send a product photo anytime to add an item.',
          menu
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Inventory query
    if (text === '📦 My Products' || text === '📦 Мои товары' || text === "📦 Mahsulotlarim") {
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id);
      if (error) throw error;
      await sendTelegramMessage(chatId, `📦 Products in <b>${store.name}</b>: <b>${count ?? 0}</b>`, menu);
      return NextResponse.json({ ok: true });
    }

    // 3.1 Seller Uploads Photo
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

      // Extract structured product attributes via Gemini Vision
      let aiResult: VisionAnalysisResult | null = null;
      try {
        aiResult = await analyzeClothingImage(imageBuffer);
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

          const detailsMsg = formatAiExtractionDetails(aiResult, mappedCat.categoryName, mappedBrand.brandName);
          const keyboard = aiResult.suggestedPrice && aiResult.suggestedPrice > 0
            ? {
                inline_keyboard: [
                  [{ text: `✅ Use ${aiResult.suggestedPrice.toLocaleString()} UZS`, callback_data: `set_price_${aiResult.suggestedPrice}` }],
                  [{ text: '❌ Cancel', callback_data: `cancel_${sessionId}` }],
                ],
              }
            : {
                inline_keyboard: [[{ text: '❌ Cancel', callback_data: `cancel_${sessionId}` }]],
              };

          await sendTelegramMessage(chatId, detailsMsg, keyboard);
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

    // 3.2 Handle Text Inputs for Active Session State Machine
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
          menu
        );
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
