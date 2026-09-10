'use server';

import { createClient } from '@/lib/supabase/server';
import { updateSellerOrderStatus } from '@/lib/db/server-queries';
import { OrderStatus } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const VALID_STATUSES: OrderStatus[] = [
  'NEW',
  'CONFIRMED',
  'PREPARING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export interface UpdateOrderStatusResult {
  success?: boolean;
  error?: string;
  status?: OrderStatus;
}

/**
 * Server Action: updates seller order fulfillment status.
 *
 * Security Invariants:
 * 1. User must be authenticated.
 * 2. Role must be SELLER or ADMIN.
 * 3. Never accepts or trusts storeId/ownerId from client input.
 * 4. Strictly validates ownership of the target order under PostgreSQL RLS.
 * 5. Strictly enforces sequential status progression.
 * 6. Invokes updateSellerOrderStatus with SSR cookies.
 * 7. Never leaks internal SQL errors to the user.
 */
export async function updateOrderStatusAction(
  sellerOrderId: string,
  newStatus: string
): Promise<UpdateOrderStatusResult> {
  // 1. Validate inputs
  if (!sellerOrderId || typeof sellerOrderId !== 'string') {
    return { error: 'Invalid seller order ID.' };
  }

  const targetStatus = newStatus as OrderStatus;
  if (!VALID_STATUSES.includes(targetStatus)) {
    return { error: 'Invalid order status value.' };
  }

  // 2. Enforce authentication via SSR cookie client
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Unauthorized: please sign in.' };
  }

  // 3. Verify user role from public.users (SELLER or ADMIN)
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || (profile.role !== 'SELLER' && profile.role !== 'ADMIN')) {
    return { error: 'Forbidden: only sellers and administrators can update order status.' };
  }

  // 4. For SELLER, verify order existence and store ownership via RLS
  // RLS on seller_orders guarantees only the owning seller (or parent order customer) can select.
  const { data: currentOrder, error: fetchError } = await supabase
    .from('seller_orders')
    .select('id, status, store_id')
    .eq('id', sellerOrderId)
    .maybeSingle();

  if (fetchError || !currentOrder) {
    return { error: 'Order not found or access denied.' };
  }

  // 5. Enforce valid status lifecycle progression
  const currentStatus = currentOrder.status as OrderStatus;
  const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];

  if (!allowedNext.includes(targetStatus)) {
    return {
      error: `Cannot transition order status from ${currentStatus} to ${targetStatus}.`,
    };
  }

  // 6. Invoke updateSellerOrderStatus (which runs under PostgreSQL RLS)
  try {
    const updated = await updateSellerOrderStatus(sellerOrderId, targetStatus);
    if (!updated) {
      return { error: 'Failed to update order status. Please verify permissions.' };
    }

    revalidatePath('/seller/dashboard');
    return { success: true, status: updated.status };
  } catch (err) {
    console.error('Failed to update seller order status:', err);
    // Sanitize error: never leak SQL or internal stack traces
    return { error: 'Unable to update order status. Please try again.' };
  }
}
