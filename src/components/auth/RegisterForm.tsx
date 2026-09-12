'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { signUpAction } from '@/app/actions/auth';
import {
  UserPlus,
  User,
  Mail,
  Phone,
  Lock,
  AlertCircle,
  ArrowRight,
  ShoppingBag,
  Store,
  MapPin,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n/translations';

interface RegisterFormProps {
  initialRole?: 'CUSTOMER' | 'SELLER';
}

export function RegisterForm({ initialRole }: RegisterFormProps) {
  const { t } = useTranslation();
  const [role, setRole] = useState<'CUSTOMER' | 'SELLER' | null>(initialRole || null);

  // Common user fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Seller store fields
  const [storeName, setStoreName] = useState('');
  const [city, setCity] = useState('Toshkent');
  const [storeDescription, setStoreDescription] = useState('');

  // Status state
  const [error, setError] = useState<string | null>(null);
  const [isSellerCreated, setIsSellerCreated] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Client-side validation checks
    if (!fullName.trim()) {
      setError(t('auth.fullName') + ' talab qilinadi.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('auth.email') + ' noto‘g‘ri kiritildi.');
      return;
    }
    if (role === 'SELLER' && !phone.trim()) {
      setError(t('auth.phoneRequiredForSeller'));
      return;
    }
    if (password.length < 6) {
      setError('Parol kamida 6 belgidan iborat bo‘lishi kerak.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Kiritilgan parollar bir-biriga mos kelmadi.');
      return;
    }

    if (role === 'SELLER') {
      if (!storeName.trim()) {
        setError(t('auth.storeNameRequired'));
        return;
      }
      if (!city.trim()) {
        setError(t('auth.cityRequired'));
        return;
      }
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('accountType', role || 'CUSTOMER');
      formData.append('fullName', fullName);
      formData.append('email', email);
      if (phone.trim()) {
        formData.append('phone', phone);
      }
      formData.append('password', password);
      formData.append('confirmPassword', confirmPassword);

      if (role === 'SELLER') {
        formData.append('storeName', storeName);
        formData.append('city', city);
        if (storeDescription.trim()) {
          formData.append('storeDescription', storeDescription);
        }
      }

      const res = await signUpAction(null, formData);
      if (res?.error) {
        setError(res.error);
        return;
      }

      if (res?.success) {
        if (res.role === 'SELLER') {
          setIsSellerCreated(true);
        } else {
          window.location.href = res.redirectUrl || '/account';
        }
      }
    });
  };

  // STEP 3: Seller Success Screen
  if (isSellerCreated) {
    return (
      <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-bold text-neutral-900">
            {t('auth.sellerSuccessTitle')}
          </h2>
          <div className="inline-block bg-amber-100 text-amber-900 text-xs font-bold px-3 py-1 rounded-full">
            {t('auth.sellerSuccessPending')}
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed pt-2">
            {t('auth.sellerSuccessDesc')}
          </p>
        </div>

        <div className="pt-2">
          <Link
            href="/seller/dashboard"
            className="w-full py-3 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white transition-colors flex items-center justify-center gap-2"
          >
            <span>{t('auth.goToSellerHub')}</span>
          </Link>
        </div>
      </div>
    );
  }

  // STEP 1: Account Type Selection
  if (!role) {
    return (
      <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6 text-left">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center mx-auto font-bold text-xl font-sans">
            T
          </div>
          <h2 className="text-xl font-serif font-bold text-neutral-900">
            {t('auth.chooseRoleTitle')}
          </h2>
          <p className="text-xs text-neutral-500">
            {t('auth.chooseRoleSubtitle')}
          </p>
        </div>

        <div className="space-y-3">
          {/* Buyer Card */}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setRole('CUSTOMER');
            }}
            className="w-full p-4 rounded-2xl border-2 border-neutral-200 hover:border-neutral-900 bg-neutral-50/50 hover:bg-white transition-all text-left flex items-start gap-4 group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="text-sm font-bold text-neutral-900 flex items-center justify-between">
                <span>{t('auth.buyerRoleTitle')}</span>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {t('auth.buyerRoleDesc')}
              </p>
            </div>
          </button>

          {/* Seller Card */}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setRole('SELLER');
            }}
            className="w-full p-4 rounded-2xl border-2 border-neutral-200 hover:border-neutral-900 bg-neutral-50/50 hover:bg-white transition-all text-left flex items-start gap-4 group"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Store className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="text-sm font-bold text-neutral-900 flex items-center justify-between">
                <span>{t('auth.sellerRoleTitle')}</span>
                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">
                {t('auth.sellerRoleDesc')}
              </p>
            </div>
          </button>
        </div>

        <div className="pt-4 border-t border-neutral-100 text-center text-xs text-neutral-500">
          {t('auth.hasAccount')}{' '}
          <Link
            href="/account"
            className="font-semibold text-neutral-900 hover:underline inline-flex items-center gap-0.5"
          >
            <span>{t('auth.loginHere')}</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }

  // STEP 2: Registration Form (Customer or Seller)
  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6 text-left">
      {/* Back button & Title */}
      <div>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setRole(null);
          }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900 transition-colors mb-3"
        >
          <span>{t('auth.backToRole')}</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center shrink-0">
            {role === 'SELLER' ? <Store className="w-5 h-5 text-amber-700" /> : <UserPlus className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-neutral-900">
              {role === 'SELLER' ? t('auth.sellerRoleTitle') : t('auth.buyerRoleTitle')}
            </h2>
            <p className="text-xs text-neutral-500">
              {role === 'SELLER' ? t('auth.sellerRoleDesc') : t('auth.buyerRoleDesc')}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-neutral-400" />
            <span>{t('auth.fullName')} <span className="text-rose-500">*</span></span>
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jasur Aliyev"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-neutral-400" />
            <span>{t('auth.email')} <span className="text-rose-500">*</span></span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jasur@example.com"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-neutral-400" />
            <span>
              {t('auth.phone')}
              {role === 'SELLER' && <span className="text-rose-500"> *</span>}
            </span>
          </label>
          <input
            type="tel"
            required={role === 'SELLER'}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>{t('auth.password')} <span className="text-rose-500">*</span></span>
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        {/* Confirm Password */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>{t('auth.confirmPassword')} <span className="text-rose-500">*</span></span>
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        {/* SELLER SPECIFIC STORE SECTION */}
        {role === 'SELLER' && (
          <div className="pt-4 border-t border-neutral-200 space-y-4">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-700" />
              <h3 className="text-sm font-serif font-bold text-neutral-900">
                {t('auth.storeSectionTitle')}
              </h3>
            </div>

            {/* Store Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t('auth.storeName')} <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder={t('auth.storeNamePlaceholder')}
                className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              />
            </div>

            {/* Store City */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t('auth.storeCity')} <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('auth.storeCityPlaceholder')}
                className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
              />
            </div>

            {/* Store Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t('auth.storeDescription')}</span>
              </label>
              <textarea
                rows={2}
                value={storeDescription}
                onChange={(e) => setStoreDescription(e.target.value)}
                placeholder={t('auth.storeDescPlaceholder')}
                className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 resize-none"
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isPending}
          className={
            'w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2 ' +
            (isPending
              ? 'bg-neutral-400 cursor-not-allowed'
              : 'bg-neutral-900 hover:bg-neutral-800')
          }
        >
          {isPending ? (
            <span>{t('auth.registering')}</span>
          ) : (
            <>
              {role === 'SELLER' ? <Store className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>{role === 'SELLER' ? t('auth.createAccountAndStore') : t('auth.createAccount')}</span>
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-neutral-100 text-center text-xs text-neutral-500">
        {t('auth.hasAccount')}{' '}
        <Link
          href="/account"
          className="font-semibold text-neutral-900 hover:underline inline-flex items-center gap-0.5"
        >
          <span>{t('auth.loginHere')}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

