import { getSellerOrderForNotification } from '@/lib/db';

export async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.log(`[TELEGRAM NOTIFIER LOG] (No BOT_TOKEN set) -> To Chat ${chatId}:\n${text}`);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    return { ok: false, error: String(err) };
  }
}

export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { ok: true, simulated: true };
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to answer Telegram callback query:', err);
    return { ok: false, error: String(err) };
  }
}

export async function clearTelegramInlineKeyboard(chatId: string | number, messageId: number) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.log(`[TELEGRAM NOTIFIER LOG] (No BOT_TOKEN set) -> Clear inline keyboard for chat ${chatId}, message ${messageId}`);
    return { ok: true, simulated: true };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.warn(`[TELEGRAM NOTIFIER] editMessageReplyMarkup non-ok for chat ${chatId}, msg ${messageId}:`, data.description);
    }
    return data;
  } catch (err) {
    console.error(`Failed to clear Telegram inline keyboard for chat ${chatId}, msg ${messageId}:`, err);
    return { ok: false, error: String(err) };
  }
}

import { getServerSupabase } from '@/lib/supabase-server';

export async function notifySellerNewOrder(sellerOrderId: string) {
  try {
    const sellerOrder = await getSellerOrderForNotification(sellerOrderId);
    if (!sellerOrder) return;

    const chatId = sellerOrder.sellerTelegramId || sellerOrder.telegramUsername;

    let lang: 'uz' | 'ru' | 'en' = 'uz';
    if (chatId) {
      try {
        const supabase = getServerSupabase();
        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .eq('telegram_id', chatId)
          .maybeSingle();
        if (userRow?.id) {
          const { data: authData } = await supabase.auth.admin.getUserById(userRow.id);
          const saved = authData?.user?.user_metadata?.preferred_language;
          if (saved && ['uz', 'ru', 'en'].includes(saved)) {
            lang = saved as 'uz' | 'ru' | 'en';
          }
        }
      } catch {
        // fallback to uz
      }
    }

    const labels = {
      uz: {
        title: '🔔 <b>YANGI BUYURTMA QABUL QILINDI!</b>',
        subOrder: 'Sub-buyurtma',
        store: "Do'kon",
        items: 'Buyurtma qilingan tovarlar',
        size: "O'lcham",
        color: 'Rangi',
        qty: 'Miqdor',
        subtotal: 'Buyurtma summasi',
        customer: 'Xaridor',
        phone: 'Telefon',
        address: 'Yetkazish manzili',
        prompt: 'Iltimos, ushbu buyurtmani tasdiqlang yoki rad eting:',
        btnAccept: '✅ Qabul qilish',
        btnReject: '❌ Rad etish',
        btnPreparing: '📦 Tayyorlanmoqda',
        btnOutForDelivery: '🚚 Yetkazilmoqda',
      },
      ru: {
        title: '🔔 <b>НОВЫЙ ЗАКАЗ ПОЛУЧЕН!</b>',
        subOrder: 'Подитог заказа',
        store: 'Магазин',
        items: 'Заказанные товары',
        size: 'Размер',
        color: 'Цвет',
        qty: 'Кол-во',
        subtotal: 'Сумма заказа',
        customer: 'Покупатель',
        phone: 'Телефон',
        address: 'Адрес доставки',
        prompt: 'Пожалуйста, подтвердите или отклоните этот заказ:',
        btnAccept: '✅ Принять заказ',
        btnReject: '❌ Отклонить заказ',
        btnPreparing: '📦 Готовится',
        btnOutForDelivery: '🚚 Передано курьеру',
      },
      en: {
        title: '🔔 <b>NEW ORDER RECEIVED!</b>',
        subOrder: 'Sub-Order',
        store: 'Store',
        items: 'Items Ordered',
        size: 'Size',
        color: 'Color',
        qty: 'Qty',
        subtotal: 'Order Subtotal',
        customer: 'Customer',
        phone: 'Phone',
        address: 'Address',
        prompt: 'Please confirm or decline this order:',
        btnAccept: '✅ Accept Order',
        btnReject: '❌ Reject Order',
        btnPreparing: '📦 Mark Preparing',
        btnOutForDelivery: '🚚 Out for Delivery',
      },
    }[lang];

    const itemListText = sellerOrder.items
      .map(
        (item) =>
          `• <b>${item.productName}</b>\n  ${labels.size}: ${item.selectedSize || 'N/A'} | ${labels.color}: ${item.selectedColor || 'N/A'} | ${labels.qty}: ${item.quantity}\n  ${item.price.toLocaleString()} UZS`
      )
      .join('\n');

    const text = `${labels.title}\n\n` +
      `<b>${labels.subOrder}:</b> #${sellerOrder.subOrderNumber}\n` +
      `<b>${labels.store}:</b> ${sellerOrder.storeName}\n\n` +
      `🛍 <b>${labels.items}:</b>\n${itemListText}\n\n` +
      `💰 <b>${labels.subtotal}:</b> ${sellerOrder.subtotal.toLocaleString()} UZS\n\n` +
      `👤 <b>${labels.customer}:</b> ${sellerOrder.customerName}\n` +
      `📞 <b>${labels.phone}:</b> ${sellerOrder.customerPhone}\n` +
      `📍 <b>${labels.address}:</b> ${sellerOrder.deliveryAddress}\n\n` +
      `${labels.prompt}`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: labels.btnAccept, callback_data: `accept_order_${sellerOrder.sellerOrderId}` },
          { text: labels.btnReject, callback_data: `reject_order_${sellerOrder.sellerOrderId}` },
        ],
        [
          { text: labels.btnPreparing, callback_data: `status_PREPARING_${sellerOrder.sellerOrderId}` },
          { text: labels.btnOutForDelivery, callback_data: `status_OUT_FOR_DELIVERY_${sellerOrder.sellerOrderId}` },
        ],
      ],
    };

    if (chatId) {
      await sendTelegramMessage(chatId, text, inlineKeyboard);
    } else {
      console.log(`[SIMULATED SELLER TELEGRAM ALERT] -> Store ${sellerOrder.storeName} Order #${sellerOrder.subOrderNumber}`);
    }
  } catch (err) {
    console.error(`Failed to notify seller for order ${sellerOrderId}:`, err);
  }
}

