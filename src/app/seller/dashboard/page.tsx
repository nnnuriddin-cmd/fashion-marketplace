import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  getStoreById,
  getAllApprovedStores,
  getSellerDashboardMetrics,
  getSellerOrders,
  StoreRow,
} from '@/lib/db';
import { Store, Send, ShoppingBag, Package, DollarSign, Sparkles, AlertCircle } from 'lucide-react';

export const revalidate = 0;

interface SellerDashboardPageProps {
  searchParams?: {
    storeId?: string;
  };
}

export default async function SellerDashboardPage({ searchParams }: SellerDashboardPageProps) {
  // Determine active store:
  // 1. Check explicit searchParams.storeId
  // 2. Fall back to the configured demo store 'str-1'
  // 3. If 'str-1' does not exist in the database, safely fall back to the first available approved store
  const requestedStoreId = searchParams?.storeId || 'str-1';

  let store: StoreRow | null = null;
  try {
    store = await getStoreById(requestedStoreId);

    // If default 'str-1' not found, fall back to the first existing approved store
    if (!store) {
      const approvedStores = await getAllApprovedStores();
      if (approvedStores.length > 0) {
        store = approvedStores[0];
      }
    }
  } catch (error) {
    console.error(`Failed to retrieve store [${requestedStoreId}]:`, error);
    throw new Error(`Failed to load store information: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Handle case where no store exists at all in the database
  if (!store) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="bg-amber-100 text-amber-800 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
          <Store className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-neutral-900">No Seller Store Found</h1>
        <p className="text-sm text-neutral-600">
          No merchant boutique is registered or approved yet. Please register a store to access the dashboard.
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

        <div className="space-y-3">
          {sellerOrders.length === 0 ? (
            <div className="text-center py-8 text-xs text-neutral-500">No recent orders yet.</div>
          ) : (
            sellerOrders.map((so) => (
              <div
                key={so.id}
                className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-neutral-900 font-mono">
                    Sub-Order #{so.sub_order_number}
                  </div>
                  <div className="text-neutral-600">
                    Customer: <strong>{so.customer_name}</strong> ({so.customer_phone})
                  </div>
                  <div className="text-neutral-500 text-[11px]">{so.delivery_address}</div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <div className="font-bold text-neutral-900">{Number(so.subtotal).toLocaleString()} UZS</div>
                    <div className="text-[11px] text-amber-800">
                      Net: {Number(so.seller_earnings).toLocaleString()} UZS
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                      so.status === 'CONFIRMED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : so.status === 'PREPARING'
                        ? 'bg-amber-100 text-amber-800'
                        : so.status === 'OUT_FOR_DELIVERY'
                        ? 'bg-sky-100 text-sky-800'
                        : so.status === 'DELIVERED'
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-neutral-200 text-neutral-800'
                    }`}
                  >
                    {so.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
