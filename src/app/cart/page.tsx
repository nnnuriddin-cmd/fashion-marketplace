'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/lib/cart-context';
import { ShoppingBag, Trash2, Store, ArrowRight, ShieldCheck, Plus, Minus } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/translations';

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, getGroupedItemsByStore, getTotalAmount, clearCart } = useCart();
  const { t } = useTranslation();
  const grouped = getGroupedItemsByStore();
  const grandTotal = getTotalAmount();

  if (cart.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="bg-neutral-100 p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center text-neutral-400">
          <ShoppingBag className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-serif font-bold text-neutral-900">{t('cart.emptyTitle')}</h2>
        <p className="text-xs text-neutral-500 max-w-sm mx-auto">
          {t('cart.emptySubtitle')}
        </p>
        <Link
          href="/search"
          className="inline-block bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs px-6 py-3 rounded-full uppercase tracking-wider transition-all"
        >
          {t('cart.startShopping')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900">{t('cart.title')}</h1>
          <p className="text-xs text-neutral-500">{t('cart.subtitle')}</p>
        </div>

        <button
          onClick={clearCart}
          className="text-xs text-rose-600 hover:underline font-semibold"
        >
          {t('cart.clear')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Store Grouped Items (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {Object.entries(grouped).map(([storeId, group]) => (
            <div key={storeId} className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
              {/* Store Header Banner */}
              <div className="bg-neutral-900 text-white px-5 py-3 flex items-center justify-between">
                <Link href={`/store/${group.storeSlug}`} className="flex items-center gap-2 font-bold text-sm hover:text-amber-300 transition-colors">
                  <Store className="w-4 h-4 text-amber-400" />
                  <span>{group.storeName}</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </Link>
                <span className="text-xs text-neutral-300 font-semibold">
                  {t('cart.subtotal')}: {group.subtotal.toLocaleString()} {t('common.uzs')}
                </span>
              </div>

              {/* Items List */}
              <div className="divide-y divide-neutral-100 p-4 sm:p-5">
                {group.items.map((item) => (
                  <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <Link href={`/product/${item.slug}`} className="relative w-20 h-20 bg-[#F8F8F8] rounded-xl overflow-hidden shrink-0 border border-neutral-200">
                        <Image src={item.image} alt={item.name} fill className="object-contain p-1" unoptimized />
                      </Link>

                      <div className="space-y-1">
                        <Link href={`/product/${item.slug}`} className="text-sm font-semibold text-neutral-900 hover:text-amber-800 line-clamp-1">
                          {item.name}
                        </Link>
                        <div className="text-xs text-neutral-500 space-x-3">
                          <span>{t('cart.size')} <strong>{item.selectedSize}</strong></span>
                          <span>{t('cart.color')} <strong>{item.selectedColor}</strong></span>
                        </div>
                        <div className="text-xs font-bold text-neutral-900">
                          {item.price.toLocaleString()} {t('common.uzs')}
                        </div>
                      </div>
                    </div>

                    {/* Quantity & Delete Controls */}
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-100">
                      <div className="flex items-center border border-neutral-200 rounded-lg bg-neutral-50">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:bg-neutral-200 rounded-l-lg"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:bg-neutral-200 rounded-r-lg"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-sm font-bold text-neutral-900 sm:w-28 text-right">
                        {(item.price * item.quantity).toLocaleString()} {t('common.uzs')}
                      </span>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-neutral-400 hover:text-rose-600 p-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right Summary Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4 sticky top-20">
            <h3 className="text-lg font-serif font-bold text-neutral-900 border-b border-neutral-100 pb-3">
              {t('cart.summaryTitle')}
            </h3>

            <div className="space-y-2 text-xs text-neutral-600">
              <div className="flex justify-between">
                <span>{t('nav.stores')}:</span>
                <span className="font-semibold text-neutral-900">{Object.keys(grouped).length}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('cart.subtotal')}:</span>
                <span className="font-semibold text-neutral-900">{grandTotal.toLocaleString()} {t('common.uzs')}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('cart.delivery')}:</span>
                <span className="font-semibold text-emerald-700">{t('cart.deliveryFree')}</span>
              </div>
            </div>

            <hr className="border-neutral-100" />

            <div className="flex justify-between items-baseline">
              <span className="text-sm font-bold text-neutral-900">{t('cart.grandTotal')}:</span>
              <span className="text-xl font-bold text-neutral-900">{grandTotal.toLocaleString()} {t('common.uzs')}</span>
            </div>

            <Link
              href="/checkout"
              className="block text-center w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-3.5 rounded-xl uppercase text-xs tracking-wider transition-all shadow-md"
            >
              {t('cart.proceedCheckout')} →
            </Link>

            <p className="text-[11px] text-neutral-400 text-center">
              {t('cart.guaranteeDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
