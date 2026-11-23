'use client';

import React, { useState, useTransition } from 'react';
import { Lock, AlertCircle, ShieldCheck } from 'lucide-react';
import { updatePasswordAction } from '@/app/actions/password';
import { useTranslation, TranslationKey } from '@/lib/i18n/translations';

export function ResetPasswordForm({ email }: { email: string }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorKey(null);
    if (password.length < 6) return setErrorKey('auth.passwordTooShort');
    if (password !== confirmPassword) return setErrorKey('auth.passwordsMismatch');

    startTransition(async () => {
      // On success the action redirects to /account
      const res = await updatePasswordAction(password, confirmPassword);
      if (res && !res.ok) setErrorKey(res.errorKey);
    });
  };

  const inputClass =
    'w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900';

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6 text-left">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-serif font-bold text-neutral-900">{t('auth.resetTitle')}</h2>
        <p className="text-xs text-neutral-500">{t('auth.resetSubtitle')}</p>
        <p className="text-xs font-semibold text-neutral-700 break-all">{email}</p>
      </div>

      {errorKey && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{t(errorKey)}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hidden username helps password managers save the new password for the right account */}
        <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>{t('auth.newPassword')}</span>
          </label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>{t('auth.confirmPassword')}</span>
          </label>
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={`w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-colors ${
            isPending ? 'bg-neutral-400 cursor-not-allowed' : 'bg-neutral-900 hover:bg-neutral-800'
          }`}
        >
          {isPending ? t('auth.resetSaving') : t('auth.resetButton')}
        </button>
      </form>
    </div>
  );
}
