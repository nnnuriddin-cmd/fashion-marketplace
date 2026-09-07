import React from 'react';
import { getDb } from '@/lib/db';
import StoreCard from '@/components/customer/StoreCard';
import { Store as StoreIcon, ShieldCheck } from 'lucide-react';

export const revalidate = 0;

export default function StoresDirectoryPage() {
  const db = getDb();
  const stores = db.prepare(`SELECT * FROM stores WHERE status = 'APPROVED' ORDER BY rating DESC`).all() as any[];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Multi-Vendor Fashion Mall</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-neutral-900">All Stores & Boutiques</h1>
        <p className="text-xs text-neutral-500 max-w-xl">
          Explore physical clothing stores, Instagram sellers, and artisan fashion ateliers selling on TrendMall.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {stores.map((store) => (
          <StoreCard key={store.id} store={store} />
        ))}
      </div>
    </div>
  );
}
