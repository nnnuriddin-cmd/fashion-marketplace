import { supabase } from '../supabase';

export async function initializeDatabase() {
  // Supabase handles schema initialization
  // But we can verify connection here
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

// User operations
export async function createUser(user: {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  role?: string;
  createdAt: string;
}) {
  const { data, error } = await supabase
    .from('users')
    .insert([user])
    .select();
  
  if (error) throw error;
  return data?.[0];
}

export async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function getUserById(id: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

// Store operations
export async function createStore(store: any) {
  const { data, error } = await supabase
    .from('stores')
    .insert([store])
    .select();
  
  if (error) throw error;
  return data?.[0];
}

export async function getStoreBySlug(slug: string) {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'APPROVED')
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function getStoreById(id: string) {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function getAllApprovedStores() {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('status', 'APPROVED')
    .order('createdAt', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getPendingStores() {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('status', 'PENDING')
    .order('createdAt', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function updateStoreStatus(storeId: string, status: string) {
  const { data, error } = await supabase
    .from('stores')
    .update({ status })
    .eq('id', storeId)
    .select();
  
  if (error) throw error;
  return data?.[0];
}

// Product operations
export async function createProduct(product: any) {
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select();
  
  if (error) throw error;
  return data?.[0];
}

export async function getProductBySlug(slug: string) {
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
        location,
        rating,
        phone,
        telegramUsername
      )
    `)
    .eq('slug', slug)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function getProductsByStoreId(storeId: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('storeId', storeId)
    .order('createdAt', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function searchProducts(query: string) {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      stores (id, name, slug, logo, location, rating)
    `)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order('createdAt', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Order operations
export async function createOrder(order: any) {
  const { data, error } = await supabase
    .from('orders')
    .insert([order])
    .select();
  
  if (error) throw error;
  return data?.[0];
}

export async function getOrderById(id: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

export async function getOrdersByUserId(userId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      stores (id, name, slug),
      products (id, title, slug)
    `)
    .eq('userId', userId)
    .order('createdAt', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function updateOrderStatus(orderId: string, status: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select();
  
  if (error) throw error;
  return data?.[0];
}
