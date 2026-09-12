'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Search, Store, User, Menu, X, Sparkles } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { useLanguage } from '@/lib/language-context';

export default function Navbar() {
  const { getTotalItemsCount } = useCart();
  const { language, setLanguage } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const totalCount = getTotalItemsCount();

  const navTranslations = {
    uz: {
      home: 'Bosh sahifa',
      women: 'Ayollar',
      men: 'Erkaklar',
      shoes: 'Oyoq kiyimlar',
      bags: 'Sumkalar',
      accessories: 'Aksessuarlar',
      stores: 'Do‘konlar',
      sale: 'Chegirmalar',
      becomeSeller: 'Sotuvchi bo‘lish →',
      search: 'Kiyimlar, do‘konlar qidiring...',
      seller: 'Sotuvchiga',
      account: 'Profil',
      cart: 'Savat',
      banner: 'Multi-Vendor Moda Bozori • AI Telegram Sotuvchi Yordamchisi bilan',
    },
    ru: {
      home: 'Главная',
      women: 'Женщинам',
      men: 'Мужчинам',
      shoes: 'Обувь',
      bags: 'Сумки',
      accessories: 'Аксессуары',
      stores: 'Магазины',
      sale: 'Распродажа',
      becomeSeller: 'Стать продавцом →',
      search: 'Поиск одежды, магазинов...',
      seller: 'Продавцам',
      account: 'Профиль',
      cart: 'Корзина',
      banner: 'Маркетплейс моды • AI Telegram-ассистент для продавцов',
    },
    en: {
      home: 'Home',
      women: 'Women',
      men: 'Men',
      shoes: 'Shoes',
      bags: 'Bags',
      accessories: 'Accessories',
      stores: 'Stores',
      sale: 'Sale',
      becomeSeller: 'Become a Seller →',
      search: 'Search fashion, stores...',
      seller: 'For Sellers',
      account: 'Account & Orders',
      cart: 'Shopping Cart',
      banner: 'Multi-Vendor Fashion Marketplace • Powered by AI Telegram Seller Assistant',
    },
  };

  const t = navTranslations[language] || navTranslations.uz;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200">
      {/* Top Banner - Lighter and Slimmer */}
      <div className="bg-neutral-950 text-neutral-300 text-[11px] py-1 px-4 text-center flex items-center justify-center gap-1.5 sm:gap-2 border-b border-neutral-800/60">
        <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="truncate max-w-[240px] sm:max-w-none">{t.banner}</span>
        <Link href="/seller/register" className="underline font-medium text-white hover:text-amber-300 ml-1.5 shrink-0">
          {t.becomeSeller}
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Logo - Clear Home Link */}
          <Link href="/" className="flex items-center gap-2 text-xl sm:text-2xl font-serif font-bold tracking-tight text-neutral-900 shrink-0">
            <span className="bg-neutral-900 text-white px-2 py-0.5 rounded text-base sm:text-lg font-sans font-black">T</span>
            <span>TRENDMALL</span>
          </Link>

          {/* Desktop Navigation Category Links - Clean 5-category fashion menu */}
          <nav className="hidden md:flex items-center space-x-5 lg:space-x-7 text-xs lg:text-sm font-medium text-neutral-700 shrink-0">
            <Link href="/search?gender=WOMEN" className="hover:text-amber-800 transition-colors">{t.women}</Link>
            <Link href="/search?gender=MEN" className="hover:text-amber-800 transition-colors">{t.men}</Link>
            <Link href="/search?category=shoes" className="hover:text-amber-800 transition-colors">{t.shoes}</Link>
            <Link href="/search?category=bags" className="hover:text-amber-800 transition-colors">{t.bags}</Link>
            <Link href="/search?category=accessories" className="hover:text-amber-800 transition-colors">{t.accessories}</Link>
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Compact Search Form for Desktop */}
            <form onSubmit={handleSearchSubmit} className="hidden lg:flex items-center relative w-36 xl:w-44">
              <input
                type="text"
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-100 hover:bg-neutral-100/80 focus:bg-white border border-neutral-200 rounded-full py-1 pl-3 pr-7 text-xs focus:outline-none focus:ring-1.5 focus:ring-neutral-900 transition-all placeholder:text-neutral-400"
              />
              <button type="submit" aria-label="Search" className="absolute right-2 text-neutral-400 hover:text-neutral-800 transition-colors">
                <Search className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* Mobile Search Icon Button */}
            <Link
              href="/search"
              aria-label="Search"
              className="lg:hidden text-neutral-700 hover:text-neutral-900 p-1.5 rounded-full hover:bg-neutral-100 transition-colors"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>

            {/* 3-Language Selector: O‘Z | RU | EN */}
            <div className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setLanguage('uz')}
                className={`rounded-full px-1.5 sm:px-2 py-0.5 transition-colors ${
                  language === 'uz'
                    ? 'bg-neutral-900 text-white font-bold shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="O‘zbekcha"
              >
                O‘Z
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ru')}
                className={`rounded-full px-1.5 sm:px-2 py-0.5 transition-colors ${
                  language === 'ru'
                    ? 'bg-neutral-900 text-white font-bold shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="Русский"
              >
                RU
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`rounded-full px-1.5 sm:px-2 py-0.5 transition-colors ${
                  language === 'en'
                    ? 'bg-neutral-900 text-white font-bold shadow-sm'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
                title="English"
              >
                EN
              </button>
            </div>

            {/* Account */}
            <Link href="/account" title={t.account} className="text-neutral-700 hover:text-neutral-900 p-1.5 rounded-full hover:bg-neutral-100 transition-colors">
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>

            {/* Cart */}
            <Link href="/cart" title={t.cart} className="relative text-neutral-700 hover:text-neutral-900 p-1.5 rounded-full hover:bg-neutral-100 transition-colors">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
              {totalCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-amber-800 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {totalCount}
                </span>
              )}
            </Link>

            {/* Small "Sotuvchiga" Seller Access Link */}
            <Link
              href="/seller/dashboard"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 px-2.5 py-1 rounded-full transition-colors"
            >
              <Store className="w-3.5 h-3.5 text-neutral-500" />
              <span>{t.seller}</span>
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="md:hidden text-neutral-700 hover:text-neutral-900 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-neutral-200 px-4 pt-3 pb-6 space-y-3 shadow-lg">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-100 border border-neutral-200 rounded-lg py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-1.5 focus:ring-neutral-900"
            />
            <button type="submit" aria-label="Search" className="absolute right-3 top-2.5 text-neutral-500">
              <Search className="w-4 h-4" />
            </button>
          </form>

          <div className="grid grid-cols-2 gap-2 text-sm font-medium pt-2">
            <Link href="/search?gender=WOMEN" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-neutral-50 rounded text-neutral-800 hover:bg-neutral-100">
              {t.women}
            </Link>
            <Link href="/search?gender=MEN" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-neutral-50 rounded text-neutral-800 hover:bg-neutral-100">
              {t.men}
            </Link>
            <Link href="/search?category=shoes" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-neutral-50 rounded text-neutral-800 hover:bg-neutral-100">
              {t.shoes}
            </Link>
            <Link href="/search?category=bags" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-neutral-50 rounded text-neutral-800 hover:bg-neutral-100">
              {t.bags}
            </Link>
            <Link href="/search?category=accessories" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-neutral-50 rounded text-neutral-800 hover:bg-neutral-100">
              {t.accessories}
            </Link>
            <Link href="/stores" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-neutral-50 rounded text-neutral-800 hover:bg-neutral-100">
              {t.stores}
            </Link>
            <Link href="/search?sale=true" onClick={() => setMobileMenuOpen(false)} className="col-span-2 p-2 bg-rose-50 text-rose-700 font-semibold rounded hover:bg-rose-100 text-center">
              {t.sale}
            </Link>
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-neutral-100">
            <Link href="/seller/dashboard" onClick={() => setMobileMenuOpen(false)} className="text-xs font-semibold text-amber-800 flex items-center gap-1 hover:text-amber-900">
              <Store className="w-3.5 h-3.5" />
              <span>{t.seller} →</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
