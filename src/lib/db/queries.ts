import { supabase } from '../supabase';

// ============================================================================
// TypeScript Types & Interfaces (Matching 002_full_schema.sql)
// ============================================================================

export type UserRole = 'CUSTOMER' | 'SELLER' | 'ADMIN';
export type StoreStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED' | 'REJECTED';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type OrderStatus = 'NEW' | 'CONFIRMED' | 'PREPARING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  telegram_id: string | null;
  telegram_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo: string | null;
  cover_image: string | null;
  location: string | null;
  city: string | null;
  phone: string | null;
  telegram_username: string | null;
  status: StoreStatus;
  rating: number;
  commission_rate: number;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  gender: string | null;
  parent_id: string | null;
  image: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BrandRow {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  store_id: string;
  category_id: string | null;
  brand_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  price: number;
  discount_price: number | null;
  currency: string;
  sku: string | null;
  stock_quantity: number;
  sizes: string[];
  colors: string[];
  material: string | null;
  gender: string | null;
  style: string | null;
  occasion: string | null;
  season: string | null;
  tags: string[];
  original_image: string | null;
  processed_images: string[];
  ai_metadata: Record<string, unknown>;
  is_featured: boolean;
  is_trending: boolean;
  views_count: number;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface ParentOrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_method: string;
  payment_method: string;
  payment_status: PaymentStatus;
  total_amount: number;
  order_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellerOrderRow {
  id: string;
  sub_order_number: string;
  parent_order_id: string;
  store_id: string | null;
  status: OrderStatus;
  subtotal: number;
  commission_amount: number;
  seller_earnings: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  seller_order_id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  selected_size: string | null;
  selected_color: string | null;
  price: number;
  quantity: number;
  subtotal: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewRow {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceSettingsRow {
  id: string;
  default_commission: number;
  auto_approve_products: boolean;
  currency: string;
  created_at: string;
  updated_at: string;
}

// Input types for checkout
export interface CartItemCheckoutInput {
  productId?: string;
  name: string;
  image?: string | null;
  price: number;
  quantity: number;
  selectedSize?: string | null;
  selectedColor?: string | null;
  storeId: string;
}

export interface CreateOrderCheckoutInput {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryMethod?: string;
  paymentMethod?: string;
  orderNotes?: string | null;
  customerId?: string | null;
  cartItems: CartItemCheckoutInput[];
}

export interface CreateOrderCheckoutResult {
  parentOrderId: string;
  orderNumber: string;
  totalAmount: number;
  sellerOrders: {
    sellerOrderId: string;
    subOrderNumber: string;
    storeId: string;
    subtotal: number;
    commissionAmount: number;
    sellerEarnings: number;
    itemsCount: number;
  }[];
}

// Notification payload type
export interface SellerOrderNotificationDetails {
  sellerOrderId: string;
  subOrderNumber: string;
  status: string;
  subtotal: number;
  storeId: string | null;
  storeName: string;
  telegramUsername: string | null;
  sellerTelegramId: string | null;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  items: {
    productName: string;
    selectedSize: string | null;
    selectedColor: string | null;
    quantity: number;
    price: number;
    subtotal: number;
  }[];
}

// ============================================================================
// System / Utility
// ============================================================================

export async function initializeDatabase(): Promise<void> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error && error.message !== 'Auth session missing!') {
      console.error('Database connection error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// ============================================================================
// User Operations
// ============================================================================

export interface CreateUserInput {
  id?: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  role?: UserRole;
  avatarUrl?: string | null;
  telegramId?: string | null;
  telegramCode?: string | null;
  createdAt?: string;
}

export async function createUser(user: CreateUserInput): Promise<UserRow | null> {
  const insertPayload: Record<string, unknown> = {
    email: user.email,
    password_hash: user.passwordHash,
    full_name: user.fullName,
    phone: user.phone || null,
    role: user.role || 'CUSTOMER',
    avatar_url: user.avatarUrl || null,
    telegram_id: user.telegramId || null,
    telegram_code: user.telegramCode || null,
  };

  if (user.id) insertPayload.id = user.id;
  if (user.createdAt) insertPayload.created_at = user.createdAt;

  const { data, error } = await supabase
    .from('users')
    .insert([insertPayload])
    .select()
    .single();

  if (error) throw error;
  return (data as UserRow) || null;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as UserRow) || null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as UserRow) || null;
}

// ============================================================================
// Store Operations
// ============================================================================

export interface CreateStoreInput {
  id?: string;
  ownerId: string;
  name: string;
  slug: string;
  description?: string | null;
  logo?: string | null;
  coverImage?: string | null;
  location?: string | null;
  city?: string | null;
  phone?: string | null;
  telegramUsername?: string | null;
  status?: StoreStatus;
  commissionRate?: number;
  rating?: number;
}

export async function createStore(store: CreateStoreInput): Promise<StoreRow | null> {
  const insertPayload: Record<string, unknown> = {
    owner_id: store.ownerId,
    name: store.name,
    slug: store.slug,
    description: store.description || null,
    logo: store.logo || null,
    cover_image: store.coverImage || null,
    location: store.location || null,
    city: store.city || 'Tashkent',
    phone: store.phone || null,
    telegram_username: store.telegramUsername || null,
    status: store.status || 'PENDING',
    rating: store.rating ?? 5.0,
    commission_rate: store.commissionRate ?? 10.0,
  };

  if (store.id) insertPayload.id = store.id;

  const { data, error } = await supabase
    .from('stores')
    .insert([insertPayload])
    .select()
    .single();

  if (error) throw error;
  return (data as StoreRow) || null;
}

export async function getStoreBySlug(slug: string): Promise<StoreRow | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'APPROVED')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as StoreRow) || null;
}

