'use client';

import React, { useTransition } from 'react';
import { signOutAction } from '@/app/actions/auth';
import { LogOut } from 'lucide-react';

export function SignOutButton({ className = '' }: { className?: string }) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOutAction();
    });
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl transition-colors ${
        isPending
          ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
      } ${className}`}
      title="Sign Out of your account"
    >
      <LogOut className="w-3.5 h-3.5" />
      <span>{isPending ? 'Signing out...' : 'Sign Out'}</span>
    </button>
  );
}
