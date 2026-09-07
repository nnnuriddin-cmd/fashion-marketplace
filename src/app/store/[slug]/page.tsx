import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import ProductCard from '@/components/customer/ProductCard';
import { MapPin, Phone, Send, Star, ShieldCheck, ShoppingBag, Store as StoreIcon } from 'lucide-react';

export const revalidate = 0;

interface StorePageProps {
  params: {
    slug: string;
  };
  searchParams: {
    category?: string;
    q?: string;
  };
}

export default function StoreFrontpage({ params, searchParams }: StorePageProps) {
  const db = getDb();

  const store = db.prepare(`SELECT * FROM stores WHERE slug = ? OR id = ?`).get(params.slug, params.slug) as any;

  if (!store) {
    notFound();
  }

  // Fetch store products
  let sql = `
    SELECT p.*, s.name as storeName, s.slug as storeSlug
    FROM products p
    JOIN stores s ON p.storeId = s.id
    WHERE p.storeId = ? AND p.status = 'PUBLISHED'
  `;
  const sqlParams: any[] = [store.id];

  if (searchParams.category) {
    sql += ` AND p.categoryId IN (SELECT id FROM categories WHERE slug = ?)`;
    sqlParams.push(searchParams.category);
  }

  if (searchParams.q) {
    sql += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
    sqlParams.push(`%${searchParams.q}%`, `%${searchParams.q}%`);
  }

  sql += ` ORDER BY p.createdAt DESC`;

  const products = db.prepare(sql).all(...sqlParams) as any[];

  // Fetch categories present in this store
  const storeCategories = db.prepare(`
    SELECT DISTINCT c.id, c.name, c.slug
    FROM categories c
    JOIN products p ON c.id = p.categoryId
    WHERE p.storeId = ? AND p.status = 'PUBLISHED'
  `).all(store.id) as any[];

  return (
    <div className="space-y-10 pb-16">
      {/* 1. STORE COVER BANNER */}
      <div className="relative h-64 sm:h-80 bg-neutral-900 overflow-hidden">
        {store.coverImage ? (
          <Image src={store.coverImage} alt={store.name} fill className="object-cover opacity-80" priority unoptimized />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
      </div>

      {/* 2. STORE HEADER INFO CARD */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-white bg-white overflow-hidden shadow-md shrink-0">
              {store.logo ? (
                <Image src={store.logo} alt={store.name} fill className="object-cover" unoptimized />
              ) : (
                <div className="w-full h-full bg-neutral-900 text-white font-bold flex items-center justify-center text-3xl">
                  {store.name.charAt(0)}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900">{store.name}</h1>
                <ShieldCheck className="w-5 h-5 text-emerald-600" title="Verified Marketplace Boutique" />
              </div>

              <p className="text-xs text-neutral-600 max-w-2xl leading-relaxed">{store.description}</p>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-neutral-500 font-medium">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                  {store.location || 'Tashkent'}
                </span>

                {store.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-neutral-400" />
                    {store.phone}
                  </span>
                )}

                {store.telegramUsername && (
                  <a
                    href={`https://t.me/${store.telegramUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-sky-700 hover:underline"
                  >
                    <Send className="w-3.5 h-3.5" />
                    @{store.telegramUsername}
                  </a>
                )}

                <span className="flex items-center gap-1 font-bold text-amber-800">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {store.rating || 5.0} Rating
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-neutral-100 pt-4 md:pt-0 md:pl-6 text-xs text-neutral-500">
            <div><strong>Active Items:</strong> {products.length} published</div>
            <div><strong>Store Status:</strong> <span className="text-emerald-700 font-semibold">APPROVED</span></div>
            <div><strong>Fast Delivery:</strong> Same Day in Tashkent</div>
          </div>
        </div>
      </div>

      {/* 3. STORE CATALOG & CATEGORIES */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-neutral-900">{store.name} Catalog</h2>
            <p className="text-xs text-neutral-500">Browse clothing items directly from this boutique</p>
          </div>

          {/* Store Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            <Link
              href={`/store/${store.slug}`}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 ${
                !searchParams.category ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              All Items ({products.length})
            </Link>
            {storeCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/store/${store.slug}?category=${cat.slug}`}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 ${
                  searchParams.category === cat.slug
                    ? 'bg-amber-800 text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Store Products Grid */}
        {products.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-2">
            <ShoppingBag className="w-10 h-10 text-neutral-300 mx-auto" />
            <h3 className="text-base font-bold text-neutral-900">No items found in this store category</h3>
            <p className="text-xs text-neutral-500">Check back soon for new arrivals from {store.name}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
