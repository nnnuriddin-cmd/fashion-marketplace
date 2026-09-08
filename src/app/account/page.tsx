import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { getUserById, getCustomerOrders, UserRow, CustomerOrderDetails } from '@/lib/db';
import { Package, Store, AlertCircle, User, LogIn, Sparkles } from 'lucide-react';

export const revalidate = 0;

export default async function CustomerAccountPage() {
  // 1. Retrieve the authenticated user strictly from Supabase Auth
  // We do NOT use searchParams, hardcoded IDs, or demo fallbacks ('usr-customer-1').
  let customerId: string | null = null;
  let authError: string | null = null;

  try {
    const { data: authData, error: sessionErr } = await supabase.auth.getUser();
    if (sessionErr) {
      // If error is not a simple 'missing token/session', record it
      if (sessionErr.message && !sessionErr.message.includes('missing') && !sessionErr.message.includes('Auth session missing')) {
        authError = sessionErr.message;
      }
    } else if (authData?.user?.id) {
      customerId = authData.user.id;
    }
  } catch (err) {
    console.error('Error verifying Supabase Auth user session:', err);
    authError = err instanceof Error ? err.message : String(err);
  }

  // 2. If the user is not authenticated, render an explicit "Sign In Required" state
  // rather than substituting an arbitrary or hardcoded customerId.
  if (!customerId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="bg-amber-50 text-amber-900 border border-amber-200 p-5 rounded-3xl max-w-md mx-auto space-y-3">
          <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <User className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-neutral-900">Sign In to Your Account</h1>
          <p className="text-xs text-neutral-600 leading-relaxed">
            Authentication is required to view your profile and tracking details.
            In order to securely protect your order history, personal accounts are accessible only via verified Supabase Auth.
          </p>

          {authError && (
            <div className="bg-rose-50 text-rose-700 text-[11px] p-2 rounded-lg border border-rose-200">
              Auth notice: {authError}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold px-6 py-2.5 rounded-xl transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Sign Up</span>
            </Link>
            <Link
              href="/search"
              className="w-full sm:w-auto bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold px-6 py-2.5 rounded-xl transition-colors"
            >
              Browse Catalog
            </Link>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 text-xs text-neutral-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span>Multi-Vendor Digital Fashion Mall</span>
        </div>
      </div>
    );
  }

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
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-neutral-900 text-white font-bold flex items-center justify-center text-2xl">
            {user?.full_name?.charAt(0) || 'C'}
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-neutral-900">
              {user?.full_name || 'Customer Profile'}
            </h1>
            <p className="text-xs text-neutral-500">
              {user?.email || 'No email registered'} {user?.phone ? `• ${user.phone}` : ''}
            </p>
          </div>
        </div>

        <div className="bg-neutral-50 px-4 py-2 rounded-xl text-xs text-neutral-600 border border-neutral-200">
          Total Orders Placed: <strong>{orders.length}</strong>
        </div>
      </div>

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
