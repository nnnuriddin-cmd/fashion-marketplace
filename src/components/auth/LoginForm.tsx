'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { signInAction } from '@/app/actions/auth';
import { LogIn, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/translations';

export function LoginForm() {
  const { t } = useTranslation();
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

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6 text-left">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <LogIn className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-serif font-bold text-neutral-900">{t('auth.signInTitle')}</h2>
        <p className="text-xs text-neutral-500">
          {t('auth.signInSubtitle')}
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
            <span>{t('auth.email')}</span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>{t('auth.password')}</span>
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
            <span>{t('auth.signingIn')}</span>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>{t('auth.signInButton')}</span>
            </>
          )}
        </button>
      </form>

      <div className="text-center text-xs text-neutral-500">
        {t('auth.noAccount')}{' '}
        <Link
          href="/register"
          className="font-semibold text-neutral-900 hover:underline inline-flex items-center gap-0.5"
        >
          <span>{t('auth.registerHere')}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
