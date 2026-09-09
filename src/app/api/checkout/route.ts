import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createOrderTransaction, CartItemCheckoutInput } from '@/lib/db';
import { notifySellerNewOrder } from '@/lib/telegram/notifier';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryMethod = 'STANDARD',
      paymentMethod = 'CASH',
      orderNotes = null,
      cartItems,
    } = body;

    // 1. Basic payload validation
    if (!customerName || !customerPhone || !deliveryAddress || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      return NextResponse.json({ error: 'Missing required checkout parameters.' }, { status: 400 });
    }

    // 2. Resolve authenticated customer ID if a Supabase Auth session exists.
    // We do NOT use hardcoded IDs or demo fallbacks (e.g. 'usr-customer-1').
    // Guest orders are permitted with customer_id = null.
    let customerId: string | null = null;
    try {
      const authUser = await getCurrentUser();
      if (authUser?.id) {
        customerId = authUser.id;
      }
    } catch {
      // Supabase Auth session absent or error; proceed as guest order
      customerId = null;
    }

    // 3. Normalize cart items for createOrderTransaction.
    // Client prices are passed for reference/compatibility, but createOrderTransaction()
    // strictly overrides them with verified catalog prices fetched from Supabase.
    const normalizedCartItems: CartItemCheckoutInput[] = cartItems.map((item: any) => ({
      productId: item.productId,
      name: item.name || 'Product',
      image: item.image || null,
      price: Number(item.price) || 0,
      quantity: Number(item.quantity) || 1,
      selectedSize: item.selectedSize || null,
      selectedColor: item.selectedColor || null,
      storeId: item.storeId,
    }));

    // 4. Execute order checkout via existing DB layer.
    // createOrderTransaction validates:
    // - product existence in catalog;
    // - active product status (ACTIVE);
    // - stock quantity availability;
    // - positive quantity;
    // - verified price from database (ignores client prices);
    // - platform commission calculation based on store rates;
    // - seller earnings calculation;
    // - parent_order, seller_orders, and order_items creation.
    const checkoutResult = await createOrderTransaction({
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryMethod,
      paymentMethod,
      orderNotes,
      customerId,
      cartItems: normalizedCartItems,
    });

    // 5. Trigger instant Telegram notifications for each created seller order
    for (const sellerOrder of checkoutResult.sellerOrders) {
      try {
        await notifySellerNewOrder(sellerOrder.sellerOrderId);
      } catch (notifyErr) {
        console.error(`Failed to send Telegram notification for seller order ${sellerOrder.sellerOrderId}:`, notifyErr);
      }
    }

    // 6. Return response matching the existing contract expected by checkout UI
    return NextResponse.json({
      success: true,
      parentOrderNumber: checkoutResult.orderNumber,
      parentOrderId: checkoutResult.parentOrderId,
      subOrdersCount: checkoutResult.sellerOrders.length,
      totalAmount: checkoutResult.totalAmount,
    });
  } catch (err: any) {
    console.error('Checkout error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Differentiate client validation / catalog constraint errors (400) from unexpected server errors (500)
    const isClientError =
      errorMessage.includes('not found in active catalog') ||
      errorMessage.includes('Insufficient stock') ||
      errorMessage.includes('not available for purchase') ||
      errorMessage.includes('Invalid purchase quantity') ||
      errorMessage.includes('Cannot create an order with empty') ||
      errorMessage.includes('valid productId');

    return NextResponse.json(
      { error: errorMessage },
      { status: isClientError ? 400 : 500 }
    );
  }
}