export async function notifyOrderStatusChanged(sellerOrderId: string, newStatus: string) {
  try {
    const order = await getSellerOrderForNotification(sellerOrderId);
    if (!order) return;

    const customerChatId = order.sellerTelegramId;
    let lang: 'uz' | 'ru' | 'en' = 'uz';

    if (customerChatId) {
      try {
        const supabase = getServerSupabase();
        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .eq('telegram_id', customerChatId)
          .maybeSingle();
        if (userRow?.id) {
          const { data: authData } = await supabase.auth.admin.getUserById(userRow.id);
          const saved = authData?.user?.user_metadata?.preferred_language;
          if (saved && ['uz', 'ru', 'en'].includes(saved)) {
            lang = saved as 'uz' | 'ru' | 'en';
          }
        }
      } catch {
        // fallback to uz
      }
    }

    const statusIcons: Record<string, Record<string, string>> = {
      uz: {
        CONFIRMED: '✅ Buyurtmangiz sotuvchi tomonidan tasdiqlandi!',
        PREPARING: '📦 Mahsulotingiz tayyorlanmoqda va qadoqlanmoqda.',
        OUT_FOR_DELIVERY: '🚚 Buyurtmangiz kuryer tomonidan yetkazilmoqda!',
        DELIVERED: '🎉 Buyurtmangiz muvaffaqiyatli yetkazildi!',
        CANCELLED: '❌ Buyurtmangiz bekor qilindi.',
      },
      ru: {
        CONFIRMED: '✅ Ваш заказ подтвержден продавцом!',
        PREPARING: '📦 Ваш товар готовится и упаковывается.',
        OUT_FOR_DELIVERY: '🚚 Заказ передан курьеру и доставляется!',
        DELIVERED: '🎉 Ваш заказ успешно доставлен!',
        CANCELLED: '❌ Ваш заказ отменен.',
      },
      en: {
        CONFIRMED: '✅ Your order has been confirmed by the seller!',
        PREPARING: '📦 Your clothing item is being prepared & packed.',
        OUT_FOR_DELIVERY: '🚚 Your order is out for delivery with our courier!',
        DELIVERED: '🎉 Your order has been successfully delivered!',
        CANCELLED: '❌ Your order was cancelled.',
      },
    };

    const headerText = {
      uz: '🛍 <b>BUYURTMA HOLATI YANGILANDI</b>',
      ru: '🛍 <b>ОБНОВЛЕНИЕ СТАТУСА ЗАКАЗА</b>',
      en: '🛍 <b>ORDER STATUS UPDATE</b>',
    }[lang];

    const orderNumLabel = {
      uz: 'Buyurtma raqami',
      ru: 'Номер заказа',
      en: 'Order Number',
    }[lang];

    const storeLabel = {
      uz: "Do'kon",
      ru: 'Магазин',
      en: 'Store',
    }[lang];

    const statusLabel = {
      uz: 'Holati',
      ru: 'Статус',
      en: 'Status',
    }[lang];

    const text = `${headerText}\n\n` +
      `<b>${orderNumLabel}:</b> #${order.subOrderNumber}\n` +
      `<b>${storeLabel}:</b> ${order.storeName}\n` +
      `<b>${statusLabel}:</b> ${statusIcons[lang]?.[newStatus] || newStatus}`;

    if (customerChatId) {
      await sendTelegramMessage(customerChatId, text);
    }
  } catch (err) {
    console.error(`Failed to notify order status change for ${sellerOrderId}:`, err);
  }
}

