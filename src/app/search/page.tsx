import React from 'react';
import Link from 'next/link';
import { getDb } from '@/lib/db';
import ProductCard from '@/components/customer/ProductCard';
import { Filter, SlidersHorizontal, Search as SearchIcon, RotateCcw, Sparkles } from 'lucide-react';

export const revalidate = 0;

interface SearchPageProps {
  searchParams: {
    q?: string;
    category?: string;
    gender?: string;
    minPrice?: string;
    maxPrice?: string;
    brand?: string;
    store?: string;
    color?: string;
    size?: string;
    style?: string;
    occasion?: string;
    sale?: string;
    sort?: string;
  };
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const db = getDb();

  const {
    q,
    category,
    gender,
    minPrice,
    maxPrice,
    brand,
    store,
    color,
    size,
    style,
    occasion,
    sale,
    sort,
  } = searchParams;

  // Build dynamic SQL query
  let sql = `
    SELECT p.*, s.name as storeName, s.slug as storeSlug, c.name as categoryName
    FROM products p
    JOIN stores s ON p.storeId = s.id
    JOIN categories c ON p.categoryId = c.id
    WHERE p.status = 'PUBLISHED'
  `;

  const params: any[] = [];

  if (q) {
    sql += ` AND (p.name LIKE ? OR p.description LIKE ? OR p.tags LIKE ? OR s.name LIKE ?)`;
    const term = `%${q}%`;
    params.push(term, term, term, term);
  }

  if (gender) {
    sql += ` AND (p.gender = ? OR p.gender = 'UNISEX')`;
    params.push(gender.toUpperCase());
  }

  if (category) {
    sql += ` AND (c.slug = ? OR c.parentId IN (SELECT id FROM categories WHERE slug = ?))`;
    params.push(category, category);
  }

  if (brand) {
    sql += ` AND p.brandId IN (SELECT id FROM brands WHERE slug = ?)`;
    params.push(brand);
  }

  if (store) {
    sql += ` AND (s.slug = ? OR s.id = ?)`;
    params.push(store, store);
  }

  if (minPrice) {
    sql += ` AND p.price >= ?`;
    params.push(parseFloat(minPrice));
  }

  if (maxPrice) {
    sql += ` AND p.price <= ?`;
    params.push(parseFloat(maxPrice));
  }

  if (color) {
    sql += ` AND p.colors LIKE ?`;
    params.push(`%${color}%`);
  }

  if (size) {
    sql += ` AND p.sizes LIKE ?`;
    params.push(`%${size}%`);
  }

  if (style) {
    sql += ` AND p.style LIKE ?`;
    params.push(`%${style}%`);
  }

  if (occasion) {
    sql += ` AND p.occasion LIKE ?`;
    params.push(`%${occasion}%`);
  }

  if (sale === 'true') {
    sql += ` AND p.discountPrice IS NOT NULL`;
  }

  // Sorting
  if (sort === 'price_asc') {
    sql += ` ORDER BY p.price ASC`;
  } else if (sort === 'price_desc') {
    sql += ` ORDER BY p.price DESC`;
  } else if (sort === 'popular') {
    sql += ` ORDER BY p.viewsCount DESC, p.isTrending DESC`;
  } else {
    sql += ` ORDER BY p.createdAt DESC`;
  }

  sql += ` LIMIT 60`;

  const products = db.prepare(sql).all(...params) as any[];

  const allCategories = db.prepare(`SELECT * FROM categories WHERE parentId IS NULL`).all() as any[];
  const allBrands = db.prepare(`SELECT * FROM brands`).all() as any[];
  const allStores = db.prepare(`SELECT id, name, slug FROM stores WHERE status = 'APPROVED'`).all() as any[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & AI Search Bar */}
      <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-serif font-bold text-neutral-900">
              {q ? `Search results for "${q}"` : 'Explore Fashion Marketplace'}
            </h1>
            <p className="text-xs text-neutral-500">
              Showing {products.length} products across Tashkent boutiques
            </p>
          </div>

          {/* AI Semantic Natural Language Search Prompt */}
          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1.5 rounded-lg text-xs">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>AI Search Ready: "black elegant dress for wedding under 500k"</span>
          </div>
        </div>

