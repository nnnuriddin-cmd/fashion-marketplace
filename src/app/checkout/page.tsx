'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { createClient } from '@/lib/supabase/client';
import { ShieldCheck, Truck, CreditCard, CheckCircle, Store, Send } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/translations';

export default function CheckoutPage() {
  const { cart, getGroupedItemsByStore, getTotalAmount, clearCart } = useCart();
  const { t } = useTranslation();
  const grouped = getGroupedItemsByStore();
  const grandTotal = getTotalAmount();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('STANDARD');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any>(null);

  useEffect(() => {
    async function loadCustomerProfile() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('full_name, phone')
            .eq('id', user.id)
            .maybeSingle();

          if (profile) {
            if (profile.full_name) setCustomerName(profile.full_name);
            if (profile.phone) setCustomerPhone(profile.phone);
          } else if (user.user_metadata) {
            if (user.user_metadata.full_name) setCustomerName(user.user_metadata.full_name);
            if (user.user_metadata.phone) setCustomerPhone(user.user_metadata.phone);
          }
        }
      } catch {
        // Unauthenticated or network error; keep empty for guest checkout
      }
    }

    loadCustomerProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          deliveryAddress,
          deliveryMethod,
          paymentMethod,
          orderNotes,
          cartItems: cart,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCompletedOrder(data);
        clearCart();
      } else {
        alert(data.error || 'Checkout failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (completedOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="bg-emerald-100 text-emerald-700 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
          <CheckCircle className="w-12 h-12" />
        </div>

        <h1 className="text-3xl font-serif font-bold text-neutral-900">{t('checkout.successTitle')}</h1>
        <p className="text-sm text-neutral-600">
          {t('checkout.orderNumber')}
        </p>

        <div className="bg-neutral-900 text-white p-4 rounded-2xl font-mono text-xl font-bold tracking-wider inline-block">
          #{completedOrder.parentOrderNumber}
        </div>

        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-left text-xs text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
            <Send className="w-4 h-4 text-amber-700" />
            <span>{t('footer.telegramIntegration')}</span>
          </div>
          <p>
            {t('checkout.successDesc')}
          </p>
        </div>

        <div className="pt-4 flex justify-center gap-4">
          <Link
            href="/account"
            className="bg-neutral-900 text-white font-semibold text-xs px-6 py-3 rounded-full hover:bg-neutral-800"
          >
            {t('checkout.viewAccount')} →
          </Link>
          <Link
            href="/"
            className="bg-neutral-100 text-neutral-800 font-semibold text-xs px-6 py-3 rounded-full hover:bg-neutral-200"
          >
            {t('account.returnHome')}
          </Link>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-neutral-900">{t('cart.emptyTitle')}</h2>
        <Link href="/search" className="inline-block bg-neutral-900 text-white text-xs font-semibold px-4 py-2 rounded-lg">
          {t('account.browseCatalog')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="border-b border-neutral-200 pb-4">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900">{t('checkout.title')}</h1>
        <p className="text-xs text-neutral-500">{t('checkout.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Form Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Customer Information Card */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <span className="bg-neutral-900 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center">1</span>
              <span>{t('checkout.customerDetails')}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">{t('checkout.fullName')}</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Jasur Aliyev"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">{t('checkout.phone')}</label>
                <input
                  type="text"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. +998 90 123 45 67"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">{t('checkout.address')}</label>
              <textarea
                rows={2}
                required
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder={t('checkout.addressPlaceholder')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>

          {/* Delivery & Payment Selection */}
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <span className="bg-neutral-900 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center">2</span>
              <span>{t('checkout.deliveryMethod')} & {t('checkout.paymentMethod')}</span>
            </h3>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-700">{t('checkout.deliveryMethod')}</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod('STANDARD')}
                  className={`p-3 rounded-xl border text-left text-xs space-y-1 transition-all ${
                    deliveryMethod === 'STANDARD' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-neutral-50 text-neutral-800'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <Truck className="w-4 h-4" />
                    <span>{t('checkout.deliveryStandard')}</span>
                  </div>
                  <p className="opacity-80 text-[11px]">{t('checkout.deliveryStandardDesc')}</p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMethod('EXPRESS_COURIER')}
                  className={`p-3 rounded-xl border text-left text-xs space-y-1 transition-all ${
                    deliveryMethod === 'EXPRESS_COURIER' ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-neutral-50 text-neutral-800'
                  }`}
                >
                  <div className="font-bold flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-amber-400" />
                    <span>{t('checkout.deliveryExpress')}</span>
                  </div>
                  <p className="opacity-80 text-[11px]">{t('checkout.deliveryExpressDesc')}</p>
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-xs font-semibold text-neutral-700">{t('checkout.paymentMethod')}</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { id: 'CASH', label: t('checkout.paymentCash') },
                  { id: 'PAYME', label: t('checkout.paymentCard') },
                  { id: 'CARD', label: t('checkout.paymentCard') },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={`p-3 rounded-xl border text-center text-xs font-bold transition-all ${
                      paymentMethod === pm.id ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-neutral-50 text-neutral-800'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">{t('checkout.orderNotes')}</label>
              <input
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder={t('checkout.orderNotesPlaceholder')}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right Summary Column (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4 sticky top-20">
            <h3 className="text-base font-serif font-bold text-neutral-900 border-b border-neutral-100 pb-3">
              {t('cart.summaryTitle')} ({Object.keys(grouped).length})
            </h3>

            {/* Store Sub-Orders List */}
            <div className="space-y-3">
              {Object.entries(grouped).map(([storeId, group], index) => (
                <div key={storeId} className="bg-neutral-50 p-3 rounded-xl border border-neutral-200/80 text-xs space-y-1">
                  <div className="font-bold text-neutral-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-amber-800" />
                      <span>{t('account.storeSubOrder')} #{index + 1}: {group.storeName}</span>
                    </span>
                    <span>{group.subtotal.toLocaleString()} {t('common.uzs')}</span>
                  </div>

                  <ul className="text-neutral-500 space-y-0.5 pt-1 text-[11px]">
                    {group.items.map((it) => (
                      <li key={it.id}>• {it.name} (x{it.quantity})</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <hr className="border-neutral-100" />

            <div className="flex justify-between items-baseline">
              <span className="text-sm font-bold text-neutral-900">{t('cart.grandTotal')}:</span>
              <span className="text-2xl font-bold text-neutral-900">{grandTotal.toLocaleString()} {t('common.uzs')}</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
            >
              {isSubmitting ? t('checkout.submitting') : `${t('checkout.placeOrder')} →`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
