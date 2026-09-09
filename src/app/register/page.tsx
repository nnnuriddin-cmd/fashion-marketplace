import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Sparkles } from 'lucide-react';

export const revalidate = 0;

export default async function RegisterPage() {
  // If already authenticated, redirect directly to /account
  const authUser = await getCurrentUser();
  if (authUser) {
    redirect('/account');
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-center space-y-6">
      <RegisterForm />

      <div className="inline-flex items-center gap-2 text-xs text-neutral-400">
        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
        <span>TrendMall Multi-Vendor Digital Fashion Marketplace</span>
      </div>
    </div>
  );
}
