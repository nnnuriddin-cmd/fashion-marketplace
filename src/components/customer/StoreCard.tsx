import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, MapPin, CheckCircle } from 'lucide-react';

export interface StoreCardProps {
  store: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    logo?: string | null;
    coverImage?: string | null;
    location?: string | null;
    rating?: number;
    status?: string;
  };
}

export default function StoreCard({ store }: StoreCardProps) {
  return (
    <Link
      href={`/store/${store.slug}`}
      className="group bg-white rounded-xl border border-neutral-200 overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col"
    >
      {/* Cover Image Header */}
      <div className="relative h-24 bg-neutral-800 overflow-hidden">
        {store.coverImage ? (
          <Image
            src={store.coverImage}
            alt={store.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
            unoptimized
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-neutral-800 to-neutral-900" />
        )}
      </div>

      {/* Logo & Store Information */}
      <div className="px-4 pb-4 pt-0 relative flex-1 flex flex-col justify-between">
        <div>
          {/* Logo Badge */}
          <div className="-mt-7 mb-2 relative w-14 h-14 rounded-full border-2 border-white bg-white overflow-hidden shadow-sm">
            {store.logo ? (
              <Image src={store.logo} alt={store.name} fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full bg-neutral-900 text-white font-bold flex items-center justify-center text-lg">
                {store.name.charAt(0)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-neutral-900 group-hover:text-amber-800 transition-colors">
              {store.name}
            </h3>
            <span title="Verified Marketplace Store">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            </span>
          </div>

          {store.description && (
            <p className="mt-1 text-xs text-neutral-500 line-clamp-2 leading-relaxed">
              {store.description}
            </p>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-600">
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-neutral-400" />
            <span className="truncate max-w-[140px]">{store.location || 'Tashkent'}</span>
          </div>

          <div className="flex items-center gap-1 font-semibold text-amber-800">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{store.rating || 5.0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
