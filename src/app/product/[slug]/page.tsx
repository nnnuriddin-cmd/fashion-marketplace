import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProductDetailClient from '@/components/customer/ProductDetailClient';
import ProductCard from '@/components/customer/ProductCard';
import { Store, ShieldCheck, MapPin, Star } from 'lucide-react';
import { T } from '@/lib/i18n/translations';

export const revalidate = 0;

interface ProductPageProps {
  params: {
    slug: string;
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  if (!params?.slug) {
    notFound();
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.slug);

  let rawProduct: any = null;
  try {
    let query = supabase
      .from('products')
      .select('*, stores(id, name, slug, logo, location, rating, phone, telegram_username)');

    if (isUuid) {
      query = query.eq('id', params.slug);
    } else {
      query = query.eq('slug', params.slug);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error('Error fetching product from Supabase:', error);
    }
    rawProduct = data;
  } catch (err) {
    console.error('Unexpected error fetching product:', err);
    rawProduct = null;
  }

  if (!rawProduct) {
    notFound();
  }

  const fallbackImage = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80';
  const rawImageCandidate = rawProduct.original_image || rawProduct.image || rawProduct.originalImage;
  const resolvedImage = typeof rawImageCandidate === 'string' && rawImageCandidate.trim() !== ''
    ? rawImageCandidate.trim()
    : fallbackImage;

  let safeProcessedImages: string[] = [];
  if (Array.isArray(rawProduct.processed_images)) {
    safeProcessedImages = rawProduct.processed_images.filter((img: any) => typeof img === 'string' && img.trim() !== '');
  } else if (typeof rawProduct.processed_images === 'string') {
    try {
      const parsed = JSON.parse(rawProduct.processed_images);
      if (Array.isArray(parsed)) {
        safeProcessedImages = parsed.filter((img: any) => typeof img === 'string' && img.trim() !== '');
      }
    } catch {
      safeProcessedImages = [];
    }
  }
  if (safeProcessedImages.length === 0) {
    safeProcessedImages = [resolvedImage];
  }

  const product = {
    ...rawProduct,
    id: String(rawProduct.id),
    name: String(rawProduct.title || rawProduct.name || 'Product'),
    title: String(rawProduct.title || rawProduct.name || 'Product'),
    price: Number(rawProduct.price || 0),
    discountPrice: rawProduct.discount_price !== null && rawProduct.discount_price !== undefined
      ? Number(rawProduct.discount_price)
      : (rawProduct.discountPrice ? Number(rawProduct.discountPrice) : null),
    originalImage: resolvedImage,
    processedImages: JSON.stringify(safeProcessedImages),
    sizes: typeof rawProduct.sizes === 'string' ? rawProduct.sizes : JSON.stringify(rawProduct.sizes || ['S', 'M', 'L']),
    colors: typeof rawProduct.colors === 'string' ? rawProduct.colors : JSON.stringify(rawProduct.colors || ['Default']),
    tags: typeof rawProduct.tags === 'string' ? rawProduct.tags : JSON.stringify(rawProduct.tags || []),
    storeId: rawProduct.stores?.id || rawProduct.store_id,
    storeName: rawProduct.stores?.name || 'Boutique Store',
    storeSlug: rawProduct.stores?.slug || 'store',
    storeLogo: rawProduct.stores?.logo || null,
    storeLocation: rawProduct.stores?.location || 'Tashkent',
    storeRating: rawProduct.stores?.rating || 5.0,
    storePhone: rawProduct.stores?.phone || null,
    storeTelegram: rawProduct.stores?.telegram_username || null,
    stockQuantity: rawProduct.stock_quantity ?? rawProduct.stockQuantity ?? 0,
    isFeatured: Boolean(rawProduct.is_featured ?? rawProduct.isFeatured),
    isTrending: Boolean(rawProduct.is_trending ?? rawProduct.isTrending),
  };

  let similarProducts: any[] = [];
  try {
    const { data: similarData, error: similarError } = await supabase
      .from('products')
      .select('*, stores(name, slug, logo, location, rating)')
      .eq('category_id', rawProduct.category_id)
      .neq('id', rawProduct.id)
      .eq('status', 'ACTIVE')
      .limit(4);

    if (similarError) {
      console.error('Error fetching similar products from Supabase:', similarError);
    } else if (similarData) {
      similarProducts = similarData.map((p: any) => {
        const storeObj = p.stores as { name?: string; slug?: string } | undefined;
        const pImageCandidate = p.original_image || p.image || p.originalImage;
        const pResolvedImage = typeof pImageCandidate === 'string' && pImageCandidate.trim() !== ''
          ? pImageCandidate.trim()
          : fallbackImage;

        let pSafeProcessed: string[] = [];
        if (Array.isArray(p.processed_images)) {
          pSafeProcessed = p.processed_images.filter((img: any) => typeof img === 'string' && img.trim() !== '');
        } else if (typeof p.processed_images === 'string') {
          try {
            const parsed = JSON.parse(p.processed_images);
            if (Array.isArray(parsed)) {
              pSafeProcessed = parsed.filter((img: any) => typeof img === 'string' && img.trim() !== '');
            }
          } catch {}
        }

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
          originalImage: pResolvedImage,
          processedImages: JSON.stringify(pSafeProcessed.length > 0 ? pSafeProcessed : [pResolvedImage]),
          sizes: typeof p.sizes === 'string' ? p.sizes : JSON.stringify(p.sizes || []),
          colors: typeof p.colors === 'string' ? p.colors : JSON.stringify(p.colors || []),
          gender: p.gender || undefined,
          style: p.style || undefined,
          isFeatured: Boolean(p.is_featured),
          isTrending: Boolean(p.is_trending),
        };
      });
    }
  } catch (similarErr) {
    console.error('Unexpected error fetching similar products:', similarErr);
    similarProducts = [];
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      {/* Product Detail Layout */}
      <ProductDetailClient product={product} />

      {/* Store Information Card */}
      <section className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full border border-neutral-200 overflow-hidden bg-neutral-100 shrink-0">
            {product.storeLogo ? (
              <Image src={product.storeLogo} alt={product.storeName} fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full bg-neutral-900 text-white font-bold flex items-center justify-center text-xl">
                {product.storeName?.charAt(0)}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-neutral-900">{product.storeName}</h3>
              <span title="Verified Marketplace Store">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </span>
            </div>
            <p className="text-xs text-neutral-500 flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                {product.storeLocation || 'Tashkent'}
              </span>
              <span className="flex items-center gap-1 font-semibold text-amber-800">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {product.storeRating || 5.0} <T k="common.rating" />
              </span>
            </p>
          </div>
        </div>

        <Link
          href={`/store/${product.storeSlug}`}
          className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all"
        >
          <Store className="w-4 h-4" />
          <span><T k="product.visitStorefront" /></span>
        </Link>
      </section>

      {/* Similar Products Carousel */}
      {similarProducts.length > 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-serif font-bold text-neutral-900"><T k="product.similarItems" /></h2>
            <p className="text-xs text-neutral-500"><T k="product.similarItemsDesc" /></p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {similarProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
