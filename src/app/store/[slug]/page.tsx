import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProductCard from '@/components/customer/ProductCard';
import { MapPin, Phone, Send, Star, ShieldCheck, ShoppingBag, Store as StoreIcon } from 'lucide-react';
import { T } from '@/lib/i18n/translations';

export const revalidate = 0;

interface StorePageProps {
  params: {
    slug: string;
  };
  searchParams?: {
    category?: string;
    q?: string;
  };
}

export default async function StoreFrontpage({ params, searchParams }: StorePageProps) {
  if (!params?.slug) {
    notFound();
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.slug);

  let rawStore: any = null;
  try {
    let storeQuery = supabase.from('stores').select('*');
    if (isUuid) {
      storeQuery = storeQuery.eq('id', params.slug);
    } else {
      storeQuery = storeQuery.eq('slug', params.slug);
    }

    const { data, error } = await storeQuery.maybeSingle();
    if (error) {
      console.error('Error fetching store from Supabase:', error);
    }
    rawStore = data;
  } catch (err) {
    console.error('Unexpected error fetching store:', err);
    rawStore = null;
  }

  if (!rawStore) {
    notFound();
  }

  const store = {
    ...rawStore,
    coverImage: rawStore.cover_image || rawStore.coverImage || null,
    telegramUsername: rawStore.telegram_username || rawStore.telegramUsername || null,
  };

  const safeSearchParams = searchParams || {};
  let rawStoreProducts: any[] = [];
  try {
    let query = supabase
      .from('products')
      .select('*, categories(id, name, slug)')
      .eq('store_id', store.id)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });

    if (safeSearchParams.q && safeSearchParams.q.trim()) {
      query = query.or(`title.ilike.%${safeSearchParams.q.trim()}%,description.ilike.%${safeSearchParams.q.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching store products from Supabase:', error);
      rawStoreProducts = [];
    } else {
      rawStoreProducts = data || [];
    }
  } catch (err) {
    console.error('Unexpected error fetching store products:', err);
    rawStoreProducts = [];
  }

  const storeCategories = Array.from(
    new Map(
      rawStoreProducts
        .filter((product: any) => product.categories)
        .map((product: any) => [product.categories.id, product.categories])
    ).values()
  );

  let filteredProducts = rawStoreProducts;
  if (safeSearchParams.category) {
    filteredProducts = filteredProducts.filter(
      (p: any) => p.categories?.slug === safeSearchParams.category
    );
  }

  const fallbackImage = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80';

  const products = filteredProducts.map((p: any) => {
    const rawImageCandidate = p.original_image || p.image || p.originalImage;
    const resolvedImage = typeof rawImageCandidate === 'string' && rawImageCandidate.trim() !== ''
      ? rawImageCandidate.trim()
      : fallbackImage;

    let safeProcessedImages: string[] = [];
    if (Array.isArray(p.processed_images)) {
      safeProcessedImages = p.processed_images.filter((img: any) => typeof img === 'string' && img.trim() !== '');
    } else if (typeof p.processed_images === 'string') {
      try {
        const parsed = JSON.parse(p.processed_images);
        if (Array.isArray(parsed)) {
          safeProcessedImages = parsed.filter((img: any) => typeof img === 'string' && img.trim() !== '');
        }
      } catch {
        safeProcessedImages = [];
      }
    }

    return {
      id: String(p.id),
      storeId: String(p.store_id || store.id),
      storeName: store.name,
      storeSlug: store.slug,
      name: String(p.title || p.name || 'Product'),
      slug: String(p.slug || ''),
      price: Number(p.price || 0),
      discountPrice: p.discount_price !== null && p.discount_price !== undefined ? Number(p.discount_price) : null,
      currency: String(p.currency || 'UZS'),
      originalImage: resolvedImage,
      processedImages: JSON.stringify(safeProcessedImages.length > 0 ? safeProcessedImages : [resolvedImage]),
      sizes: typeof p.sizes === 'string' ? p.sizes : JSON.stringify(p.sizes || []),
      colors: typeof p.colors === 'string' ? p.colors : JSON.stringify(p.colors || []),
      gender: (p.gender as string) || undefined,
      style: (p.style as string) || undefined,
      isFeatured: Boolean(p.is_featured),
      isTrending: Boolean(p.is_trending),
    };
  });

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
                <span title="Verified Marketplace Boutique">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </span>
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
                  {store.rating || 5.0} <T k="common.rating" />
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-neutral-100 pt-4 md:pt-0 md:pl-6 text-xs text-neutral-500">
            <div><strong><T k="stores.activeItems" /></strong> {products.length} <T k="stores.published" /></div>
            <div><strong><T k="stores.status" /></strong> <span className="text-emerald-700 font-semibold"><T k="stores.statusApproved" /></span></div>
            <div><strong><T k="stores.fastDelivery" /></strong> <T k="stores.sameDay" /></div>
          </div>
        </div>
      </div>

      {/* 3. STORE CATALOG & CATEGORIES */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-neutral-900">{store.name} <T k="stores.catalogTitle" /></h2>
            <p className="text-xs text-neutral-500"><T k="stores.catalogSubtitle" /></p>
          </div>

          {/* Store Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
            <Link
              href={`/store/${store.slug}`}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 ${
                !safeSearchParams.category ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              <T k="stores.allItems" /> ({rawStoreProducts.length})
            </Link>
            {storeCategories.map((cat: any) => (
              <Link
                key={cat.id}
                href={`/store/${store.slug}?category=${cat.slug}`}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 ${
                  safeSearchParams.category === cat.slug
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
            <h3 className="text-base font-bold text-neutral-900"><T k="stores.noItemsCategory" /></h3>
            <p className="text-xs text-neutral-500"><T k="stores.checkBackSoon" /></p>
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
