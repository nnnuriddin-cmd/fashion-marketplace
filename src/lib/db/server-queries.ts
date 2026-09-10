import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  UserRow,
  StoreRow,
  SellerOrderRow,
  OrderItemRow,
  ParentOrderRow,
  OrderStatus,
  AdminPlatformMetrics,
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

export interface AdminOrderItem {
  id: string;
  productId: string | null;
  productName: string;
  productImage: string | null;
  selectedSize: string | null;
  selectedColor: string | null;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface AdminSellerSubOrder {
  id: string;
  subOrderNumber: string;
  storeId: string | null;
  storeName: string;
  storeSlug: string | null;
  status: OrderStatus;
  subtotal: number;
  commissionAmount: number;
  sellerEarnings: number;
  createdAt: string;
  itemsCount: number;
  items: AdminOrderItem[];
}

export interface AdminOrderDetails {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryAddress: string;
  deliveryMethod: string | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  totalAmount: number;
  orderNotes: string | null;
  totalItemsCount: number;
  sellerOrdersCount: number;
  sellerOrders: AdminSellerSubOrder[];
}

export interface AdminOrdersResult {
  orders: AdminOrderDetails[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminOrdersQueryOptions {
  limit?: number;
  offset?: number;
  status?: string;
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

// ============================================================================
// Server-Only Authenticated Admin Queries
// ============================================================================

/**
 * Internal security guard enforcing authenticated ADMIN role for administrative queries.
 * Derived strictly from verified SSR session and authoritative public.users.role.
 * Never trusts client input, query parameters, or client-supplied IDs.
 */
async function assertAdminRole(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    throw new Error('Unauthorized: Authentication required');
  }

  const serverSupabase = getServerSupabase();
  const { data: profile, error: profileErr } = await serverSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr || !profile || profile.role !== 'ADMIN') {
    throw new Error('Forbidden: ADMIN role required');
  }
}

/**
 * Retrieves global marketplace parent orders with nested seller sub-orders and items.
 * Strictly gated to authenticated administrators on the server.
 * Uses service-role client on the server to read across vendor and customer boundaries.
 * 
 * Invariants:
 * - Read-only: does not expose or perform any mutations.
 * - Paged: bounded by safe limit (max 100) and offset range.
 */
export async function getAdminRecentOrders(
  options?: AdminOrdersQueryOptions
): Promise<AdminOrdersResult> {
  await assertAdminRole();

  const safeLimit = Math.min(Math.max(1, options?.limit ?? 20), 100);
  const safeOffset = Math.max(0, options?.offset ?? 0);
  const statusFilter = options?.status?.toUpperCase()?.trim();

  const serverSupabase = getServerSupabase();

  const isSellerOrderStatus = statusFilter && [
    'NEW',
    'CONFIRMED',
    'PREPARING',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
  ].includes(statusFilter);

  const isPaymentStatus = statusFilter && ['PAID', 'PENDING', 'REFUNDED'].includes(statusFilter);

  // When filtering by seller order status, use !inner to enforce parent row filtering in PostgREST
  const sellerOrdersRelation = isSellerOrderStatus ? 'seller_orders!inner (' : 'seller_orders (';

  const selectQuery = `
    id,
    order_number,
    customer_id,
    customer_name,
    customer_phone,
    delivery_address,
    delivery_method,
    payment_method,
    payment_status,
    total_amount,
    order_notes,
    created_at,
    users:customer_id (
      id,
      email,
      full_name,
      phone
    ),
    ${sellerOrdersRelation}
      id,
      sub_order_number,
      status,
      subtotal,
      commission_amount,
      seller_earnings,
      store_id,
      created_at,
      stores:store_id (
        id,
        name,
        slug
      ),
      order_items (
        id,
        product_id,
        product_name,
        product_image,
        selected_size,
        selected_color,
        price,
        quantity,
        subtotal
      )
    )
  `;

  let query = serverSupabase
    .from('parent_orders')
    .select(selectQuery, { count: 'exact' })
    .order('created_at', { ascending: false });

  if (isSellerOrderStatus) {
    query = query.eq('seller_orders.status', statusFilter);
  } else if (isPaymentStatus) {
    query = query.eq('payment_status', statusFilter);
  }

  const { data, count, error } = await query.range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    console.error('Failed to retrieve admin orders:', error);
    throw new Error(`Failed to load admin orders: ${error.message}`);
  }

