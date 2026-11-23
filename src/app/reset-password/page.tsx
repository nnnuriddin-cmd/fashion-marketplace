import React from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { T } from '@/lib/i18n/translations';

export const revalidate = 0;

/** Reached from the password reset email (via /auth/callback, which signs the user in). */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {user ? (
        <ResetPasswordForm email={user.email || ''} />
      ) : (
        <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-serif font-bold text-neutral-900"><T k="auth.resetExpiredTitle" /></h2>
          <p className="text-xs text-neutral-500"><T k="auth.resetExpiredText" /></p>
          <Link
            href="/forgot-password"
            className="inline-block w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800"
          >
            <T k="auth.requestNewLink" />
          </Link>
        </div>
      )}
    </div>
  );
}
