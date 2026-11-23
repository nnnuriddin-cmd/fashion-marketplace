'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { KeyRound, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { requestPasswordResetAction } from '@/app/actions/password';
import { useTranslation, TranslationKey } from '@/lib/i18n/translations';

export function ForgotPasswordForm({ linkExpired = false }: { linkExpired?: boolean }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(linkExpired ? 'auth.resetExpiredText' : null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorKey(null);
    startTransition(async () => {
      const res = await requestPasswordResetAction(email);
      if (res.ok) setSent(true);
      else setErrorKey(res.errorKey);
    });
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6 text-left">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-serif font-bold text-neutral-900">{t('auth.forgotTitle')}</h2>
        <p className="text-xs text-neutral-500">{t('auth.forgotSubtitle')}</p>
      </div>

      {errorKey && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t(errorKey)}</span>
        </div>
      )}

      {sent ? (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>{t('auth.forgotSent')}</p>
            <p className="font-semibold">{t('auth.forgotSameBrowser')}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-neutral-400" />
              <span>{t('auth.email')}</span>
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={`w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-colors ${
              isPending ? 'bg-neutral-400 cursor-not-allowed' : 'bg-neutral-900 hover:bg-neutral-800'
            }`}
          >
            {isPending ? t('auth.forgotSending') : t('auth.forgotButton')}
          </button>
        </form>
      )}

      <div className="text-center text-xs">
        <Link href="/account" className="font-semibold text-neutral-900 hover:underline">
          {t('auth.backToLogin')}
        </Link>
      </div>
    </div>
  );
}
