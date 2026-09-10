'use client';

import React, { useState, useTransition } from 'react';
import { OrderStatus } from '@/lib/db';
import { updateOrderStatusAction } from '@/app/actions/orders';
import { Check, Package, Truck, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface SellerOrderStatusControllerProps {
  sellerOrderId: string;
  currentStatus: OrderStatus;
}

export function SellerOrderStatusController({
  sellerOrderId,
  currentStatus,
}: SellerOrderStatusControllerProps) {
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleUpdate = (nextStatus: OrderStatus) => {
    setError(null);
    startTransition(async () => {
      const res = await updateOrderStatusAction(sellerOrderId, nextStatus);
      if (res.error) {
        setError(res.error);
      } else if (res.status) {
        setStatus(res.status);
      }
    });
  };

  const getStatusBadge = (s: OrderStatus) => {
    switch (s) {
      case 'NEW':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'CONFIRMED':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'PREPARING':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'OUT_FOR_DELIVERY':
        return 'bg-sky-100 text-sky-800 border border-sky-200';
      case 'DELIVERED':
        return 'bg-teal-700 text-white';
      case 'CANCELLED':
        return 'bg-rose-100 text-rose-800 border border-rose-200';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {/* Status Badge */}
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(
            status
          )}`}
        >
          {status}
        </span>

        {/* Action Controls based on valid status progressions */}
        {status === 'NEW' && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleUpdate('CONFIRMED')}
              className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              title="Confirm Order"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Confirm</span>
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this order?')) {
                  handleUpdate('CANCELLED');
                }
              }}
              className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 hover:bg-rose-50 text-neutral-600 hover:text-rose-600 rounded-lg text-xs font-medium border border-neutral-200 transition-colors"
              title="Reject / Cancel Order"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Decline</span>
            </button>
          </div>
        )}

        {status === 'CONFIRMED' && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleUpdate('PREPARING')}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-300 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
              title="Mark as Packing & Preparing"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Package className="w-3.5 h-3.5" />
              )}
              <span>Pack / Prepare</span>
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                if (window.confirm('Are you sure you want to cancel this confirmed order?')) {
                  handleUpdate('CANCELLED');
                }
              }}
              className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 hover:bg-rose-50 text-neutral-600 hover:text-rose-600 rounded-lg text-xs font-medium border border-neutral-200 transition-colors"
              title="Cancel Order"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          </div>
        )}

        {status === 'PREPARING' && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleUpdate('OUT_FOR_DELIVERY')}
            className="inline-flex items-center gap-1 px-3 py-1 bg-sky-600 hover:bg-sky-700 disabled:bg-neutral-300 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            title="Hand over to Courier"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Truck className="w-3.5 h-3.5" />
            )}
            <span>Out for Delivery</span>
          </button>
        )}

        {status === 'OUT_FOR_DELIVERY' && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleUpdate('DELIVERED')}
            className="inline-flex items-center gap-1 px-3 py-1 bg-teal-600 hover:bg-teal-700 disabled:bg-neutral-300 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            title="Mark Delivered"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle className="w-3.5 h-3.5" />
            )}
            <span>Mark Delivered</span>
          </button>
        )}

        {status === 'DELIVERED' && (
          <span className="text-[11px] text-teal-700 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        )}

        {status === 'CANCELLED' && (
          <span className="text-[11px] text-rose-700 font-semibold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        )}
      </div>

      {error && (
        <div className="text-[11px] text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
