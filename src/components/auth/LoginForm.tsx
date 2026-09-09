'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { signInAction } from '@/app/actions/auth';
import { LogIn, Lock, Mail, AlertCircle, KeyRound, ArrowRight } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', password);

      const res = await signInAction(null, formData);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6 text-left">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <LogIn className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-serif font-bold text-neutral-900">Sign In to TrendMall</h2>
        <p className="text-xs text-neutral-500">
          Enter your email and password to access your account & orders.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-neutral-400" />
            <span>Email Address</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. anora@gmail.com"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>Password</span>
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={`w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
            isPending ? 'bg-neutral-400 cursor-not-allowed' : 'bg-neutral-900 hover:bg-neutral-800'
          }`}
        >
          {isPending ? (
            <span>Signing in...</span>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </>
          )}
        </button>
      </form>

      <div className="text-center text-xs text-neutral-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-semibold text-neutral-900 hover:underline inline-flex items-center gap-0.5"
        >
          <span>Create account</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Quick Test Accounts */}
      <div className="pt-2 border-t border-neutral-100 space-y-2">
        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
          <KeyRound className="w-3 h-3" />
          <span>Quick Sign-In (Provisioned Accounts)</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <button
            type="button"
            onClick={() => handleQuickFill('anora@gmail.com', 'customer123')}
            className="px-2 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-700 font-medium text-center truncate"
            title="Customer: anora@gmail.com"
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('seller1@trendmall.uz', 'seller123')}
            className="px-2 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-700 font-medium text-center truncate"
            title="Seller: seller1@trendmall.uz"
          >
            Seller 1
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('admin@trendmall.uz', 'admin123')}
            className="px-2 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-700 font-medium text-center truncate"
            title="Admin: admin@trendmall.uz"
          >
            Admin
          </button>
        </div>
      </div>
    </div>
  );
}
