'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, ShoppingBag, Store } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { useTranslation } from '@/lib/i18n/translations';

export interface ProductCardProps {
  product: {
    id: string;
    storeId: string;
    storeName?: string;
    storeSlug?: string;
    name: string;
    slug: string;
    price: number;
    discountPrice?: number | null;
    currency?: string;
    originalImage: string;
    processedImages?: string;
    sizes?: string;
    colors?: string;
    gender?: string;
    style?: string;
    isFeatured?: boolean | number;
    isTrending?: boolean | number;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const { t } = useTranslation();

  const formattedPrice = product.price.toLocaleString();
  const formattedDiscount = product.discountPrice ? product.discountPrice.toLocaleString() : null;

  let imageUrl = product.originalImage;
  if (product.processedImages) {
    try {
      const arr = JSON.parse(product.processedImages);
      if (arr && arr.length > 0) imageUrl = arr[0];
    } catch (e) {}
  }

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let sizesArr = ['M'];
    if (product.sizes) {
      try { sizesArr = JSON.parse(product.sizes); } catch (e) {}
    }

    let colorsArr = ['Beige'];
    if (product.colors) {
      try { colorsArr = JSON.parse(product.colors); } catch (e) {}
    }

    addToCart({
      productId: product.id,
      storeId: product.storeId,
      storeName: product.storeName || 'Boutique Store',
      storeSlug: product.storeSlug || 'store',
      name: product.name,
      slug: product.slug,
      image: imageUrl,
      price: product.discountPrice || product.price,
      selectedSize: sizesArr[0] || 'M',
      selectedColor: colorsArr[0] || 'Default',
      quantity: 1,
    });
  };

  return (
    <div className="group relative bg-white rounded-xl border border-neutral-200/80 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col">
      {/* Product Image Frame */}
      <Link href={`/product/${product.slug}`} className="block relative aspect-square bg-[#F8F8F8] overflow-hidden">
        <Image
          src={imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-contain p-2 group-hover:scale-105 transition-transform duration-500"
          unoptimized
        />

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
          {product.discountPrice && (
            <span className="bg-rose-600 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
              {t('nav.sale')}
            </span>
          )}
          {Boolean(product.isFeatured) && (
            <span className="bg-neutral-900 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">
              {t('product.featured')}
            </span>
          )}
        </div>

        {/* Wishlist Toggle Button */}
        <button
          type="button"
          aria-label="Save to Wishlist"
          className="absolute top-2.5 right-2.5 p-1.5 bg-white/80 backdrop-blur-md rounded-full text-neutral-600 hover:text-rose-600 transition-colors z-10 shadow-sm"
        >
          <Heart className="w-4 h-4" />
        </button>

        {/* Quick Add Overlay Button */}
        <div className="absolute inset-x-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <button
            onClick={handleQuickAdd}
            className="w-full bg-neutral-900/90 hover:bg-neutral-900 text-white text-xs font-semibold py-2 rounded-lg backdrop-blur-sm flex items-center justify-center gap-1.5 shadow-md"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{t('product.quickAdd')}</span>
          </button>
        </div>
      </Link>

      {/* Product Info */}
      <div className="p-3.5 flex-1 flex flex-col justify-between bg-white">
        <div>
          {/* Store Name Badge */}
          {product.storeName && (
            <Link
              href={`/store/${product.storeSlug || ''}`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:underline mb-1"
            >
              <Store className="w-3 h-3 text-amber-700" />
              <span className="truncate max-w-[160px]">{product.storeName}</span>
            </Link>
          )}

          <Link href={`/product/${product.slug}`} className="block">
            <h3 className="text-xs font-semibold text-neutral-900 line-clamp-2 hover:text-amber-800 transition-colors">
              {product.name}
            </h3>
          </Link>
        </div>

        {/* Pricing */}
        <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-baseline gap-2">
          {formattedDiscount ? (
            <>
              <span className="text-sm font-bold text-neutral-900">{formattedDiscount} UZS</span>
              <span className="text-xs text-neutral-400 line-through">{formattedPrice} UZS</span>
            </>
          ) : (
            <span className="text-sm font-bold text-neutral-900">{formattedPrice} UZS</span>
          )}
        </div>
      </div>
    </div>
  );
}
