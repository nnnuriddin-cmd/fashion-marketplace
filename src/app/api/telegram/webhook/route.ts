import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { analyzeClothingImage } from '@/lib/ai/vision-analyzer';
import { processSellerProductImage } from '@/lib/ai/image-processor';
import { sendTelegramMessage, notifyOrderStatusChanged } from '@/lib/telegram/notifier';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();

    // 1. Process Callback Queries (Inline Button Clicks)
    if (body.callback_query) {
      const cb = body.callback_query;
      const data = cb.data as string;
      const chatId = cb.message.chat.id;

      if (data.startsWith('accept_order_')) {
        const orderId = data.replace('accept_order_', '');
        db.prepare(`UPDATE seller_orders SET status = 'CONFIRMED' WHERE id = ?`).run(orderId);
        await sendTelegramMessage(chatId, `✅ Order #${orderId.slice(0, 8)} has been CONFIRMED.`);
        await notifyOrderStatusChanged(orderId, 'CONFIRMED');
      } else if (data.startsWith('reject_order_')) {
        const orderId = data.replace('reject_order_', '');
        db.prepare(`UPDATE seller_orders SET status = 'CANCELLED' WHERE id = ?`).run(orderId);
        await sendTelegramMessage(chatId, `❌ Order #${orderId.slice(0, 8)} has been CANCELLED.`);
        await notifyOrderStatusChanged(orderId, 'CANCELLED');
      } else if (data.startsWith('status_')) {
        const parts = data.split('_');
        const status = parts[1];
        const orderId = parts.slice(2).join('_');
        db.prepare(`UPDATE seller_orders SET status = ? WHERE id = ?`).run(status, orderId);
        await sendTelegramMessage(chatId, `📦 Order status updated to <b>${status}</b>`);
        await notifyOrderStatusChanged(orderId, status);
      } else if (data.startsWith('publish_product_')) {
        const sessionId = data.replace('publish_product_', '');
        const session = db.prepare(`SELECT * FROM telegram_sessions WHERE id = ?`).get(sessionId) as any;

        if (session && session.extractedMetadataJson) {
          const meta = JSON.parse(session.extractedMetadataJson);
          const store = db.prepare(`SELECT * FROM stores WHERE id = ?`).get(session.storeId) as any;
          const category = db.prepare(`SELECT * FROM categories WHERE slug = ? OR id = ?`).get(meta.categorySlug, meta.categorySlug) as any;
          const categoryId = category ? category.id : 'cat-women-blazers';

          const productId = `prd-${crypto.randomBytes(6).toString('hex')}`;
          const slug = `${meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

          db.prepare(`
            INSERT INTO products (
              id, storeId, categoryId, name, slug, description, price, discountPrice,
              currency, stockQuantity, sizes, colors, material, gender, style, occasion,
              season, tags, originalImage, processedImages, status, aiMetadata, isFeatured, isTrending, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            productId,
            session.storeId,
            categoryId,
            meta.title,
            slug,
            meta.description || 'AI-generated fashion marketplace product.',
            meta.price || 450000,
            null,
            'UZS',
            meta.stockQuantity || 10,
            JSON.stringify(meta.sizes || ['S', 'M', 'L']),
            JSON.stringify([meta.color || 'Beige']),
            meta.material || 'Linen blend',
            meta.gender || 'WOMEN',
            meta.style || 'Oversized',
            meta.occasion || 'Casual',
            meta.season || 'Summer',
            JSON.stringify(meta.tags || ['fashion']),
            session.rawImageUrl || '/uploads/products/raw_demo.jpg',
            JSON.stringify([session.processedImageUrl || '/uploads/products/studio_demo.webp']),
            'PUBLISHED',
            JSON.stringify(meta),
            1,
            1,
            new Date().toISOString()
          );

          db.prepare(`DELETE FROM telegram_sessions WHERE id = ?`).run(sessionId);

          await sendTelegramMessage(
            chatId,
            `🚀 <b>CONGRATULATIONS! PRODUCT IS LIVE!</b>\n\n` +
            `👗 <b>${meta.title}</b>\n` +
            `💰 <b>Price:</b> ${(meta.price || 450000).toLocaleString()} UZS\n` +
            `🏪 <b>Store:</b> ${store?.name || 'Your Store'}\n\n` +
            `🔗 Product link: https://trendmall.uz/product/${slug}`
          );
        }
      }

      return NextResponse.json({ ok: true });
    }

    // 2. Process Standard Messages (Photos & Text)
    const msg = body.message;
    if (!msg) return NextResponse.json({ ok: true });

    const chatId = String(msg.chat.id);
    const text = msg.text?.trim() || '';

    // Find seller store by telegramId
    const user = db.prepare(`SELECT * FROM users WHERE telegramId = ? OR telegramCode = ?`).get(chatId, text) as any;
    let store = user ? db.prepare(`SELECT * FROM stores WHERE ownerId = ?`).get(user.id) as any : null;

    if (!store) {
      // Fallback store for testing bot directly
      store = db.prepare(`SELECT * FROM stores LIMIT 1`).get() as any;
    }

    // Main Keyboard Menu
    const mainKeyboard = {
      keyboard: [
        [{ text: '➕ Add Product' }, { text: '📦 My Products' }],
        [{ text: '🛍 Orders' }, { text: '📊 Sales Analytics' }],
        [{ text: '🏪 My Store' }, { text: '⚙️ Settings' }],
      ],
      resize_keyboard: true,
    };

    if (text === '/start') {
      await sendTelegramMessage(
        chatId,
        `👋 <b>Welcome to TrendMall AI Seller Assistant!</b>\n\n` +
        `I am your intelligent fashion store assistant. You can create new catalog products instantly just by taking a photo!\n\n` +
        `📸 <b>To add a product:</b> Simply send a photo of your clothing item right here!`,
        mainKeyboard
      );
      return NextResponse.json({ ok: true });
    }

    if (text === '📦 My Products') {
      const productsCount = db.prepare(`SELECT COUNT(*) as count FROM products WHERE storeId = ?`).get(store.id) as any;
      await sendTelegramMessage(
        chatId,
        `📦 <b>Store Products Overview</b>\n\n` +
        `Store: <b>${store.name}</b>\n` +
        `Active Products: <b>${productsCount?.count || 0}</b> items live on marketplace.`,
        mainKeyboard
      );
      return NextResponse.json({ ok: true });
    }

    if (text === '🛍 Orders') {
      const orders = db.prepare(`SELECT * FROM seller_orders WHERE storeId = ? ORDER BY createdAt DESC LIMIT 5`).all(store.id) as any[];
      const orderSummary = orders.length === 0
        ? 'No active orders found.'
        : orders.map((o) => `• #${o.subOrderNumber} - ${o.subtotal.toLocaleString()} UZS [${o.status}]`).join('\n');

      await sendTelegramMessage(
        chatId,
        `🛍 <b>Recent Store Orders:</b>\n\n${orderSummary}`,
        mainKeyboard
      );
      return NextResponse.json({ ok: true });
    }

    // Handle Photo Upload
    if (msg.photo && msg.photo.length > 0) {
      await sendTelegramMessage(chatId, `🤖 <i>AI is processing photo & removing background...</i>`);

      const photoObj = msg.photo[msg.photo.length - 1];
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      let photoUrl = 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80';

      if (botToken) {
        try {
          const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${photoObj.file_id}`);
          const fileData = await fileRes.json();
          if (fileData.ok && fileData.result.file_path) {
            photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
          }
        } catch (e) {
          console.warn('Failed to fetch Telegram photo file path:', e);
        }
      }

      // Run AI Vision & Studio Image Processor
      const visionResult = await analyzeClothingImage(photoUrl);
      const processedImage = await processSellerProductImage(photoUrl);

      const sessionId = `session-${crypto.randomBytes(6).toString('hex')}`;
      const sessionData = {
        title: visionResult.title,
        categorySlug: visionResult.categorySlug,
        color: visionResult.color,
        style: visionResult.style,
        material: visionResult.material,
        description: visionResult.description,
        tags: visionResult.tags,
        price: visionResult.suggestedPrice || 450000,
        sizes: ['S', 'M', 'L'],
        stockQuantity: 10,
      };

      db.prepare(`
        INSERT INTO telegram_sessions (id, sellerTelegramId, storeId, step, rawImageUrl, processedImageUrl, extractedMetadataJson, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        chatId,
        store.id,
        'WAITING_FOR_COMMERCIAL',
        processedImage.originalImageUrl,
        processedImage.processedImageUrl,
        JSON.stringify(sessionData),
        new Date().toISOString()
      );

      const replyText =
        `✨ <b>AI PRODUCT DETECTED & BACKGROUND REMOVED!</b>\n\n` +
        `👗 <b>Item Identified:</b> ${visionResult.title}\n` +
        `📌 <b>Category:</b> ${visionResult.categoryName}\n` +
        `🎨 <b>Color:</b> ${visionResult.color} | 🕶 <b>Style:</b> ${visionResult.style}\n` +
        `🧵 <b>Material:</b> ${visionResult.material}\n\n` +
        `Please enter commercial details (<b>Price, Sizes, Quantity</b>) e.g.:\n` +
        `<code>450000 S M L 10</code>`;

      await sendTelegramMessage(chatId, replyText);
      return NextResponse.json({ ok: true });
    }

    // Handle Text Input for Price/Sizes/Stock after Photo Upload
    if (text && !text.startsWith('/')) {
      const activeSession = db.prepare(`
        SELECT * FROM telegram_sessions WHERE sellerTelegramId = ? ORDER BY createdAt DESC LIMIT 1
      `).get(chatId) as any;

      if (activeSession && activeSession.extractedMetadataJson) {
        const meta = JSON.parse(activeSession.extractedMetadataJson);
        const parts = text.split(/\s+/);

        const parsedPrice = parseFloat(parts[0]);
        if (!isNaN(parsedPrice)) {
          meta.price = parsedPrice;
        }

        const parsedSizes = parts.filter((p) => ['XS', 'S', 'M', 'L', 'XL', 'XXL', '38', '39', '40', '41', '42'].includes(p.toUpperCase()));
        if (parsedSizes.length > 0) {
          meta.sizes = parsedSizes.map((s) => s.toUpperCase());
        }

        const lastPart = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastPart) && lastPart > 0 && lastPart < 1000) {
          meta.stockQuantity = lastPart;
        }

        db.prepare(`UPDATE telegram_sessions SET extractedMetadataJson = ? WHERE id = ?`)
          .run(JSON.stringify(meta), activeSession.id);

        const cardText =
          `👗 <b>PRODUCT DRAFT PREVIEW READY</b>\n\n` +
          `<b>Title:</b> ${meta.title}\n` +
          `<b>Category:</b> ${meta.categorySlug}\n` +
          `<b>Color:</b> ${meta.color}\n` +
          `<b>Price:</b> ${meta.price.toLocaleString()} UZS\n` +
          `<b>Available Sizes:</b> ${meta.sizes.join(', ')}\n` +
          `<b>Initial Stock:</b> ${meta.stockQuantity} pcs\n\n` +
          `Tap <b>Publish Now</b> to send live to the marketplace:`;

        const publishKeyboard = {
          inline_keyboard: [
            [{ text: '🚀 Publish Now to Marketplace', callback_data: `publish_product_${activeSession.id}` }],
          ],
        };

        await sendTelegramMessage(chatId, cardText, publishKeyboard);
        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
