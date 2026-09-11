'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import { ShoppingBag, Heart, Store, Truck, ShieldCheck, Check, Sparkles, Share2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/translations';

export default function ProductDetailClient({ product }: { product: any }) {
  const { addToCart } = useCart();
  const { t } = useTranslation();

  let images: string[] = [product.originalImage];
  if (product.processedImages) {
    try {
      const parsed = JSON.parse(product.processedImages);
      if (Array.isArray(parsed) && parsed.length > 0) images = parsed;
    } catch (e) {}
  }

  let sizes: string[] = ['S', 'M', 'L'];
  if (product.sizes) {
    try { sizes = JSON.parse(product.sizes); } catch (e) {}
  }

  let colors: string[] = ['Default'];
  if (product.colors) {
    try { colors = JSON.parse(product.colors); } catch (e) {}
  }

  let tags: string[] = [];
  if (product.tags) {
    try { tags = JSON.parse(product.tags); } catch (e) {}
  }

  const [selectedImage, setSelectedImage] = useState(images[0] || product.originalImage);
  const [selectedSize, setSelectedSize] = useState(sizes[0] || 'M');
  const [selectedColor, setSelectedColor] = useState(colors[0] || 'Default');
  const [quantity, setQuantity] = useState(1);
  const [addedAlert, setAddedAlert] = useState(false);

  const price = product.discountPrice || product.price;

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      storeId: product.storeId,
      storeName: product.storeName || 'Boutique Store',
      storeSlug: product.storeSlug || 'store',
      name: product.name,
      slug: product.slug,
      image: selectedImage,
      price,
      selectedSize,
      selectedColor,
      quantity,
    });

    setAddedAlert(true);
    setTimeout(() => setAddedAlert(false), 3000);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    window.location.href = '/checkout';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm">
      {/* Left Gallery (7 cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Main Studio Frame */}
        <div className="relative aspect-square bg-[#F8F8F8] rounded-2xl overflow-hidden border border-neutral-200/80 studio-image-frame">
          <Image
            src={selectedImage}
            alt={product.name}
            fill
            priority
            className="object-contain p-4"
            unoptimized
          />

          <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
            {product.discountPrice && (
              <span className="bg-rose-600 text-white text-xs font-bold px-2.5 py-1 rounded">
                {t('common.saveAmount')} {(product.price - product.discountPrice).toLocaleString()} {t('common.uzs')}
              </span>
            )}
            <span className="bg-neutral-900/90 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> {t('product.studioProcessed')}
            </span>
          </div>
        </div>

        {/* Thumbnails Row */}
        {images.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(img)}
                className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all bg-[#F8F8F8] shrink-0 ${
                  selectedImage === img ? 'border-neutral-900 scale-95' : 'border-neutral-200 opacity-70 hover:opacity-100'
                }`}
              >
                <Image src={img} alt="" fill className="object-contain p-1" unoptimized />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Commercial Actions (5 cols) */}
      <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Store & Brand Header */}
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <Link
              href={`/store/${product.storeSlug}`}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:underline"
            >
              <Store className="w-4 h-4 text-amber-700" />
              <span>{product.storeName}</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            </Link>

            {product.brandName && (
              <span className="text-xs font-semibold bg-neutral-100 text-neutral-700 px-2.5 py-0.5 rounded-full">
                {product.brandName}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-neutral-900 leading-snug">
            {product.name}
          </h1>

          {/* Pricing */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-neutral-900">{price.toLocaleString()} UZS</span>
            {product.discountPrice && (
              <span className="text-base text-neutral-400 line-through">
                {product.price.toLocaleString()} UZS
              </span>
            )}
          </div>

          {/* Stock Availability */}
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-emerald-700 font-semibold">
              {t('product.inStock')} ({product.stockQuantity || 10})
            </span>
          </div>

          <hr className="border-neutral-100" />

          {/* Size Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-900 uppercase tracking-wider">{t('product.selectSize')}</span>
              <span className="text-neutral-500 font-medium">{selectedSize}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSize(s)}
                  className={`min-w-[44px] h-10 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    selectedSize === s
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                      : 'bg-neutral-50 text-neutral-800 border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selector */}
          {colors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-900 uppercase tracking-wider">{t('product.selectColor')}</span>
                <span className="text-neutral-500 font-medium">{selectedColor}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      selectedColor === c
                        ? 'bg-amber-800 text-white border-amber-800'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-neutral-900 uppercase tracking-wider">{t('product.quantity')}</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-9 h-9 flex items-center justify-center text-neutral-600 font-bold hover:bg-neutral-200 rounded-l-xl"
                >
                  -
                </button>
                <span className="w-10 text-center text-xs font-bold text-neutral-900">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-9 h-9 flex items-center justify-center text-neutral-600 font-bold hover:bg-neutral-200 rounded-r-xl"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4 border-t border-neutral-100">
          {addedAlert && (
            <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{t('product.addedToCartAlert')}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all shadow-md"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{t('product.addToCart')}</span>
            </button>

            <button
              onClick={handleBuyNow}
              className="flex-1 bg-amber-800 hover:bg-amber-700 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all shadow-md"
            >
              <span>{t('product.buyNow')}</span>
            </button>
          </div>
        </div>

        {/* Product Meta Details */}
        <div className="bg-neutral-50 p-4 rounded-2xl text-xs space-y-2 border border-neutral-200/80">
          <h4 className="font-bold text-neutral-900">{t('product.specifications')}</h4>
          <p className="text-neutral-600 leading-relaxed">{product.description}</p>
          <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-neutral-600">
            {product.material && <div><strong>Material:</strong> {product.material}</div>}
            {product.style && <div><strong>Style:</strong> {product.style}</div>}
            {product.occasion && <div><strong>Occasion:</strong> {product.occasion}</div>}
            {product.season && <div><strong>Season:</strong> {product.season}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
