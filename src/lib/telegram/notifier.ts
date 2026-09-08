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

export async function notifySellerNewOrder(sellerOrderId: string) {
  try {
    const sellerOrder = await getSellerOrderForNotification(sellerOrderId);
    if (!sellerOrder) return;

    const itemListText = sellerOrder.items
      .map(
        (item) =>
          `• <b>${item.productName}</b>\n  Size: ${item.selectedSize || 'N/A'} | Color: ${item.selectedColor || 'N/A'} | Qty: ${item.quantity}\n  Price: ${item.price.toLocaleString()} UZS`
      )
      .join('\n');

    const text = `🔔 <b>NEW ORDER RECEIVED!</b>\n\n` +
      `<b>Sub-Order:</b> #${sellerOrder.subOrderNumber}\n` +
      `<b>Store:</b> ${sellerOrder.storeName}\n\n` +
      `🛍 <b>Items Ordered:</b>\n${itemListText}\n\n` +
      `💰 <b>Order Subtotal:</b> ${sellerOrder.subtotal.toLocaleString()} UZS\n\n` +
      `👤 <b>Customer:</b> ${sellerOrder.customerName}\n` +
      `📞 <b>Phone:</b> ${sellerOrder.customerPhone}\n` +
      `📍 <b>Address:</b> ${sellerOrder.deliveryAddress}\n\n` +
      `Please confirm or decline this order:`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Accept Order', callback_data: `accept_order_${sellerOrder.sellerOrderId}` },
          { text: '❌ Reject Order', callback_data: `reject_order_${sellerOrder.sellerOrderId}` },
        ],
        [
          { text: '📦 Mark Preparing', callback_data: `status_PREPARING_${sellerOrder.sellerOrderId}` },
          { text: '🚚 Out for Delivery', callback_data: `status_OUT_FOR_DELIVERY_${sellerOrder.sellerOrderId}` },
        ],
      ],
    };

    const chatId = sellerOrder.sellerTelegramId || sellerOrder.telegramUsername;
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

    const statusIcons: Record<string, string> = {
      CONFIRMED: '✅ Your order has been confirmed by the seller!',
      PREPARING: '📦 Your clothing item is being prepared & packed.',
      OUT_FOR_DELIVERY: '🚚 Your order is out for delivery with our courier!',
      DELIVERED: '🎉 Your order has been successfully delivered!',
      CANCELLED: '❌ Your order was cancelled.',
    };

    const text = `🛍 <b>ORDER STATUS UPDATE</b>\n\n` +
      `<b>Order Number:</b> #${order.subOrderNumber}\n` +
      `<b>Store:</b> ${order.storeName}\n` +
      `<b>Status:</b> ${statusIcons[newStatus] || newStatus}`;

    // If customer has a registered telegram account or contact, send notification
    const customerChatId = order.sellerTelegramId;
    if (customerChatId) {
      await sendTelegramMessage(customerChatId, text);
    }
  } catch (err) {
    console.error(`Failed to notify order status change for ${sellerOrderId}:`, err);
  }
}

