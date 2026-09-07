'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Store, Check, X, Ban, ShieldCheck } from 'lucide-react';

export default function AdminStoreApprover({ initialStores }: { initialStores: any[] }) {
  const [stores, setStores] = useState(initialStores);

  const handleUpdateStatus = async (storeId: string, action: 'APPROVE' | 'REJECT' | 'SUSPEND') => {
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, action }),
      });
      const data = await res.json();
      if (data.success) {
        setStores(
          stores.map((s) => (s.id === storeId ? { ...s, status: data.status } : s))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-neutral-200 p-6 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <h3 className="text-lg font-serif font-bold text-neutral-900 flex items-center gap-2">
          <Store className="w-5 h-5 text-amber-800" />
          <span>Seller Onboarding & Store Approval Queue</span>
        </h3>
        <span className="text-xs font-semibold text-neutral-500">{stores.length} Registered Stores</span>
      </div>

      <div className="divide-y divide-neutral-100">
        {stores.map((s) => (
          <div key={s.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <Link href={`/store/${s.slug}`} className="font-bold text-neutral-900 text-sm hover:underline">
                  {s.name}
                </Link>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  s.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                  s.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                  'bg-rose-100 text-rose-800'
                }`}>
                  {s.status}
                </span>
              </div>

              <div className="text-neutral-600">Owner: <strong>{s.ownerName}</strong> ({s.ownerEmail})</div>
              <div className="text-neutral-500">{s.location || 'Tashkent'} • Commission Rate: {s.commissionRate}%</div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {s.status !== 'APPROVED' && (
                <button
                  onClick={() => handleUpdateStatus(s.id, 'APPROVE')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>
              )}

              {s.status !== 'SUSPENDED' && (
                <button
                  onClick={() => handleUpdateStatus(s.id, 'SUSPEND')}
                  className="bg-rose-100 text-rose-700 hover:bg-rose-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Suspend</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
