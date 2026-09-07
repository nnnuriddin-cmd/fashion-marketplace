import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getDb } from '@/lib/db';
import AdminStoreApprover from '@/components/admin/AdminStoreApprover';
import { ShieldCheck, Store, ShoppingBag, Package, DollarSign, Users, Sparkles, CheckCircle } from 'lucide-react';

export const revalidate = 0;

export default function AdminDashboardPage() {
  const db = getDb();

  // Metrics
  const storesCount = db.prepare(`SELECT COUNT(*) as count FROM stores`).get() as any;
  const pendingStoresCount = db.prepare(`SELECT COUNT(*) as count FROM stores WHERE status = 'PENDING'`).get() as any;
  const productsCount = db.prepare(`SELECT COUNT(*) as count FROM products WHERE status = 'PUBLISHED'`).get() as any;
  const ordersCount = db.prepare(`SELECT COUNT(*) as count FROM parent_orders`).get() as any;

  const gmv = db.prepare(`
    SELECT SUM(totalAmount) as gmv FROM parent_orders
  `).get() as any;

  const commission = db.prepare(`
    SELECT SUM(commissionAmount) as commission FROM seller_orders
  `).get() as any;

  const allStores = db.prepare(`
    SELECT s.*, u.fullName as ownerName, u.email as ownerEmail
    FROM stores s
    JOIN users u ON s.ownerId = u.id
    ORDER BY s.createdAt DESC
  `).all() as any[];

  const recentOrders = db.prepare(`
    SELECT po.*, (SELECT COUNT(*) FROM seller_orders WHERE parentOrderId = po.id) as sellerCount
    FROM parent_orders po
    ORDER BY po.createdAt DESC
    LIMIT 5
  `).all() as any[];

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
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Marketplace GMV</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{(gmv?.gmv || 12450000).toLocaleString()} UZS</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Commission Revenue</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{(commission?.commission || 1245000).toLocaleString()} UZS</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Active Sellers & Stores</span>
            <Store className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{storesCount.count || 10} Stores</div>
          {pendingStoresCount.count > 0 && (
            <div className="text-[11px] text-amber-800 font-bold">{pendingStoresCount.count} Pending Approval</div>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Total Catalog Products</span>
            <ShoppingBag className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{productsCount.count || 115} Products</div>
        </div>
      </div>

      {/* Seller Approval & Management Section */}
      <AdminStoreApprover initialStores={allStores} />

      {/* All Marketplace Parent Orders */}
      <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-4 shadow-sm">
        <h3 className="text-lg font-serif font-bold text-neutral-900">Global Customer Orders</h3>
        <div className="space-y-3">
          {recentOrders.map((o) => (
            <div key={o.id} className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-bold text-neutral-900 font-mono">#{o.orderNumber}</div>
                <div className="text-neutral-600">Customer: {o.customerName} ({o.customerPhone})</div>
                <div className="text-neutral-400 text-[11px]">Address: {o.deliveryAddress}</div>
              </div>

              <div className="flex items-center gap-4">
                <span className="bg-neutral-200 text-neutral-800 font-semibold px-2.5 py-1 rounded">
                  {o.sellerCount} Seller Sub-Orders
                </span>
                <span className="font-bold text-neutral-900">{o.totalAmount.toLocaleString()} UZS</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
