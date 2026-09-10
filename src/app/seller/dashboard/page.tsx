import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { requireRole } from '@/lib/auth';
import {
  getStoreById,
  getStoreByOwnerId,
  getAllApprovedStores,
  getSellerDashboardMetrics,
  getSellerOrders,
  StoreRow,
} from '@/lib/db';
import { Store, Send, ShoppingBag, Package, DollarSign, Sparkles, AlertCircle } from 'lucide-react';
import { SellerOrderStatusController } from '@/components/seller/SellerOrderStatusController';

export const revalidate = 0;

interface SellerDashboardPageProps {
  searchParams?: {
    storeId?: string;
  };
}

export default async function SellerDashboardPage({ searchParams }: SellerDashboardPageProps) {
  // 1. Enforce strict server-side authorization
  // - unauthenticated user -> redirects to /account
  // - authenticated CUSTOMER -> redirects to /
  // - authenticated SELLER -> allowed
  // - authenticated ADMIN -> allowed
  const profile = await requireRole(['SELLER', 'ADMIN'], '/account', '/');

  // 2. Resolve store exclusively based on verified identity:
  // - For a SELLER: resolved strictly from stores.owner_id = profile.id.
  //   A seller can NEVER select or access another merchant's store via ?storeId=...
  // - For an ADMIN: allowed to inspect specific store via searchParams or fallback to their own store.
  let store: StoreRow | null = null;
  try {
    if (profile.role === 'SELLER') {
      store = await getStoreByOwnerId(profile.id);
    } else if (profile.role === 'ADMIN') {
      if (searchParams?.storeId) {
        store = await getStoreById(searchParams.storeId);
      }
      if (!store) {
        store = await getStoreByOwnerId(profile.id);
      }
      if (!store) {
        const approvedStores = await getAllApprovedStores();
        if (approvedStores.length > 0) {
          store = approvedStores[0];
        }
      }
    }
  } catch (error) {
    console.error(`Failed to retrieve store for user [${profile.id}]:`, error);
    throw new Error(`Failed to load store information: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 3. Safe empty state if no store belongs to this account
  if (!store) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="bg-amber-100 text-amber-800 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-neutral-900">No Store Associated with Account</h1>
        <p className="text-sm text-neutral-600 max-w-md mx-auto">
          You are authenticated as <span className="font-semibold text-neutral-800">{profile.email}</span>, but no store was found for your account. Please register a store to activate your merchant boutique.
        </p>
        <Link
          href="/seller/register"
          className="inline-block bg-neutral-900 text-white text-xs font-semibold px-6 py-3 rounded-xl hover:bg-neutral-800"
        >
          Register Store →
        </Link>
      </div>
    );
  }

  // 4. Safe state if store is not approved yet (e.g. PENDING, SUSPENDED, REJECTED)
  if (store.status !== 'APPROVED' && profile.role !== 'ADMIN') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 p-8 rounded-3xl max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto">
            <Store className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-serif font-bold text-neutral-900">{store.name}</h2>
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-200 text-amber-900">
            Status: {store.status}
          </span>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Your boutique registration is currently {store.status.toLowerCase()}. You will gain full access to merchant operations and order tracking once an administrator approves your store.
          </p>
        </div>
      </div>
    );
  }

  // Fetch metrics and orders concurrently for the resolved store
  let metrics: Awaited<ReturnType<typeof getSellerDashboardMetrics>>;
  let sellerOrders: Awaited<ReturnType<typeof getSellerOrders>>;

  try {
    const [metricsRes, ordersRes] = await Promise.all([
      getSellerDashboardMetrics(store.id),
      getSellerOrders(store.id, 6),
    ]);
    metrics = metricsRes;
    sellerOrders = ordersRes;
  } catch (error) {
    console.error(`Failed to retrieve seller metrics or orders for store ${store.id}:`, error);
    throw new Error(`Failed to load seller dashboard data: ${error instanceof Error ? error.message : String(error)}`);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Seller Header */}
      <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full border border-neutral-200 overflow-hidden bg-neutral-100 shrink-0">
            {store.logo ? (
              <Image src={store.logo} alt={store.name} fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full bg-neutral-900 text-white font-bold flex items-center justify-center text-xl">
                {store.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-bold text-neutral-900">{store.name}</h1>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  store.status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : store.status === 'PENDING'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-neutral-100 text-neutral-800'
                }`}
              >
                {store.status}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              {store.location || store.city || 'Tashkent'} • Marketplace Commission: {store.commission_rate}%
            </p>
          </div>
        </div>

        {/* Quick Nav Bar */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Link
            href={`/store/${store.slug}`}
            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3.5 py-2 rounded-xl transition-colors"
          >
            View Storefront →
          </Link>
          <Link
            href="/seller/telegram"
            className="bg-amber-800 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Telegram Bot Setup</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Gross Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">
            {metrics.grossSales.toLocaleString()} UZS
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Net Seller Earnings</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">
            {metrics.netEarnings.toLocaleString()} UZS
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Active Products</span>
            <ShoppingBag className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{metrics.productsCount} Items</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Orders Received</span>
            <Package className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{metrics.ordersCount} Orders</div>
        </div>
      </div>

      {/* AI Telegram Banner */}
      <div className="bg-neutral-900 text-white p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>AI Product Creation Bot Active</span>
          </div>
          <h3 className="text-lg font-serif font-bold">Snap a photo on your smartphone → AI Creates the Product</h3>
          <p className="text-xs text-neutral-300 max-w-xl">
            You don't need a laptop or complex forms. Open Telegram, upload your clothing item photo, enter your price and stock. It goes live instantly!
          </p>
        </div>

        <Link
          href="/seller/telegram"
          className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-2xl shrink-0 transition-colors"
        >
          Open Bot Instructions →
        </Link>
      </div>

      {/* Recent Orders Fulfillment Table */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-serif font-bold text-neutral-900">Recent Customer Orders</h3>
          <span className="text-xs text-neutral-500">Real-time Telegram Alert Sync</span>
        </div>

        <div className="space-y-4">
          {sellerOrders.length === 0 ? (
            <div className="text-center py-8 text-xs text-neutral-500">No recent orders yet.</div>
          ) : (
            sellerOrders.map((so) => (
              <div
                key={so.id}
                className="bg-neutral-50 p-4 sm:p-5 rounded-2xl border border-neutral-200/80 space-y-4 shadow-sm"
              >
                {/* Header: Sub-Order #, Customer Info, Status Controller */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-neutral-200/70">
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-neutral-900 font-mono text-sm">
                      Sub-Order #{so.sub_order_number}
                    </div>
                    <div className="text-neutral-700">
                      Customer: <strong>{so.customer_name}</strong>{' '}
                      {so.customer_phone && <span className="text-neutral-500">({so.customer_phone})</span>}
                    </div>
                    <div className="text-neutral-500 text-[11px]">
                      {so.delivery_address || 'Address not specified'}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="text-left sm:text-right">
                      <div className="font-bold text-neutral-900 text-sm">
                        {Number(so.subtotal).toLocaleString()} UZS
                      </div>
                      <div className="text-[11px] text-amber-800 font-medium">
                        Net: {Number(so.seller_earnings).toLocaleString()} UZS
                      </div>
                    </div>

                    <SellerOrderStatusController
                      sellerOrderId={so.id}
                      currentStatus={so.status}
                    />
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                    Order Items ({so.items?.length || 0})
                  </div>
                  <div className="divide-y divide-neutral-200/60 bg-white rounded-xl border border-neutral-200/70 px-3.5 py-1">
                    {so.items && so.items.length > 0 ? (
                      so.items.map((item) => (
                        <div
                          key={item.id}
                          className="py-2.5 first:pt-2 last:pb-2 flex items-center justify-between text-xs gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-10 h-10 bg-neutral-100 rounded-lg border border-neutral-200 overflow-hidden shrink-0">
                              {item.product_image ? (
                                <Image
                                  src={item.product_image}
                                  alt={item.product_name}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-400">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-neutral-900 truncate">
                                {item.product_name}
                              </p>
                              <p className="text-[11px] text-neutral-500 flex flex-wrap items-center gap-1.5 pt-0.5">
                                {item.selected_size && (
                                  <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700">
                                    Size: {item.selected_size}
                                  </span>
                                )}
                                {item.selected_color && (
                                  <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700">
                                    Color: {item.selected_color}
                                  </span>
                                )}
                                <span>Qty: <strong>{item.quantity}</strong></span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-neutral-900">
                              {Number(item.price).toLocaleString()} UZS
                            </div>
                            {item.quantity > 1 && (
                              <div className="text-[10px] text-neutral-400">
                                Total: {Number(item.subtotal).toLocaleString()} UZS
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-neutral-400 py-2 text-center">
                        No item details found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
