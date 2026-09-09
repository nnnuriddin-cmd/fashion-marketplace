import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getCurrentUser } from '@/lib/auth';
import { getUserById, getCustomerOrders, getStoreByOwnerId, UserRow, CustomerOrderDetails, StoreRow } from '@/lib/db';
import { Package, Store, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { TelegramConnectCard } from '@/components/account/TelegramConnectCard';

export const revalidate = 0;

export default async function CustomerAccountPage() {
  // 1. Retrieve the authenticated user strictly from Supabase Auth SSR session
  const authUser = await getCurrentUser();

  // 2. If unauthenticated, render the sign-in form
  if (!authUser) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-6">
        <LoginForm />

        <div className="inline-flex items-center gap-2 text-xs text-neutral-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>TrendMall Multi-Vendor Digital Fashion Marketplace</span>
        </div>
      </div>
    );
  }

  const customerId = authUser.id;

  // 3. For authenticated users, query profile and orders strictly by auth.uid()
  let user: UserRow | null = null;
  let orders: CustomerOrderDetails[] = [];
  let loadError: string | null = null;

  try {
    const [userRes, ordersRes] = await Promise.all([
      getUserById(customerId),
      getCustomerOrders(customerId),
    ]);
    user = userRes;
    orders = ordersRes;
  } catch (error) {
    console.error(`Failed to load customer account [${customerId}] from Supabase:`, error);
    loadError = error instanceof Error ? error.message : String(error);
  }

  // If user is a seller, load their store details for Telegram connection card
  let store: StoreRow | null = null;
  if (user?.role === 'SELLER') {
    try {
      store = await getStoreByOwnerId(customerId);
    } catch {
      // Store lookup failed or absent
    }
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="bg-rose-100 text-rose-800 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-serif font-bold text-neutral-900">Database Connection Error</h1>
        <p className="text-sm text-neutral-600 max-w-md mx-auto">
          Unable to fetch your account and order history from Supabase. Details: {loadError}
        </p>
        <Link
          href="/"
          className="inline-block bg-neutral-900 text-white text-xs font-semibold px-6 py-3 rounded-xl hover:bg-neutral-800"
        >
          Return to Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* User Header Profile Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-neutral-900 text-white font-bold flex items-center justify-center text-2xl">
            {user?.full_name?.charAt(0) || authUser.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-bold text-neutral-900">
                {user?.full_name || 'Authenticated User'}
              </h1>
              {user?.role && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                  {user.role}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 flex flex-wrap items-center gap-2">
              <span className="font-medium text-neutral-700">{authUser.email}</span>
              {user?.phone && <span>• {user.phone}</span>}
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified Auth Session</span>
              </span>
            </p>
            <p className="text-[10px] font-mono text-neutral-400">
              User UUID: {authUser.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <div className="bg-neutral-50 px-4 py-2 rounded-xl text-xs text-neutral-600 border border-neutral-200">
            Orders: <strong>{orders.length}</strong>
          </div>
          <SignOutButton />
        </div>
      </div>

      {/* Seller Telegram Bot Connection Card */}
      {user?.role === 'SELLER' && (
        <TelegramConnectCard
          isLinked={!!user?.telegram_id}
          storeName={store?.name}
          telegramUsername={store?.telegram_username}
        />
      )}

      {/* Orders History List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif font-bold text-neutral-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-800" />
            <span>Order History & Tracking</span>
          </h2>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-3">
            <Package className="w-10 h-10 text-neutral-300 mx-auto" />
            <h3 className="text-base font-bold text-neutral-900">No orders placed yet</h3>
            <p className="text-xs text-neutral-500">Explore marketplace products to place your first order.</p>
            <Link
              href="/search"
              className="inline-block text-xs bg-neutral-900 text-white font-semibold px-4 py-2 rounded-lg"
            >
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm space-y-4 p-6"
              >
                {/* Parent Order Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-4">
                  <div>
                    <div className="text-sm font-bold text-neutral-900 font-mono">
                      Parent Order #{order.order_number}
                    </div>
                    <div className="text-xs text-neutral-500">
                      Placed on{' '}
                      {new Date(order.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-bold text-neutral-900">
                      {Number(order.total_amount).toLocaleString()} UZS
                    </span>
                    <span className="bg-neutral-100 text-neutral-700 font-semibold px-2.5 py-0.5 rounded-md uppercase text-[10px]">
                      {order.payment_method}
                    </span>
                  </div>
                </div>

                {/* Seller Sub-Orders Cards */}
                <div className="space-y-4">
                  {order.seller_orders.map((so) => (
                    <div
                      key={so.id}
                      className="bg-neutral-50 p-4 rounded-xl border border-neutral-200/80 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <Link
                          href={`/store/${so.store_slug || ''}`}
                          className="font-bold text-neutral-900 hover:text-amber-800 flex items-center gap-1.5"
                        >
                          <Store className="w-4 h-4 text-amber-700" />
                          <span>{so.store_name || 'Vendor Boutique'}</span>
                          <span className="font-mono text-neutral-400 font-normal">
                            ({so.sub_order_number})
                          </span>
                        </Link>

                        {/* Status Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                            so.status === 'CONFIRMED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : so.status === 'PREPARING'
                              ? 'bg-amber-100 text-amber-800'
                              : so.status === 'OUT_FOR_DELIVERY'
                              ? 'bg-sky-100 text-sky-800'
                              : so.status === 'DELIVERED'
                              ? 'bg-emerald-600 text-white'
                              : so.status === 'CANCELLED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-neutral-200 text-neutral-800'
                          }`}
                        >
                          {so.status}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="divide-y divide-neutral-200/60 pt-1">
                        {so.items.map((item) => (
                          <div
                            key={item.id}
                            className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12 bg-white rounded-lg border border-neutral-200 overflow-hidden shrink-0">
                                {item.product_image ? (
                                  <Image
                                    src={item.product_image}
                                    alt={item.product_name}
                                    fill
                                    className="object-contain p-0.5"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-400">
                                    No Image
                                  </div>
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-neutral-900">{item.product_name}</div>
                                <div className="text-[11px] text-neutral-500">
                                  Size: {item.selected_size || 'N/A'}{' '}
                                  {item.selected_color ? `| Color: ${item.selected_color}` : ''} | Qty:{' '}
                                  {item.quantity}
                                </div>
                              </div>
                            </div>
                            <div className="font-bold text-neutral-900">
                              {Number(item.subtotal).toLocaleString()} UZS
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