export async function getStoreById(id: string): Promise<StoreRow | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as StoreRow) || null;
}

export async function getAllApprovedStores(): Promise<StoreRow[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('status', 'APPROVED')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as StoreRow[]) || [];
}

export async function getPendingStores(): Promise<StoreRow[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as StoreRow[]) || [];
}

export async function updateStoreStatus(storeId: string, status: StoreStatus): Promise<StoreRow | null> {
  const { data, error } = await supabase
    .from('stores')
    .update({ status })
    .eq('id', storeId)
    .select()
    .single();

  if (error) throw error;
  return (data as StoreRow) || null;
}

// ============================================================================
// Category & Brand Operations
// ============================================================================

export async function getCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data as CategoryRow[]) || [];
}

export async function getRootCategories(): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .is('parent_id', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data as CategoryRow[]) || [];
}

export async function getBrands(): Promise<BrandRow[]> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data as BrandRow[]) || [];
}

// ============================================================================
// Product Operations
// ============================================================================

export interface CreateProductInput {
  id?: string;
  storeId: string;
  categoryId?: string | null;
  brandId?: string | null;
  title: string;
  slug: string;
  description?: string | null;
  price: number;
  discountPrice?: number | null;
  currency?: string;
  sku?: string | null;
  stockQuantity?: number;
  sizes?: string[];
  colors?: string[];
  material?: string | null;
  gender?: string | null;
  style?: string | null;
  occasion?: string | null;
  season?: string | null;
  tags?: string[];
  originalImage?: string | null;
  processedImages?: string[];
  aiMetadata?: Record<string, unknown>;
  isFeatured?: boolean;
  isTrending?: boolean;
  status?: ProductStatus;
}

