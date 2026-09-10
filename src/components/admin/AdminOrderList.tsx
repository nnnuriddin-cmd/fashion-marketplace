'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Package,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
  Store,
  User,
  Phone,
  MapPin,
  Clock,
  Search,
  Filter,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { AdminOrderDetails, OrderStatus } from '@/lib/db';

interface AdminOrderListProps {
  initialOrders: AdminOrderDetails[];
  totalCount: number;
}

export default function AdminOrderList({
  initialOrders,
  totalCount,
}: AdminOrderListProps) {
  const [orders] = useState<AdminOrderDetails[]>(initialOrders);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const toggleExpand = (orderId: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedOrderIds(new Set(filteredOrders.map((o) => o.id)));
  };

  const collapseAll = () => {
    setExpandedOrderIds(new Set());
  };

  // Filter orders by search and status
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        order.orderNumber.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.customerPhone.toLowerCase().includes(query) ||
        (order.customerEmail && order.customerEmail.toLowerCase().includes(query)) ||
        order.sellerOrders.some(
          (so) =>
            so.storeName.toLowerCase().includes(query) ||
            so.subOrderNumber.toLowerCase().includes(query)
        );

      let matchesStatus = true;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PAID' || statusFilter === 'PENDING') {
          matchesStatus = order.paymentStatus === statusFilter;
        } else {
          matchesStatus = order.sellerOrders.some((so) => so.status === statusFilter);
        }
      }

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const getStatusBadge = (status: OrderStatus | string) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'OUT_FOR_DELIVERY':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'PREPARING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'CONFIRMED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'NEW':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-neutral-50 text-neutral-700 border-neutral-200';
    }
  };

  const getPaymentBadge = (status: string | null) => {
    if (status === 'PAID') {
      return 'bg-emerald-100 text-emerald-800';
    }
    if (status === 'PENDING') {
      return 'bg-amber-100 text-amber-800';
    }
    return 'bg-neutral-100 text-neutral-800';
  };

  const formatDate = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-6 shadow-sm">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
        <div>
          <h3 className="text-lg font-serif font-bold text-neutral-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-neutral-900" />
            <span>Global Marketplace Orders</span>
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Full platform order audit across all vendors and customers. Read-only control panel.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-neutral-700 bg-neutral-100 px-3 py-1.5 rounded-xl border border-neutral-200">
            Total Orders: {totalCount}
          </span>
          {filteredOrders.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={expandAll}
                className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900 px-2.5 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors"
              >
                Collapse All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Order #, customer name, phone, or store..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10 transition-all placeholder:text-neutral-400 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-neutral-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 text-xs font-medium text-neutral-700 focus:outline-none focus:bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">Sub-Order: New</option>
            <option value="CONFIRMED">Sub-Order: Confirmed</option>
            <option value="PREPARING">Sub-Order: Preparing</option>
            <option value="OUT_FOR_DELIVERY">Sub-Order: Out for Delivery</option>
            <option value="DELIVERED">Sub-Order: Delivered</option>
            <option value="CANCELLED">Sub-Order: Cancelled</option>
            <option value="PAID">Payment: Paid</option>
            <option value="PENDING">Payment: Pending</option>
          </select>
        </div>
      </div>

      {/* Order List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 space-y-2">
          <AlertCircle className="w-8 h-8 text-neutral-400 mx-auto" />
          <p className="font-semibold text-neutral-700 text-sm">No orders match your criteria</p>
          <p className="text-neutral-500 text-xs max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or status filter.'
              : 'No customer orders have been recorded in the platform database yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrderIds.has(order.id);

            return (
              <div
                key={order.id}
                className="bg-neutral-50/70 border border-neutral-200 rounded-2xl overflow-hidden transition-all duration-200 shadow-sm"
              >
                {/* Summary Row */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-4 sm:p-5 cursor-pointer hover:bg-neutral-100/60 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: Order # and Metadata */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-neutral-900 text-sm">
                        #{order.orderNumber}
                      </span>

                      {/* Payment Badge */}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getPaymentBadge(
                          order.paymentStatus
                        )}`}
                      >
                        {order.paymentStatus || 'PENDING'}
                      </span>

                      {/* Stores Count Badge */}
                      <span className="inline-flex items-center gap-1 bg-neutral-200/80 text-neutral-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        <Store className="w-3 h-3" />
                        <span>
                          {order.sellerOrdersCount} {order.sellerOrdersCount === 1 ? 'Store' : 'Stores'}
                        </span>
                      </span>

                      {/* Items Count Badge */}
                      <span className="inline-flex items-center gap-1 bg-neutral-200/80 text-neutral-700 px-2 py-0.5 rounded text-[11px] font-medium">
                        <ShoppingBag className="w-3 h-3" />
                        <span>
                          {order.totalItemsCount} {order.totalItemsCount === 1 ? 'item' : 'items'}
                        </span>
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-600 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-neutral-400" />
                        <strong className="text-neutral-800">{order.customerName}</strong>
                      </span>
                      {order.customerPhone && (
                        <span className="flex items-center gap-1 text-neutral-500">
                          <Phone className="w-3 h-3 text-neutral-400" />
                          {order.customerPhone}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-neutral-400 text-[11px]">
                        <Clock className="w-3 h-3" />
                        {formatDate(order.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Right: Sub-orders Statuses, Amount & Toggle */}
                  <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-neutral-200/60">
                    {/* Sub-order status pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {order.sellerOrders.map((so) => (
                        <span
                          key={so.id}
                          className={`border px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${getStatusBadge(
                            so.status
                          )}`}
                          title={`${so.storeName}: ${so.status}`}
                        >
                          {so.status}
                        </span>
                      ))}
                    </div>

                    {/* Total Amount */}
                    <div className="text-right">
                      <div className="text-sm font-bold text-neutral-900">
                        {order.totalAmount.toLocaleString()} UZS
                      </div>
                      <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">
                        {order.paymentMethod || 'CASH'}
                      </div>
                    </div>

                    {/* Details Action */}
                    <button
                      type="button"
                      aria-label={isExpanded ? 'Hide Details' : 'View Details'}
                      className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Panel */}
                {isExpanded && (
                  <div className="border-t border-neutral-200/80 bg-white p-5 space-y-6">
                    {/* Customer & Delivery Information Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-neutral-50 p-4 rounded-xl border border-neutral-200/70 text-xs">
                      <div className="space-y-1">
                        <span className="text-neutral-400 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                          <User className="w-3 h-3" /> Customer Profile
                        </span>
                        <div className="font-bold text-neutral-900">{order.customerName}</div>
                        {order.customerEmail && (
                          <div className="text-neutral-600 font-mono text-[11px]">{order.customerEmail}</div>
                        )}
                        {order.customerPhone && (
                          <div className="text-neutral-600 font-mono text-[11px]">{order.customerPhone}</div>
                        )}
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <span className="text-neutral-400 font-medium uppercase text-[10px] tracking-wider flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Delivery Destination & Logistics
                        </span>
                        <div className="text-neutral-800 leading-relaxed font-medium">
                          {order.deliveryAddress || 'Address not specified'}
                        </div>
                        <div className="text-[11px] text-neutral-500 pt-0.5">
                          Method: <strong>{order.deliveryMethod || 'STANDARD'}</strong>
                          {order.orderNotes && (
                            <span className="block italic text-neutral-600 mt-0.5">
                              Note: "{order.orderNotes}"
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Seller Sub-Orders Breakdown */}
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4 text-neutral-500" />
                        <span>Store Sub-Orders ({order.sellerOrders.length})</span>
                      </div>

                      <div className="space-y-4">
                        {order.sellerOrders.map((so) => (
                          <div
                            key={so.id}
                            className="border border-neutral-200 rounded-xl p-4 bg-neutral-50/50 space-y-4"
                          >
                            {/* Sub-order Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200/70">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <Store className="w-4 h-4 text-neutral-600" />
                                  {so.storeSlug ? (
                                    <Link
                                      href={`/store/${so.storeSlug}`}
                                      className="font-bold text-neutral-900 text-sm hover:underline"
                                    >
                                      {so.storeName}
                                    </Link>
                                  ) : (
                                    <span className="font-bold text-neutral-900 text-sm">
                                      {so.storeName}
                                    </span>
                                  )}
                                  <span className="font-mono text-xs text-neutral-500">
                                    #{so.subOrderNumber}
                                  </span>
                                </div>
                                <div className="text-[11px] text-neutral-400">
                                  Placed: {formatDate(so.createdAt)}
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span
                                  className={`border px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusBadge(
                                    so.status
                                  )}`}
                                >
                                  {so.status}
                                </span>

                                <div className="text-right text-xs">
                                  <div className="font-bold text-neutral-900">
                                    {so.subtotal.toLocaleString()} UZS
                                  </div>
                                  <div className="text-[10px] text-neutral-500">
                                    Comm: {so.commissionAmount.toLocaleString()} UZS • Net: {so.sellerEarnings.toLocaleString()} UZS
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Sub-order Items List */}
                            <div className="space-y-2">
                              <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                                Purchased Items ({so.items.length})
                              </div>

                              <div className="divide-y divide-neutral-200/60 bg-white rounded-xl border border-neutral-200 px-3.5 py-1">
                                {so.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="py-2.5 first:pt-2 last:pb-2 flex items-center justify-between text-xs gap-3"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="relative w-10 h-10 bg-neutral-100 rounded-lg border border-neutral-200 overflow-hidden shrink-0">
                                        {item.productImage ? (
                                          <Image
                                            src={item.productImage}
                                            alt={item.productName}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-neutral-400">
                                            <ShoppingBag className="w-4 h-4" />
                                          </div>
                                        )}
                                      </div>

                                      <div className="min-w-0">
                                        <div className="font-semibold text-neutral-900 truncate">
                                          {item.productName}
                                        </div>
                                        <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                                          {item.selectedSize && (
                                            <span>Size: <strong className="text-neutral-700">{item.selectedSize}</strong></span>
                                          )}
                                          {item.selectedColor && (
                                            <span>Color: <strong className="text-neutral-700">{item.selectedColor}</strong></span>
                                          )}
                                          <span>Qty: <strong className="text-neutral-700">{item.quantity}</strong></span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                      <div className="font-bold text-neutral-900">
                                        {item.subtotal.toLocaleString()} UZS
                                      </div>
                                      <div className="text-[10px] text-neutral-400">
                                        {item.price.toLocaleString()} UZS ea.
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Sub-order Financial Footer */}
                            <div className="bg-neutral-100/70 p-3 rounded-xl flex items-center justify-between text-xs text-neutral-600 font-medium">
                              <span>Vendor Subtotal: <strong>{so.subtotal.toLocaleString()} UZS</strong></span>
                              <span>Platform Fee: <strong className="text-amber-800">{so.commissionAmount.toLocaleString()} UZS</strong></span>
                              <span>Vendor Payout: <strong className="text-emerald-800">{so.sellerEarnings.toLocaleString()} UZS</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
