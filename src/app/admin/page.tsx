import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import {
  getAdminPlatformMetrics,
  getAdminStoresList,
  AdminPlatformMetrics,
  AdminStoreListItem,
} from '@/lib/db';
import AdminStoreApprover from '@/components/admin/AdminStoreApprover';
import { ShieldCheck, Store, ShoppingBag, Package, DollarSign, Users, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

export const revalidate = 0;

export default async function AdminDashboardPage() {
  // 1. In the current architecture, full Admin RBAC / auth session protection is not yet finalized.
  // There is currently NO Admin role verification middleware or backend check.
  // Checking supabase.auth.getUser() only checks for the presence of a Supabase Auth session, NOT admin privileges.
  let authNotice: string | null = null;
  try {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr && !authErr.message.includes('missing') && !authErr.message.includes('Auth session missing')) {
      authNotice = authErr.message;
    }
  } catch (err) {
    authNotice = err instanceof Error ? err.message : String(err);
  }

  // 2. Fetch admin metrics and stores strictly via existing DB layer functions.
  // We do NOT substitute fake zeros if data loading fails.
  let metrics: AdminPlatformMetrics | null = null;
  let allStores: AdminStoreListItem[] = [];
  let loadError: string | null = null;

  try {
    const [platformMetrics, storesList] = await Promise.all([
      getAdminPlatformMetrics(),
      getAdminStoresList(),
    ]);

    metrics = platformMetrics;
    allStores = storesList;
  } catch (err) {
    console.error('Failed to load admin dashboard data from Supabase DB layer:', err);
    loadError = err instanceof Error ? err.message : String(err);
  }

  // If loading platform metrics completely failed, render an explicit error state
  // rather than displaying deceptive zeroed-out numbers.
  if (loadError || !metrics) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 max-w-xl mx-auto text-center space-y-4">
          <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-rose-900">Failed to Load Admin Dashboard</h2>
          <p className="text-xs text-rose-700 leading-relaxed">
            An error occurred while fetching platform metrics and store data through the database layer:
          </p>
          <div className="bg-white p-3 rounded-xl border border-rose-200 text-left font-mono text-[11px] text-rose-800 break-all">
            {loadError || 'Unable to retrieve metrics from database layer.'}
          </div>
          <div className="pt-2">
            <Link
              href="/admin"
              className="inline-block bg-neutral-900 text-white text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-neutral-800"
            >
              Retry
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Map stores into the property shape expected by AdminStoreApprover client component
  const initialStoresForApprover = allStores.map((s) => ({
    ...s,
    ownerName: s.owner_name || 'Unknown',
    ownerEmail: s.owner_email || 'No email',
    commissionRate: s.commission_rate,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Header */}
      <div className="bg-neutral-900 text-white p-8 rounded-3xl space-y-3 relative overflow-hidden shadow-lg">
        <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Marketplace Master Control Panel</span>
        </div>

        <h1 className="text-3xl font-serif font-bold tracking-tight">TrendMall Admin Control</h1>

        <p className="text-xs text-neutral-300 max-w-xl leading-relaxed">
          Manage seller approvals, product moderation, commission parameters, parent/child orders, and marketplace analytics.
        </p>

        {authNotice && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs px-3 py-2 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Auth Notice: {authNotice}</span>
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Marketplace GMV</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{metrics.gmv.toLocaleString()} UZS</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Commission Revenue</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{metrics.totalCommission.toLocaleString()} UZS</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Active Sellers & Stores</span>
            <Store className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{metrics.storesCount} Stores</div>
          {metrics.pendingStoresCount > 0 && (
            <div className="text-[11px] text-amber-800 font-bold">{metrics.pendingStoresCount} Pending Approval</div>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Total Catalog Products</span>
            <ShoppingBag className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{metrics.productsCount} Products</div>
        </div>
      </div>

      {/* Seller Approval & Management Section */}
      <AdminStoreApprover initialStores={initialStoresForApprover} />

      {/* All Marketplace Parent Orders */}
      {/* 
        NOTE: In the current DB layer (src/lib/db/queries.ts), there is NO query function 
        for fetching global recent parent_orders for the Admin Dashboard.
        Per strict constraints, direct Supabase calls (supabase.from) are not allowed in pages,
        and modifying queries.ts is not permitted in this step.
        This block displays a clear architectural status notice until an admin order query function is added.
      */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <h3 className="text-lg font-serif font-bold text-neutral-900">Global Customer Orders</h3>
          <span className="text-[11px] text-neutral-400 font-mono">DB Layer Integration Pending</span>
        </div>
        <div className="text-center py-8 px-4 text-neutral-500 text-xs bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 space-y-2">
          <p className="font-semibold text-neutral-700">Admin order listing function is not yet present in src/lib/db/queries.ts.</p>
          <p className="text-neutral-500 max-w-md mx-auto">
            Direct database queries from UI pages are forbidden to maintain clean architectural separation.
            A dedicated query function (e.g. <code>getAdminRecentOrders()</code>) will be added to the DB layer in an authorized step.
          </p>
        </div>
      </div>
    </div>
  );
}