export async function createProduct(product: CreateProductInput): Promise<ProductRow | null> {
  const insertPayload: Record<string, unknown> = {
    store_id: product.storeId,
    category_id: product.categoryId || null,
    brand_id: product.brandId || null,
    title: product.title,
    slug: product.slug,
    description: product.description || null,
    price: product.price,
    discount_price: product.discountPrice || null,
    currency: product.currency || 'UZS',
    sku: product.sku || null,
    stock_quantity: product.stockQuantity ?? 0,
    sizes: product.sizes || [],
    colors: product.colors || [],
    material: product.material || null,
    gender: product.gender || null,
    style: product.style || null,
    occasion: product.occasion || null,
    season: product.season || null,
    tags: product.tags || [],
    original_image: product.originalImage || null,
    processed_images: product.processedImages || [],
    ai_metadata: product.aiMetadata || {},
    is_featured: product.isFeatured ?? false,
    is_trending: product.isTrending ?? false,
    status: product.status || 'DRAFT',
  };

  if (product.id) insertPayload.id = product.id;

  const { data, error } = await supabase
    .from('products')
    .insert([insertPayload])
    .select()
    .single();

  if (error) throw error;
  return (data as ProductRow) || null;
}

export async function getProductBySlug(slug: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      stores (
        id,
        name,
        slug,
        description,
        logo,
        cover_image,
        location,
        rating,
        phone,
        telegram_username
      ),
      categories (
        id,
        name,
        slug
      ),
      brands (
        id,
        name,
        slug,
        logo
      )
    `)
    .eq('slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function getProductsByStoreId(storeId: string): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as ProductRow[]) || [];
}

export interface SearchProductsFilter {
  query?: string;
  categorySlug?: string;
  brandSlug?: string;
  gender?: string;
  minPrice?: number;
  maxPrice?: number;
  status?: ProductStatus;
  limit?: number;
  offset?: number;
}

export async function searchProducts(filterOrQuery: string | SearchProductsFilter): Promise<Record<string, unknown>[]> {
  let query = supabase
    .from('products')
    .select(`
      *,
      stores (id, name, slug, logo, location, rating),
      categories (id, name, slug),
      brands (id, name, slug)
    `);

  if (typeof filterOrQuery === 'string') {
    if (filterOrQuery.trim()) {
      query = query.or(`title.ilike.%${filterOrQuery}%,description.ilike.%${filterOrQuery}%`);
    }
  } else {
    // 1. Resolve categorySlug to category_id if provided
    if (filterOrQuery.categorySlug) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', filterOrQuery.categorySlug)
        .maybeSingle();

      if (cat?.id) {
        query = query.eq('category_id', cat.id);
      } else {
        // Slug was specified but category does not exist -> return empty list
        return [];
      }
    }

    // 2. Resolve brandSlug to brand_id if provided
    if (filterOrQuery.brandSlug) {
      const { data: brd } = await supabase
        .from('brands')
        .select('id')
        .eq('slug', filterOrQuery.brandSlug)
        .maybeSingle();

      if (brd?.id) {
        query = query.eq('brand_id', brd.id);
      } else {
        // Slug was specified but brand does not exist -> return empty list
        return [];
      }
    }

    if (filterOrQuery.query && filterOrQuery.query.trim()) {
      query = query.or(`title.ilike.%${filterOrQuery.query}%,description.ilike.%${filterOrQuery.query}%`);
    }
    if (filterOrQuery.gender) {
      query = query.eq('gender', filterOrQuery.gender);
    }
    if (filterOrQuery.minPrice !== undefined) {
      query = query.gte('price', filterOrQuery.minPrice);
    }
    if (filterOrQuery.maxPrice !== undefined) {
      query = query.lte('price', filterOrQuery.maxPrice);
    }
    if (filterOrQuery.status) {
      query = query.eq('status', filterOrQuery.status);
    } else {
      query = query.eq('status', 'ACTIVE');
    }
    if (filterOrQuery.limit) {
      query = query.limit(filterOrQuery.limit);
    }
    if (filterOrQuery.offset) {
      query = query.range(filterOrQuery.offset, filterOrQuery.offset + (filterOrQuery.limit || 20) - 1);
    }
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ============================================================================
// Multi-Vendor Checkout Operations
// ============================================================================

/**
 * Creates a parent order, splits it into vendor seller orders, and inserts order items.
 *
 * IMPORTANT TRANSACTION & ATOMICITY NOTICE:
 * This implementation uses sequential Supabase REST calls. It is NOT atomic on the database
 * level; if a subsequent step fails (network timeout, constraint failure), previous rows will
 * remain in the database.
 *
 * TODO (PostgreSQL RPC / Stored Procedure):
 * For production-grade atomicity, migrate this function to call a PostgreSQL RPC function
 * (e.g. `supabase.rpc('create_order_checkout', { ... })`) executed inside a single BEGIN...COMMIT transaction.
 */
export async function createOrderTransaction(
  orderInput: CreateOrderCheckoutInput
): Promise<CreateOrderCheckoutResult> {
  const {
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryMethod = 'STANDARD',
    paymentMethod = 'CASH',
    orderNotes = null,
    customerId = null,
    cartItems,
  } = orderInput;

  if (!cartItems || cartItems.length === 0) {
    throw new Error('Cannot create an order with empty cartItems');
  }

  // 1. Fetch actual products from DB to verify existence, prices, and stock
  // Client-supplied prices MUST NOT be trusted.
  const productIds = Array.from(
    new Set(cartItems.map((item) => item.productId).filter((id): id is string => Boolean(id)))
  );

  if (productIds.length !== cartItems.length) {
    throw new Error('All cart items must contain a valid productId for checkout validation');
  }

  const { data: dbProducts, error: prodErr } = await supabase
    .from('products')
    .select('id, title, store_id, price, discount_price, stock_quantity, original_image, status')
    .in('id', productIds);

  if (prodErr || !dbProducts) {
    throw new Error(`Failed to verify products in catalog: ${prodErr?.message || 'Unknown database error'}`);
  }

  const dbProductMap = new Map<string, (typeof dbProducts)[0]>();
  for (const p of dbProducts) {
    dbProductMap.set(p.id, p);
  }

  // Group verified items by store_id and calculate server-side subtotals
  const storeGroups: Record<
    string,
    {
      items: {
        productId: string;
        name: string;
        image: string | null;
        verifiedPrice: number;
        quantity: number;
        selectedSize: string | null;
        selectedColor: string | null;
        lineTotal: number;
      }[];
      subtotal: number;
    }
  > = {};
  let totalAmount = 0;

  for (const item of cartItems) {
    const dbProduct = item.productId ? dbProductMap.get(item.productId) : undefined;
    if (!dbProduct) {
      throw new Error(`Product "${item.name}" (ID: ${item.productId}) not found in active catalog.`);
    }

    if (dbProduct.status !== 'ACTIVE') {
      throw new Error(`Product "${dbProduct.title}" is currently not available for purchase.`);
    }

    if (item.quantity <= 0) {
      throw new Error(`Invalid purchase quantity for "${dbProduct.title}".`);
    }

    const availableStock = dbProduct.stock_quantity ?? 0;
    if (availableStock < item.quantity) {
      throw new Error(
        `Insufficient stock for "${dbProduct.title}". Available: ${availableStock}, Requested: ${item.quantity}`
      );
    }

    // Determine actual effective price from database
    const actualPrice = dbProduct.discount_price !== null && dbProduct.discount_price !== undefined
      ? Number(dbProduct.discount_price)
      : Number(dbProduct.price);

    const targetStoreId = dbProduct.store_id;
    if (!storeGroups[targetStoreId]) {
      storeGroups[targetStoreId] = { items: [], subtotal: 0 };
    }

    const lineTotal = actualPrice * item.quantity;
    storeGroups[targetStoreId].items.push({
      productId: dbProduct.id,
      name: dbProduct.title,
      image: dbProduct.original_image || item.image || null,
      verifiedPrice: actualPrice,
      quantity: item.quantity,
      selectedSize: item.selectedSize || null,
      selectedColor: item.selectedColor || null,
      lineTotal,
    });

    storeGroups[targetStoreId].subtotal += lineTotal;
    totalAmount += lineTotal;
  }

  // 2. Create parent order
  const orderNumber = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;

  const { data: parentOrder, error: parentError } = await supabase
    .from('parent_orders')
    .insert([
      {
        order_number: orderNumber,
        customer_id: customerId || null,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_address: deliveryAddress,
        delivery_method: deliveryMethod,
        payment_method: paymentMethod,
        payment_status: 'PENDING',
        total_amount: totalAmount,
        order_notes: orderNotes,
      },
    ])
    .select()
    .single();

  if (parentError || !parentOrder) {
    throw new Error(`Failed to create parent_order: ${parentError?.message}`);
  }

  // 3. Fetch commission rates for participating stores
  const storeIds = Object.keys(storeGroups);
  const { data: storesData } = await supabase
    .from('stores')
    .select('id, commission_rate')
    .in('id', storeIds);

  const commissionMap: Record<string, number> = {};
  if (storesData) {
    for (const s of storesData) {
      commissionMap[s.id] = Number(s.commission_rate) || 10.0;
    }
  }

  // 4. Create seller orders and line items
  const sellerLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  let letterIdx = 0;
  const createdSellerOrdersResult: CreateOrderCheckoutResult['sellerOrders'] = [];

  for (const [storeId, group] of Object.entries(storeGroups)) {
    const subOrderNumber = `${orderNumber}-${sellerLetters[letterIdx % sellerLetters.length]}`;
    letterIdx++;

    const commRate = commissionMap[storeId] ?? 10.0;
    const commissionAmount = Math.round(((group.subtotal * commRate) / 100) * 100) / 100;
    const sellerEarnings = group.subtotal - commissionAmount;

    const { data: sellerOrder, error: sellerError } = await supabase
      .from('seller_orders')
      .insert([
        {
          sub_order_number: subOrderNumber,
          parent_order_id: parentOrder.id,
          store_id: storeId,
          status: 'NEW',
          subtotal: group.subtotal,
          commission_amount: commissionAmount,
          seller_earnings: sellerEarnings,
        },
      ])
      .select()
      .single();

    if (sellerError || !sellerOrder) {
      throw new Error(`Failed to create seller_order for store ${storeId}: ${sellerError?.message}`);
    }

    // Insert order items for this sub-order using verified product price snapshots
    const itemsPayload = group.items.map((item) => ({
      seller_order_id: sellerOrder.id,
      product_id: item.productId,
      product_name: item.name,
      product_image: item.image,
      selected_size: item.selectedSize,
      selected_color: item.selectedColor,
      price: item.verifiedPrice,
      quantity: item.quantity,
      subtotal: item.lineTotal,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsPayload);

    if (itemsError) {
      throw new Error(`Failed to insert order_items for sub-order ${subOrderNumber}: ${itemsError.message}`);
    }

    createdSellerOrdersResult.push({
      sellerOrderId: sellerOrder.id,
      subOrderNumber: sellerOrder.sub_order_number,
      storeId,
      subtotal: group.subtotal,
      commissionAmount,
      sellerEarnings,
      itemsCount: group.items.length,
    });
  }

  return {
    parentOrderId: parentOrder.id,
    orderNumber: parentOrder.order_number,
    totalAmount,
    sellerOrders: createdSellerOrdersResult,
  };
}

// ============================================================================
// Telegram & Notification Queries
// ============================================================================

export async function getSellerOrderForNotification(
  sellerOrderId: string
): Promise<SellerOrderNotificationDetails | null> {
  // 1. Fetch seller order with parent order data
  const { data: sellerOrder, error: orderErr } = await supabase
    .from('seller_orders')
    .select(`
      id,
      sub_order_number,
      status,
      subtotal,
      store_id,
      parent_orders (
        customer_name,
        customer_phone,
        delivery_address
      )
    `)
    .eq('id', sellerOrderId)
    .single();

  if (orderErr || !sellerOrder) {
    return null;
  }

  // 2. Fetch store details and owner telegram_id explicitly
  let storeName = 'Vendor Store';
  let telegramUsername: string | null = null;
  let sellerTelegramId: string | null = null;

  if (sellerOrder.store_id) {
    const { data: store } = await supabase
      .from('stores')
      .select('name, telegram_username, owner_id')
      .eq('id', sellerOrder.store_id)
      .maybeSingle();

    if (store) {
      storeName = store.name || 'Vendor Store';
      telegramUsername = store.telegram_username || null;

      if (store.owner_id) {
        const { data: owner } = await supabase
          .from('users')
          .select('telegram_id')
          .eq('id', store.owner_id)
          .maybeSingle();

        if (owner) {
          sellerTelegramId = owner.telegram_id || null;
        }
      }
    }
  }

  // 3. Fetch order items
  const { data: items } = await supabase
    .from('order_items')
    .select('product_name, selected_size, selected_color, quantity, price, subtotal')
    .eq('seller_order_id', sellerOrderId);

  const parentOrderInfo = (sellerOrder.parent_orders as unknown as Record<string, unknown> | null);

  return {
    sellerOrderId: sellerOrder.id,
    subOrderNumber: sellerOrder.sub_order_number,
    status: sellerOrder.status,
    subtotal: Number(sellerOrder.subtotal),
    storeId: sellerOrder.store_id,
    storeName,
    telegramUsername,
    sellerTelegramId,
    customerName: (parentOrderInfo?.customer_name as string) || 'Customer',
    customerPhone: (parentOrderInfo?.customer_phone as string) || '',
    deliveryAddress: (parentOrderInfo?.delivery_address as string) || '',
    items: (items || []).map((i) => ({
      productName: i.product_name,
      selectedSize: i.selected_size,
      selectedColor: i.selected_color,
      quantity: i.quantity,
      price: Number(i.price),
      subtotal: Number(i.subtotal),
    })),
  };
}

// ============================================================================
// Admin Dashboard Queries
// ============================================================================

export interface AdminPlatformMetrics {
  storesCount: number;
  pendingStoresCount: number;
  productsCount: number;
  ordersCount: number;
  gmv: number;
  totalCommission: number;
}

export interface AdminStoreListItem extends StoreRow {
  owner_name?: string | null;
  owner_email?: string | null;
}

export async function getAdminPlatformMetrics(): Promise<AdminPlatformMetrics> {
  const [
    storesRes,
    pendingStoresRes,
    productsRes,
    ordersRes,
    gmvRes,
    commissionRes,
  ] = await Promise.all([
    supabase.from('stores').select('*', { count: 'exact', head: true }),
    supabase.from('stores').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
    supabase.from('parent_orders').select('*', { count: 'exact', head: true }),
    supabase.from('parent_orders').select('total_amount'),
    supabase.from('seller_orders').select('commission_amount'),
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

export async function getAdminStoresList(): Promise<AdminStoreListItem[]> {
  const { data, error } = await supabase
    .from('stores')
    .select(`
      *,
      users:owner_id (
        full_name,
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((s: Record<string, unknown>) => {
    const owner = s.users as Record<string, unknown> | null;
    return {
      ...(s as unknown as StoreRow),
      owner_name: (owner?.full_name as string) || null,
      owner_email: (owner?.email as string) || null,
    };
  });
}

// ============================================================================
// Seller Dashboard Queries
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

export async function getSellerDashboardMetrics(storeId: string): Promise<SellerDashboardMetrics> {
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

export async function getSellerOrders(storeId: string, limit = 20): Promise<SellerOrderWithCustomer[]> {
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

export async function updateSellerOrderStatus(sellerOrderId: string, status: OrderStatus): Promise<SellerOrderRow | null> {
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
// Customer Account Queries
// ============================================================================

export interface CustomerOrderDetails extends ParentOrderRow {
  seller_orders: (SellerOrderRow & {
    store_name?: string | null;
    store_slug?: string | null;
    store_logo?: string | null;
    items: OrderItemRow[];
  })[];
}

export async function getCustomerOrders(customerId: string): Promise<CustomerOrderDetails[]> {
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
