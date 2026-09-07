'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Search, Store, User, Menu, X, Sparkles, ShieldCheck } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { useLanguage } from '@/lib/language-context';

export default function Navbar() {
  const { getTotalItemsCount } = useCart();
  const { language, setLanguage } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const totalCount = getTotalItemsCount();
  const t = language === 'uz'
    ? { home: 'Bosh sahifa', women: 'Ayollar', men: 'Erkaklar', shoes: 'Oyoq kiyim', bags: 'Sumkalar', accessories: 'Aksessuarlar', stores: 'Do‘konlar', search: 'Mahsulot yoki do‘kon qidiring...', seller: 'Sotuvchi paneli' }
    : { home: 'Home', women: 'Women', men: 'Men', shoes: 'Shoes', bags: 'Bags', accessories: 'Accessories', stores: 'Stores', search: 'Search fashion, stores...', seller: 'Seller Hub' };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-neutral-200">
      {/* Top Banner */}
      <div className="bg-neutral-900 text-white text-xs py-1.5 px-4 text-center flex items-center justify-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span>Multi-Vendor Fashion Marketplace • Powered by AI Telegram Seller Assistant</span>
        <Link href="/seller/register" className="underline font-semibold hover:text-amber-300 ml-2">
          Become a Seller →
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 text-2xl font-serif font-bold tracking-tight text-neutral-900">
            <span className="bg-neutral-900 text-white px-2 py-0.5 rounded text-xl">T</span>
            <span>TRENDMALL</span>
          </Link>

          {/* Desktop Navigation Category Links */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-neutral-700">
            <Link href="/" className="hover:text-amber-800 transition-colors">{t.home}</Link>
            <Link href="/search?gender=WOMEN" className="hover:text-amber-800 transition-colors">{t.women}</Link>
            <Link href="/search?gender=MEN" className="hover:text-amber-800 transition-colors">{t.men}</Link>
            <Link href="/search?category=shoes" className="hover:text-amber-800 transition-colors">{t.shoes}</Link>
            <Link href="/search?category=bags" className="hover:text-amber-800 transition-colors">{t.bags}</Link>
            <Link href="/search?category=accessories" className="hover:text-amber-800 transition-colors">{t.accessories}</Link>
            <Link href="/search?sale=true" className="text-rose-600 font-semibold hover:text-rose-700">Sale</Link>
            <Link href="/stores" className="flex items-center gap-1 hover:text-amber-800 transition-colors">
              <Store className="w-4 h-4 text-amber-700" />
              <span>{t.stores}</span>
            </Link>
          </nav>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="hidden lg:flex items-center relative w-64">
            <input
              type="text"
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-100 border border-neutral-200 rounded-full py-1.5 pl-3.5 pr-8 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            <button type="submit" className="absolute right-2 text-neutral-500 hover:text-neutral-900">
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Action Icons */}
          <div className="flex items-center gap-4">
            <button onClick={() => setLanguage(language === 'en' ? 'uz' : 'en')} className="text-xs font-bold border border-neutral-200 rounded-full px-2 py-1 hover:bg-neutral-100" title="O‘zbekcha / English">
              {language === 'en' ? 'O‘Z' : 'EN'}
            </button>
            <Link href="/account" title="Account & Orders" className="text-neutral-700 hover:text-neutral-900 p-1">
              <User className="w-5 h-5" />
            </Link>

            <Link href="/cart" className="relative text-neutral-700 hover:text-neutral-900 p-1">
              <ShoppingBag className="w-5 h-5" />
              {totalCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-800 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {totalCount}
                </span>
              )}
            </Link>

            <Link
              href="/seller/dashboard"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 text-white px-3 py-1.5 rounded-full hover:bg-neutral-800 transition-all"
            >
              <Store className="w-3.5 h-3.5" />
              <span>{t.seller}</span>
            </Link>

            <Link
              href="/admin"
              className="hidden xl:inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 border border-neutral-200 px-2.5 py-1 rounded-full"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Admin</span>
            </Link>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-neutral-700 hover:text-neutral-900 p-1"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-neutral-200 px-4 pt-3 pb-6 space-y-3">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              placeholder="Search products, stores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-100 border border-neutral-200 rounded-lg py-2 pl-3 pr-8 text-sm focus:outline-none"
            />
            <button type="submit" className="absolute right-3 top-2.5 text-neutral-500">
              <Search className="w-4 h-4" />
            </button>
          </form>

          <div className="grid grid-cols-2 gap-2 text-sm font-medium pt-2">
            <Link href="/search?gender=WOMEN" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-neutral-50 rounded text-neutral-800">
              Women's Fashion
            </Link>
            <Link href="/search?gender=MEN" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-neutral-50 rounded text-neutral-800">
              Men's Fashion
            </Link>
            <Link href="/search?category=shoes" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-neutral-50 rounded text-neutral-800">
              Shoes & Boots
            </Link>
            <Link href="/search?category=bags" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-neutral-50 rounded text-neutral-800">
              Bags & Leather
            </Link>
            <Link href="/stores" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-neutral-50 rounded text-neutral-800">
              Browse Stores
            </Link>
            <Link href="/search?sale=true" onClick={() => setMobileMenuOpen(false)} className="p-2 bg-rose-50 text-rose-700 font-semibold rounded">
              Sale & Deals
            </Link>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-neutral-100">
            <Link href="/seller/dashboard" onClick={() => setMobileMenuOpen(false)} className="text-xs font-semibold text-amber-800">
              Seller Dashboard →
            </Link>
            <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="text-xs font-semibold text-neutral-500">
              Admin Panel →
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
