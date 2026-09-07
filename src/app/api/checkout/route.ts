import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { notifySellerNewOrder } from '@/lib/telegram/notifier';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, customerPhone, deliveryAddress, deliveryMethod, paymentMethod, orderNotes, cartItems } = body;

    if (!customerName || !customerPhone || !deliveryAddress || !cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: 'Missing required checkout parameters.' }, { status: 400 });
    }

    const db = getDb();
    const customerId = 'usr-customer-1'; // Default customer session ID

    const parentId = `pord-${crypto.randomBytes(6).toString('hex')}`;
    const orderNumber = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;

    // Group cart items by store
    const storeGroups: Record<string, { items: any[]; subtotal: number }> = {};
    let grandTotal = 0;

    cartItems.forEach((item: any) => {
      if (!storeGroups[item.storeId]) {
        storeGroups[item.storeId] = { items: [], subtotal: 0 };
      }
      storeGroups[item.storeId].items.push(item);
      const itemSubtotal = item.price * item.quantity;
      storeGroups[item.storeId].subtotal += itemSubtotal;
      grandTotal += itemSubtotal;
    });

    const now = new Date().toISOString();

    // 1. Create Parent Order
    db.prepare(`
      INSERT INTO parent_orders (
        id, orderNumber, customerId, customerName, customerPhone, deliveryAddress,
        deliveryMethod, paymentMethod, paymentStatus, totalAmount, orderNotes, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      parentId,
      orderNumber,
      customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryMethod || 'STANDARD',
      paymentMethod || 'CASH',
      'PENDING',
      grandTotal,
      orderNotes || null,
      now
    );

    // 2. Create Seller Orders and Order Items
    const sellerOrderLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    let letterIndex = 0;
    const createdSellerOrders: string[] = [];

    for (const [storeId, group] of Object.entries(storeGroups)) {
      const sellerOrderId = `sord-${crypto.randomBytes(6).toString('hex')}`;
      const subOrderNumber = `${orderNumber}-${sellerOrderLetters[letterIndex % sellerOrderLetters.length]}`;
      letterIndex++;

      const store = db.prepare(`SELECT commissionRate FROM stores WHERE id = ?`).get(storeId) as any;
      const rate = store ? store.commissionRate : 10.0;
      const commissionAmount = (group.subtotal * rate) / 100.0;
      const sellerEarnings = group.subtotal - commissionAmount;

      db.prepare(`
        INSERT INTO seller_orders (
          id, subOrderNumber, parentOrderId, storeId, status, subtotal,
          commissionAmount, sellerEarnings, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sellerOrderId,
        subOrderNumber,
        parentId,
        storeId,
        'NEW',
        group.subtotal,
        commissionAmount,
        sellerEarnings,
        now
      );

      group.items.forEach((item) => {
        const itemSubtotal = item.price * item.quantity;
        db.prepare(`
          INSERT INTO order_items (
            id, sellerOrderId, productId, productName, productImage,
            selectedSize, selectedColor, price, quantity, subtotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          `itm-${crypto.randomBytes(6).toString('hex')}`,
          sellerOrderId,
          item.productId,
          item.name,
          item.image,
          item.selectedSize || 'M',
          item.selectedColor || 'Beige',
          item.price,
          item.quantity,
          itemSubtotal
        );
      });

      createdSellerOrders.push(sellerOrderId);

      // Trigger instant Telegram Notification to seller
      await notifySellerNewOrder(sellerOrderId);
    }

    return NextResponse.json({
      success: true,
      parentOrderNumber: orderNumber,
      parentOrderId: parentId,
      subOrdersCount: createdSellerOrders.length,
    });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