  const totalCount = count ?? 0;
  const page = Math.floor(safeOffset / safeLimit) + 1;
  const totalPages = Math.ceil(totalCount / safeLimit);

  const orders: AdminOrderDetails[] = (data || []).map((row: any) => {
    const customer = row.users || null;
    const sellerOrders: AdminSellerSubOrder[] = (row.seller_orders || []).map((so: any) => {
      const store = so.stores || null;
      const items: AdminOrderItem[] = (so.order_items || []).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        productImage: item.product_image,
        selectedSize: item.selected_size,
        selectedColor: item.selected_color,
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        subtotal: Number(item.subtotal) || 0,
      }));

      const itemsCount = items.reduce((sum, it) => sum + it.quantity, 0);

      return {
        id: so.id,
        subOrderNumber: so.sub_order_number,
        storeId: so.store_id,
        storeName: store?.name || 'Unknown Store',
        storeSlug: store?.slug || null,
        status: so.status as OrderStatus,
        subtotal: Number(so.subtotal) || 0,
        commissionAmount: Number(so.commission_amount) || 0,
        sellerEarnings: Number(so.seller_earnings) || 0,
        createdAt: so.created_at,
        itemsCount,
        items,
      };
    });

    const totalItemsCount = sellerOrders.reduce((sum, so) => sum + so.itemsCount, 0);

    return {
      id: row.id,
      orderNumber: row.order_number,
      createdAt: row.created_at,
      customerId: row.customer_id,
      customerName: row.customer_name || customer?.full_name || 'Customer',
      customerPhone: row.customer_phone || customer?.phone || '',
      customerEmail: customer?.email || null,
      deliveryAddress: row.delivery_address,
      deliveryMethod: row.delivery_method,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      totalAmount: Number(row.total_amount) || 0,
      orderNotes: row.order_notes,
      totalItemsCount,
      sellerOrdersCount: sellerOrders.length,
      sellerOrders,
    };
  });

  return {
    orders,
    totalCount,
    page,
    limit: safeLimit,
    totalPages,
  };
}

/**
 * Calculates marketplace platform metrics using service-role privileges on the server.
 * Accurately aggregates GMV and commission amounts across all orders bypassing client RLS.
 * Strictly gated to authenticated ADMIN users.
 */
export async function getAdminPlatformMetricsServer(): Promise<AdminPlatformMetrics> {
  await assertAdminRole();

  const serverSupabase = getServerSupabase();

  const [
    storesRes,
    pendingStoresRes,
    productsRes,
    ordersRes,
    gmvRes,
    commissionRes,
  ] = await Promise.all([
    serverSupabase.from('stores').select('*', { count: 'exact', head: true }),
    serverSupabase.from('stores').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    serverSupabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    serverSupabase.from('parent_orders').select('*', { count: 'exact', head: true }),
    serverSupabase.from('parent_orders').select('total_amount'),
    serverSupabase.from('seller_orders').select('commission_amount'),
  ]);

  const gmv = (gmvRes.data || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const totalCommission = (commissionRes.data || []).reduce((sum, o) => sum + (Number(o.commission_amount) || 0), 0);

  return {
    storesCount: storesRes.count || 0,
    pendingStoresCount: pendingStoresRes.count || 0,
    productsCount: productsRes.count || 0,
    ordersCount: ordersRes.count || 0,
    gmv,
    totalCommission,
  };
}