        {/* Search Bar Form */}
        <form action="/search" method="GET" className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              name="q"
              defaultValue={q || ''}
              placeholder="Search by keywords e.g. linen blazer, silk slip dress, bomber jacket..."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            <SearchIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
          </div>
          <button
            type="submit"
            className="bg-neutral-900 hover:bg-neutral-800 text-white font-semibold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider"
          >
            Search
          </button>
        </form>
      </div>

      {/* Main Catalog & Filter Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filters */}
        <aside className="lg:col-span-1 space-y-6 bg-white p-5 rounded-2xl border border-neutral-200 h-fit sticky top-20">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2 font-bold text-neutral-900 text-sm">
              <SlidersHorizontal className="w-4 h-4 text-amber-800" />
              <span>Filters & Facets</span>
            </div>
            <Link href="/search" className="text-[11px] text-amber-800 font-semibold flex items-center gap-1 hover:underline">
              <RotateCcw className="w-3 h-3" /> Reset
            </Link>
          </div>

          {/* Gender Filter */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Gender</h4>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'All', value: '' },
                { label: "Women's", value: 'WOMEN' },
                { label: "Men's", value: 'MEN' },
                { label: 'Unisex', value: 'UNISEX' },
              ].map((g) => (
                <Link
                  key={g.label}
                  href={`/search?${new URLSearchParams({ ...searchParams, gender: g.value }).toString()}`}
                  className={`text-xs px-3 py-1 rounded-full border transition-all ${
                    (gender || '') === g.value
                      ? 'bg-neutral-900 text-white border-neutral-900 font-semibold'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  {g.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Category</h4>
            <ul className="space-y-1 text-xs">
              <li>
                <Link
                  href={`/search?${new URLSearchParams({ ...searchParams, category: '' }).toString()}`}
                  className={`block py-1 hover:text-amber-800 ${!category ? 'font-bold text-amber-800' : 'text-neutral-600'}`}
                >
                  All Categories
                </Link>
              </li>
              {allCategories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/search?${new URLSearchParams({ ...searchParams, category: c.slug }).toString()}`}
                    className={`block py-1 hover:text-amber-800 ${category === c.slug ? 'font-bold text-amber-800' : 'text-neutral-600'}`}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Stores Filter */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Store / Boutique</h4>
            <select
              defaultValue={store || ''}
              onChange={(e) => {
                window.location.href = `/search?${new URLSearchParams({ ...searchParams, store: e.target.value }).toString()}`;
              }}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs focus:outline-none"
            >
              <option value="">All Stores</option>
              {allStores.map((s) => (
                <option key={s.id} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Brands Filter */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Brand</h4>
            <select
              defaultValue={brand || ''}
              onChange={(e) => {
                window.location.href = `/search?${new URLSearchParams({ ...searchParams, brand: e.target.value }).toString()}`;
              }}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs focus:outline-none"
            >
              <option value="">All Brands</option>
              {allBrands.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sale Filter Toggle */}
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-900">Discounted / On Sale Only</span>
            <Link
              href={`/search?${new URLSearchParams({ ...searchParams, sale: sale === 'true' ? '' : 'true' }).toString()}`}
              className={`w-9 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                sale === 'true' ? 'bg-rose-600' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`w-4 h-4 bg-white rounded-full transition-transform ${
                  sale === 'true' ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </Link>
          </div>
        </aside>

        {/* Product Grid Area */}
        <main className="lg:col-span-3 space-y-6">
          {/* Sorting Bar */}
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-neutral-200 text-xs">
            <span className="text-neutral-500 font-medium">
              Showing <strong className="text-neutral-900">{products.length}</strong> items
            </span>

            <div className="flex items-center gap-2">
              <span className="text-neutral-500">Sort by:</span>
              <select
                defaultValue={sort || 'newest'}
                onChange={(e) => {
                  window.location.href = `/search?${new URLSearchParams({ ...searchParams, sort: e.target.value }).toString()}`;
                }}
                className="bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none"
              >
                <option value="newest">Newest Arrivals</option>
                <option value="popular">Most Popular</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Products Results Grid */}
          {products.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-3">
              <Filter className="w-10 h-10 text-neutral-300 mx-auto" />
              <h3 className="text-lg font-bold text-neutral-900">No products found matching filters</h3>
              <p className="text-xs text-neutral-500">Try adjusting your category, keyword or price filters.</p>
              <Link href="/search" className="inline-block text-xs bg-neutral-900 text-white font-semibold px-4 py-2 rounded-lg">
                Reset All Filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
