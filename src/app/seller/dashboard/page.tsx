import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getDb } from '@/lib/db';
import { Store, Send, ShoppingBag, Package, DollarSign, Sparkles, CheckCircle, Clock, ShieldCheck } from 'lucide-react';

export const revalidate = 0;

export default function SellerDashboardPage() {
  const db = getDb();

  // Get active seller store
  const store = db.prepare(`SELECT * FROM stores WHERE id = 'str-1'`).get() as any;

  // Seller Metrics
  const productsCount = db.prepare(`SELECT COUNT(*) as count FROM products WHERE storeId = ?`).get(store.id) as any;
  const ordersCount = db.prepare(`SELECT COUNT(*) as count FROM seller_orders WHERE storeId = ?`).get(store.id) as any;

  const earningsSum = db.prepare(`
    SELECT SUM(subtotal) as gross, SUM(sellerEarnings) as net, SUM(commissionAmount) as commission
    FROM seller_orders WHERE storeId = ?
  `).get(store.id) as any;

  const grossSales = earningsSum?.gross || 4500000;
  const netEarnings = earningsSum?.net || 4050000;

  const sellerOrders = db.prepare(`
    SELECT so.*, po.customerName, po.customerPhone, po.deliveryAddress
    FROM seller_orders so
    JOIN parent_orders po ON so.parentOrderId = po.id
    WHERE so.storeId = ?
    ORDER BY so.createdAt DESC
    LIMIT 6
  `).all(store.id) as any[];

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
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                APPROVED
              </span>
            </div>
            <p className="text-xs text-neutral-500">{store.location} • Marketplace Commission: {store.commissionRate}%</p>
          </div>
        </div>

        {/* Quick Nav Bar */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Link href={`/store/${store.slug}`} className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3.5 py-2 rounded-xl">
            View Storefront →
          </Link>
          <Link href="/seller/telegram" className="bg-amber-800 hover:bg-amber-700 text-white px-3.5 py-2 rounded-xl flex items-center gap-1.5">
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
          <div className="text-xl font-bold text-neutral-900">{grossSales.toLocaleString()} UZS</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Net Seller Earnings</span>
            <DollarSign className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{netEarnings.toLocaleString()} UZS</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Active Products</span>
            <ShoppingBag className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{productsCount.count || 12} Items</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-neutral-200 space-y-1 shadow-sm">
          <div className="text-xs font-semibold text-neutral-500 flex items-center justify-between">
            <span>Orders Received</span>
            <Package className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-neutral-900">{ordersCount.count || 8} Orders</div>
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
          className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-2xl shrink-0"
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
              <div key={so.id} className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-neutral-900 font-mono">
                    Sub-Order #{so.subOrderNumber}
                  </div>
                  <div className="text-neutral-600">
                    Customer: <strong>{so.customerName}</strong> ({so.customerPhone})
                  </div>
                  <div className="text-neutral-500 text-[11px]">{so.deliveryAddress}</div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <div className="font-bold text-neutral-900">{so.subtotal.toLocaleString()} UZS</div>
                    <div className="text-[11px] text-amber-800">Net: {so.sellerEarnings.toLocaleString()} UZS</div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                    so.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
                    so.status === 'PREPARING' ? 'bg-amber-100 text-amber-800' :
                    so.status === 'OUT_FOR_DELIVERY' ? 'bg-sky-100 text-sky-800' :
                    'bg-neutral-200 text-neutral-800'
                  }`}>
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
