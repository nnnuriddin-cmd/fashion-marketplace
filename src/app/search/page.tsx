import React from 'react';
import Link from 'next/link';
import { searchProducts, getRootCategories, getBrands, getAllApprovedStores } from '@/lib/db';
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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const {
    q,
    category,
    gender,
    minPrice,
    maxPrice,
    brand,
    store,
    sale,
    sort,
  } = searchParams;

  // 1. Fetch products using Supabase DB layer
  let rawProducts: Record<string, unknown>[] = [];
  try {
    rawProducts = await searchProducts({
      query: q,
      categorySlug: category,
      brandSlug: brand,
      gender: gender ? gender.toUpperCase() : undefined,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      status: 'ACTIVE',
      limit: 60,
    });
  } catch (error) {
    console.error('Error fetching search products from Supabase:', error);
    throw new Error(`Failed to load search products: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 2. Fetch categories, brands, and approved stores concurrently
  let allCategories: Awaited<ReturnType<typeof getRootCategories>> = [];
  let allBrands: Awaited<ReturnType<typeof getBrands>> = [];
  let allStores: Awaited<ReturnType<typeof getAllApprovedStores>> = [];

  try {
    const [categoriesRes, brandsRes, storesRes] = await Promise.all([
      getRootCategories(),
      getBrands(),
      getAllApprovedStores(),
    ]);
    allCategories = categoriesRes;
    allBrands = brandsRes;
    allStores = storesRes;
  } catch (error) {
    console.error('Error fetching filter facets from Supabase:', error);
    throw new Error(`Failed to load search filter options: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 3. Client-side-compatible in-memory filtering for store, sale, and sorting
  let filteredProducts = rawProducts;

  if (store) {
    filteredProducts = filteredProducts.filter((p) => {
      const storeObj = p.stores as { id?: string; slug?: string } | undefined;
      return storeObj?.slug === store || storeObj?.id === store || p.store_id === store;
    });
  }

  if (sale === 'true') {
    filteredProducts = filteredProducts.filter((p) => p.discount_price !== null && p.discount_price !== undefined);
  }

  // Sorting
  if (sort === 'price_asc') {
    filteredProducts.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  } else if (sort === 'price_desc') {
    filteredProducts.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  } else if (sort === 'popular') {
    filteredProducts.sort((a, b) => Number(b.views_count || 0) - Number(a.views_count || 0));
  }

  // 4. Map to ProductCard expected props
  const products = filteredProducts.map((p) => {
    const storeObj = p.stores as { name?: string; slug?: string } | undefined;
    return {
      id: String(p.id),
      storeId: String(p.store_id || ''),
      storeName: storeObj?.name || 'Boutique',
      storeSlug: storeObj?.slug || 'boutique',
      name: String(p.title || p.name || 'Product'),
      slug: String(p.slug || ''),
      price: Number(p.price || 0),
      discountPrice: p.discount_price !== null && p.discount_price !== undefined ? Number(p.discount_price) : null,
      currency: String(p.currency || 'UZS'),
      originalImage: String(p.original_image || p.image || 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80'),
      processedImages: typeof p.processed_images === 'string' ? p.processed_images : JSON.stringify(p.processed_images || []),
      sizes: typeof p.sizes === 'string' ? p.sizes : JSON.stringify(p.sizes || []),
      colors: typeof p.colors === 'string' ? p.colors : JSON.stringify(p.colors || []),
      gender: (p.gender as string) || undefined,
      style: (p.style as string) || undefined,
      isFeatured: Boolean(p.is_featured),
      isTrending: Boolean(p.is_trending),
    };
  });

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
          {/* Preserve existing filters when submitting search keyword */}
          {gender && <input type="hidden" name="gender" value={gender} />}
          {category && <input type="hidden" name="category" value={category} />}
          {brand && <input type="hidden" name="brand" value={brand} />}
          {store && <input type="hidden" name="store" value={store} />}
          {sort && <input type="hidden" name="sort" value={sort} />}
          <button
            type="submit"
            className="bg-neutral-900 hover:bg-neutral-800 text-white font-semibold px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition-colors"
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
              ].map((g) => {
                const params = new URLSearchParams({ ...searchParams });
                if (g.value) {
                  params.set('gender', g.value);
                } else {
                  params.delete('gender');
                }
                return (
                  <Link
                    key={g.label}
                    href={`/search?${params.toString()}`}
                    className={`text-xs px-3 py-1 rounded-full border transition-all ${
                      (gender || '') === g.value
                        ? 'bg-neutral-900 text-white border-neutral-900 font-semibold'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    {g.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Category</h4>
            <ul className="space-y-1 text-xs">
              <li>
                {(() => {
                  const params = new URLSearchParams({ ...searchParams });
                  params.delete('category');
                  return (
                    <Link
                      href={`/search?${params.toString()}`}
                      className={`block py-1 hover:text-amber-800 ${!category ? 'font-bold text-amber-800' : 'text-neutral-600'}`}
                    >
                      All Categories
                    </Link>
                  );
                })()}
              </li>
              {allCategories.map((c) => {
                const params = new URLSearchParams({ ...searchParams });
                params.set('category', c.slug);
                return (
                  <li key={c.id}>
                    <Link
                      href={`/search?${params.toString()}`}
                      className={`block py-1 hover:text-amber-800 ${category === c.slug ? 'font-bold text-amber-800' : 'text-neutral-600'}`}
                    >
                      {c.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Stores Filter */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Store / Boutique</h4>
            <div className="flex flex-col gap-1 text-xs max-h-48 overflow-y-auto pr-1">
              {(() => {
                const params = new URLSearchParams({ ...searchParams });
                params.delete('store');
                return (
                  <Link
                    href={`/search?${params.toString()}`}
                    className={`block py-1 px-2 rounded hover:bg-neutral-100 ${!store ? 'font-bold text-amber-800 bg-amber-50' : 'text-neutral-600'}`}
                  >
                    All Stores
                  </Link>
                );
              })()}
              {allStores.map((s) => {
                const params = new URLSearchParams({ ...searchParams });
                params.set('store', s.slug);
                return (
                  <Link
                    key={s.id}
                    href={`/search?${params.toString()}`}
                    className={`block py-1 px-2 rounded hover:bg-neutral-100 truncate ${store === s.slug ? 'font-bold text-amber-800 bg-amber-50' : 'text-neutral-600'}`}
                  >
                    {s.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Brands Filter */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Brand</h4>
            <div className="flex flex-col gap-1 text-xs max-h-48 overflow-y-auto pr-1">
              {(() => {
                const params = new URLSearchParams({ ...searchParams });
                params.delete('brand');
                return (
                  <Link
                    href={`/search?${params.toString()}`}
                    className={`block py-1 px-2 rounded hover:bg-neutral-100 ${!brand ? 'font-bold text-amber-800 bg-amber-50' : 'text-neutral-600'}`}
                  >
                    All Brands
                  </Link>
                );
              })()}
              {allBrands.map((b) => {
                const params = new URLSearchParams({ ...searchParams });
                params.set('brand', b.slug);
                return (
                  <Link
                    key={b.id}
                    href={`/search?${params.toString()}`}
                    className={`block py-1 px-2 rounded hover:bg-neutral-100 truncate ${brand === b.slug ? 'font-bold text-amber-800 bg-amber-50' : 'text-neutral-600'}`}
                  >
                    {b.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Sale Filter Toggle */}
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-900">Discounted / On Sale Only</span>
            {(() => {
              const params = new URLSearchParams({ ...searchParams });
              if (sale === 'true') {
                params.delete('sale');
              } else {
                params.set('sale', 'true');
              }
              return (
                <Link
                  href={`/search?${params.toString()}`}
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
              );
            })()}
          </div>
        </aside>

        {/* Product Grid Area */}
        <main className="lg:col-span-3 space-y-6">
          {/* Sorting Bar */}
          <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-neutral-200 text-xs">
            <span className="text-neutral-500 font-medium">
              Showing <strong className="text-neutral-900">{products.length}</strong> items
            </span>

            <div className="flex items-center gap-1 sm:gap-2">
              <span className="text-neutral-500 hidden sm:inline">Sort:</span>
              {[
                { label: 'Newest', value: 'newest' },
                { label: 'Popular', value: 'popular' },
                { label: 'Price ↑', value: 'price_asc' },
                { label: 'Price ↓', value: 'price_desc' },
              ].map((s) => {
                const params = new URLSearchParams({ ...searchParams });
                params.set('sort', s.value);
                const isActive = (sort || 'newest') === s.value;
                return (
                  <Link
                    key={s.value}
                    href={`/search?${params.toString()}`}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-neutral-900 text-white border-neutral-900'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    {s.label}
                  </Link>
                );
              })}
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
