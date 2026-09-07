import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getDb } from '@/lib/db';
import { User, Package, Clock, CheckCircle, Store, Truck, AlertCircle } from 'lucide-react';

export const revalidate = 0;

export default function CustomerAccountPage() {
  const db = getDb();
  const customerId = 'usr-customer-1';

  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(customerId) as any;

  const parentOrders = db.prepare(`
    SELECT * FROM parent_orders WHERE customerId = ? ORDER BY createdAt DESC
  `).all(customerId) as any[];

  // Fetch all seller sub-orders and items
  const ordersWithDetails = parentOrders.map((po) => {
    const sellerOrders = db.prepare(`
      SELECT so.*, s.name as storeName, s.slug as storeSlug, s.logo as storeLogo
      FROM seller_orders so
      JOIN stores s ON so.storeId = s.id
      WHERE so.parentOrderId = ?
    `).all(po.id) as any[];

    const sellerOrdersWithItems = sellerOrders.map((so) => {
      const items = db.prepare(`SELECT * FROM order_items WHERE sellerOrderId = ?`).all(so.id) as any[];
      return { ...so, items };
    });

    return { ...po, sellerOrders: sellerOrdersWithItems };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* User Header Profile Card */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-neutral-900 text-white font-bold flex items-center justify-center text-2xl">
            {user?.fullName?.charAt(0) || 'A'}
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-neutral-900">{user?.fullName || 'Customer Profile'}</h1>
            <p className="text-xs text-neutral-500">{user?.email} • {user?.phone}</p>
          </div>
        </div>

        <div className="bg-neutral-50 px-4 py-2 rounded-xl text-xs text-neutral-600 border border-neutral-200">
          Total Orders Placed: <strong>{parentOrders.length}</strong>
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

        {ordersWithDetails.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-3">
            <Package className="w-10 h-10 text-neutral-300 mx-auto" />
            <h3 className="text-base font-bold text-neutral-900">No orders placed yet</h3>
            <p className="text-xs text-neutral-500">Explore marketplace products to place your first order.</p>
            <Link href="/search" className="inline-block text-xs bg-neutral-900 text-white font-semibold px-4 py-2 rounded-lg">
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {ordersWithDetails.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm space-y-4 p-6">
                {/* Parent Order Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-4">
                  <div>
                    <div className="text-sm font-bold text-neutral-900 font-mono">
                      Parent Order #{order.orderNumber}
                    </div>
                    <div className="text-xs text-neutral-500">
                      Placed on {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-bold text-neutral-900">{order.totalAmount.toLocaleString()} UZS</span>
                    <span className="bg-neutral-100 text-neutral-700 font-semibold px-2.5 py-0.5 rounded-md uppercase text-[10px]">
                      {order.paymentMethod}
                    </span>
                  </div>
                </div>

                {/* Seller Sub-Orders Cards */}
                <div className="space-y-4">
                  {order.sellerOrders.map((so: any) => (
                    <div key={so.id} className="bg-neutral-50 p-4 rounded-xl border border-neutral-200/80 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <Link href={`/store/${so.storeSlug}`} className="font-bold text-neutral-900 hover:text-amber-800 flex items-center gap-1.5">
                          <Store className="w-4 h-4 text-amber-700" />
                          <span>{so.storeName}</span>
                          <span className="font-mono text-neutral-400 font-normal">({so.subOrderNumber})</span>
                        </Link>

                        {/* Status Badge */}
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${
                          so.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' :
                          so.status === 'PREPARING' ? 'bg-amber-100 text-amber-800' :
                          so.status === 'OUT_FOR_DELIVERY' ? 'bg-sky-100 text-sky-800' :
                          so.status === 'DELIVERED' ? 'bg-emerald-600 text-white' :
                          so.status === 'CANCELLED' ? 'bg-rose-100 text-rose-800' :
                          'bg-neutral-200 text-neutral-800'
                        }`}>
                          {so.status}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="divide-y divide-neutral-200/60 pt-1">
                        {so.items.map((item: any) => (
                          <div key={item.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <div className="relative w-12 h-12 bg-white rounded-lg border border-neutral-200 overflow-hidden shrink-0">
                                <Image src={item.productImage} alt={item.productName} fill className="object-contain p-0.5" unoptimized />
                              </div>
                              <div>
                                <div className="font-semibold text-neutral-900">{item.productName}</div>
                                <div className="text-[11px] text-neutral-500">Size: {item.selectedSize} | Qty: {item.quantity}</div>
                              </div>
                            </div>
                            <div className="font-bold text-neutral-900">{item.subtotal.toLocaleString()} UZS</div>
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
