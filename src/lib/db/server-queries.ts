import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  UserRow,
  StoreRow,
  SellerOrderRow,
  OrderItemRow,
  ParentOrderRow,
  OrderStatus,
} from './queries';

// ============================================================================
// Types for Private Authenticated Queries
// ============================================================================

export interface SellerDashboardMetrics {
  productsCount: number;
  ordersCount: number;
  grossSales: number;
  netEarnings: number;
  commissionPaid: number;
}

export interface SellerOrderWithCustomer extends SellerOrderRow {
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  items?: OrderItemRow[];
}

export interface CustomerOrderDetails extends ParentOrderRow {
  seller_orders: (SellerOrderRow & {
    store_name?: string | null;
    store_slug?: string | null;
    store_logo?: string | null;
    items: OrderItemRow[];
  })[];
}

// ============================================================================
// Cookie-Aware Private User & Store Queries
// ============================================================================

/**
 * Retrieves a user profile by ID using the SSR cookie-aware client.
 * Enforces PostgreSQL RLS ("Users can read own profile": id = auth.uid()).
 */
export async function getUserById(id: string): Promise<UserRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as UserRow) || null;
}

/**
 * Retrieves a store by its owner ID using the SSR cookie-aware client.
 * Enforces PostgreSQL RLS ("Public can view approved stores": status = 'APPROVED' OR owner_id = auth.uid()).
 */
export async function getStoreByOwnerId(ownerId: string): Promise<StoreRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as StoreRow) || null;
}

// ============================================================================
// Cookie-Aware Customer Queries
// ============================================================================

/**
 * Retrieves orders for the authenticated customer using SSR cookies.
 * Enforces application-level identity verification and PostgreSQL RLS:
 * ("Customer can view own orders": customer_id = auth.uid()).
 */
export async function getCustomerOrders(customerId: string): Promise<CustomerOrderDetails[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  // Application-level identity guard: authenticated user ID must match requested customerId
  if (authErr || !user || user.id !== customerId) {
    return [];
  }

  const { data: parentOrders, error: parentErr } = await supabase
    .from('parent_orders')
    .select(`
      *,
      seller_orders (
        *,
        stores (
          name,
          slug,
          logo
        ),
        order_items (*)
      )
    `)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (parentErr) throw parentErr;

  return (parentOrders || []).map((po: Record<string, unknown>) => {
    const rawSellerOrders = (po.seller_orders as Record<string, unknown>[]) || [];
    const formattedSellerOrders = rawSellerOrders.map((so) => {
      const store = so.stores as Record<string, unknown> | null;
      return {
        ...(so as unknown as SellerOrderRow),
        store_name: (store?.name as string) || null,
        store_slug: (store?.slug as string) || null,
        store_logo: (store?.logo as string) || null,
        items: (so.order_items as OrderItemRow[]) || [],
      };
    });

    return {
      ...(po as unknown as ParentOrderRow),
      seller_orders: formattedSellerOrders,
    };
  });
}

// ============================================================================
// Cookie-Aware Seller Dashboard & Order Queries
// ============================================================================

/**
 * Retrieves orders for a seller's store using SSR cookies.
 * Enforces application-level ownership check and PostgreSQL RLS:
 * ("Seller can view own seller orders": store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())).
 */
export async function getSellerOrders(storeId: string, limit = 20): Promise<SellerOrderWithCustomer[]> {
  const supabase = createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return [];
  }

  // Application-level verification of store ownership
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, owner_id')
    .eq('id', storeId)
    .maybeSingle();

  if (storeErr || !store || store.owner_id !== user.id) {
    return [];
  }

  const { data, error } = await supabase
    .from('seller_orders')
    .select(`
      *,
      parent_orders (
        customer_name,
        customer_phone,
        delivery_address
      ),
      order_items (*)
    `)
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => {
    const parent = row.parent_orders as Record<string, unknown> | null;
    return {
      ...(row as unknown as SellerOrderRow),
      customer_name: (parent?.customer_name as string) || 'Customer',
      customer_phone: (parent?.customer_phone as string) || '',
      delivery_address: (parent?.delivery_address as string) || '',
      items: (row.order_items as OrderItemRow[]) || [],
    };
  });
}

/**
 * Retrieves seller dashboard metrics using the SSR cookie-aware client.
 * Enforces application-level ownership check and PostgreSQL RLS.
 */
export async function getSellerDashboardMetrics(storeId: string): Promise<SellerDashboardMetrics> {
  const emptyMetrics: SellerDashboardMetrics = {
    productsCount: 0,
    ordersCount: 0,
    grossSales: 0,
    netEarnings: 0,
    commissionPaid: 0,
  };

  const supabase = createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return emptyMetrics;
  }

  // Application-level verification of store ownership
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .select('id, owner_id')
    .eq('id', storeId)
    .maybeSingle();

  if (storeErr || !store || store.owner_id !== user.id) {
    return emptyMetrics;
  }

  const [productsRes, ordersRes, earningsRes] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('store_id', storeId),
    supabase.from('seller_orders').select('*', { count: 'exact', head: true }).eq('store_id', storeId),
    supabase.from('seller_orders').select('subtotal, seller_earnings, commission_amount').eq('store_id', storeId),
  ]);

  const earnings = earningsRes.data || [];
  const grossSales = earnings.reduce((sum, row) => sum + (Number(row.subtotal) || 0), 0);
  const netEarnings = earnings.reduce((sum, row) => sum + (Number(row.seller_earnings) || 0), 0);
  const commissionPaid = earnings.reduce((sum, row) => sum + (Number(row.commission_amount) || 0), 0);

  return {
    productsCount: productsRes.count || 0,
    ordersCount: ordersRes.count || 0,
    grossSales,
    netEarnings,
    commissionPaid,
  };
}

/**
 * Updates seller order status using SSR cookies under PostgreSQL RLS:
 * ("Seller can update own seller order status": store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())).
 */
export async function updateSellerOrderStatus(
  sellerOrderId: string,
  status: OrderStatus
): Promise<SellerOrderRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('seller_orders')
    .update({ status })
    .eq('id', sellerOrderId)
    .select()
    .single();

  if (error) throw error;
  return (data as SellerOrderRow) || null;
}
