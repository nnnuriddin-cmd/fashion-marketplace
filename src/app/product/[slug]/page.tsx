import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import ProductDetailClient from '@/components/customer/ProductDetailClient';
import ProductCard from '@/components/customer/ProductCard';
import { Store, ShieldCheck, MapPin, Star } from 'lucide-react';

export const revalidate = 0;

interface ProductPageProps {
  params: {
    slug: string;
  };
}

export default function ProductDetailPage({ params }: ProductPageProps) {
  const db = getDb();

  const product = db.prepare(`
    SELECT p.*, s.name as storeName, s.slug as storeSlug, s.logo as storeLogo, s.location as storeLocation, s.rating as storeRating, b.name as brandName
    FROM products p
    JOIN stores s ON p.storeId = s.id
    LEFT JOIN brands b ON p.brandId = b.id
    WHERE p.slug = ? OR p.id = ?
  `).get(params.slug, params.slug) as any;

  if (!product) {
    notFound();
  }

  // Increment views counter
  db.prepare(`UPDATE products SET viewsCount = viewsCount + 1 WHERE id = ?`).run(product.id);

  // Fetch similar products in same category
  const similarProducts = db.prepare(`
    SELECT p.*, s.name as storeName, s.slug as storeSlug
    FROM products p
    JOIN stores s ON p.storeId = s.id
    WHERE p.categoryId = ? AND p.id != ? AND p.status = 'PUBLISHED'
    LIMIT 4
  `).all(product.categoryId, product.id) as any[];

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
                {product.storeRating || 5.0} Rating
              </span>
            </p>
          </div>
        </div>

        <Link
          href={`/store/${product.storeSlug}`}
          className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition-all"
        >
          <Store className="w-4 h-4" />
          <span>Visit Storefront →</span>
        </Link>
      </section>

      {/* Similar Products Carousel */}
      {similarProducts.length > 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-serif font-bold text-neutral-900">Similar Fashion Items</h2>
            <p className="text-xs text-neutral-500">More recommendations in this category</p>
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
