import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getDb } from '@/lib/db';
import ProductCard from '@/components/customer/ProductCard';
import StoreCard from '@/components/customer/StoreCard';
import { ArrowRight, Sparkles, Send, ShieldCheck, Flame, ShoppingBag } from 'lucide-react';

export const revalidate = 0; // Fresh dynamic catalog retrieval

export default function HomePage() {
  const db = getDb();

  // Fetch data from database
  const stores = db.prepare(`SELECT * FROM stores WHERE status = 'APPROVED' LIMIT 6`).all() as any[];

  const featuredProducts = db.prepare(`
    SELECT p.*, s.name as storeName, s.slug as storeSlug
    FROM products p
    JOIN stores s ON p.storeId = s.id
    WHERE p.status = 'PUBLISHED'
    ORDER BY p.isFeatured DESC, p.viewsCount DESC
    LIMIT 8
  `).all() as any[];

  const womensProducts = db.prepare(`
    SELECT p.*, s.name as storeName, s.slug as storeSlug
    FROM products p
    JOIN stores s ON p.storeId = s.id
    WHERE p.status = 'PUBLISHED' AND p.gender = 'WOMEN'
    LIMIT 4
  `).all() as any[];

  const mensProducts = db.prepare(`
    SELECT p.*, s.name as storeName, s.slug as storeSlug
    FROM products p
    JOIN stores s ON p.storeId = s.id
    WHERE p.status = 'PUBLISHED' AND p.gender = 'MEN'
    LIMIT 4
  `).all() as any[];

  const brands = db.prepare(`SELECT * FROM brands LIMIT 8`).all() as any[];

  return (
    <div className="space-y-16 pb-16">
      {/* 1. HERO SECTION */}
      <section className="relative bg-neutral-950 text-white overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 z-0 opacity-40">
          <Image
            src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=2000&q=80"
            alt="Fashion Marketplace"
            fill
            priority
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3.5 py-1 rounded-full text-xs font-semibold">
              <Sparkles className="w-4 h-4" />
              <span>Digital Fashion Mall • 10+ Physical Stores in 1 Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight leading-tight">
              Discover Local Boutiques & Designer Fashion
            </h1>

            <p className="text-neutral-300 text-sm sm:text-base max-w-xl leading-relaxed">
              Explore thousands of curated items from Tashkent's top physical clothing stores, Instagram sellers, and independent boutiques with instant local delivery.
            </p>

            {/* Quick Filter Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/search?gender=WOMEN"
                className="bg-white text-neutral-900 font-semibold px-6 py-3 rounded-full hover:bg-amber-100 transition-all text-xs sm:text-sm shadow-md"
              >
                Shop Women's →
              </Link>
              <Link
                href="/search?gender=MEN"
                className="bg-neutral-800 text-white border border-neutral-700 font-semibold px-6 py-3 rounded-full hover:bg-neutral-700 transition-all text-xs sm:text-sm"
              >
                Shop Men's →
              </Link>
              <Link
                href="/stores"
                className="bg-amber-700/80 text-white font-semibold px-6 py-3 rounded-full hover:bg-amber-600 transition-all text-xs sm:text-sm"
              >
                Browse Stores
              </Link>
            </div>
          </div>

          {/* AI Telegram Seller Feature Card */}
          <div className="lg:col-span-5">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500 text-neutral-950 p-2.5 rounded-xl">
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Are you a Fashion Store Owner?</h3>
                  <p className="text-xs text-neutral-300">Sell on marketplace via Telegram</p>
                </div>
              </div>

              <div className="bg-neutral-900/90 rounded-xl p-4 text-xs space-y-2 border border-neutral-800">
                <p className="text-amber-400 font-mono font-semibold">⚡ The 10-Second Listing Workflow:</p>
                <ol className="text-neutral-300 space-y-1 pl-4 list-decimal">
                  <li>Take photo of clothing item on smartphone</li>
                  <li>Send photo directly to Telegram Bot</li>
                  <li>AI removes background & writes product details</li>
                  <li>Input price & stock → Published live!</li>
                </ol>
              </div>

              <Link
                href="/seller/register"
                className="block text-center w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold py-2.5 rounded-xl transition-all text-xs uppercase tracking-wider"
              >
                Connect Store to Telegram →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* 2. CATEGORIES QUICK NAV */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-serif font-bold text-neutral-900">Explore by Category</h2>
              <p className="text-xs text-neutral-500">Find clothing, footwear, and accessories</p>
            </div>
            <Link href="/search" className="text-xs font-semibold text-amber-800 hover:underline flex items-center gap-1">
              View All Catalog <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {[
              { title: "Women's Fashion", img: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=400&q=80', href: '/search?gender=WOMEN' },
              { title: "Men's Fashion", img: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?auto=format&fit=crop&w=400&q=80', href: '/search?gender=MEN' },
              { title: 'Footwear & Shoes', img: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80', href: '/search?category=shoes' },
              { title: 'Bags & Handbags', img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=400&q=80', href: '/search?category=bags' },
              { title: 'Jewelry & Belts', img: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=400&q=80', href: '/search?category=accessories' },
            ].map((cat, i) => (
              <Link key={i} href={cat.href} className="group relative h-40 rounded-xl overflow-hidden shadow-sm">
                <Image src={cat.img} alt={cat.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-900/90 via-neutral-900/30 to-transparent flex items-end p-3">
                  <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">{cat.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 3. FEATURED BOUTIQUES */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h2 className="text-2xl font-serif font-bold text-neutral-900">Featured Stores</h2>
              </div>
              <p className="text-xs text-neutral-500">Shop directly from top verified physical stores & Instagram boutiques</p>
            </div>
            <Link href="/stores" className="text-xs font-semibold text-amber-800 hover:underline">
              All Stores ({stores.length}) →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {stores.map((s) => (
              <StoreCard key={s.id} store={s} />
            ))}
          </div>
        </section>

        {/* 4. TRENDING FASHION PRODUCTS */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-rose-600 animate-bounce" />
                <h2 className="text-2xl font-serif font-bold text-neutral-900">Trending Right Now</h2>
              </div>
              <p className="text-xs text-neutral-500">Popular items uploaded by top sellers</p>
            </div>
            <Link href="/search?sort=popular" className="text-xs font-semibold text-amber-800 hover:underline">
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {featuredProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* 5. WOMEN'S FEATURED SHOWCASE */}
        <section className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-serif font-bold text-neutral-900">Women's Couture & Apparel</h2>
              <p className="text-xs text-neutral-500">Silk dresses, linen blazers, knitwear & gowns</p>
            </div>
            <Link href="/search?gender=WOMEN" className="text-xs font-semibold text-amber-800 hover:underline">
              Explore Women's →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {womensProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* 6. MEN'S FEATURED SHOWCASE */}
        <section className="bg-neutral-100/70 p-6 rounded-2xl border border-neutral-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-serif font-bold text-neutral-900">Men's Suits & Outerwear</h2>
              <p className="text-xs text-neutral-500">Bespoke Italian suits, bomber jackets & streetwear</p>
            </div>
            <Link href="/search?gender=MEN" className="text-xs font-semibold text-amber-800 hover:underline">
              Explore Men's →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {mensProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>

        {/* 7. POPULAR BRANDS */}
        <section className="pt-4 border-t border-neutral-200">
          <h3 className="text-xs font-bold text-center text-neutral-400 uppercase tracking-widest mb-6">
            Featured Designer Brands & Boutiques
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-75 grayscale hover:grayscale-0 transition-all">
            {brands.map((b) => (
              <Link key={b.id} href={`/search?brand=${b.slug}`} className="text-sm font-bold text-neutral-700 hover:text-neutral-900">
                {b.name}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
