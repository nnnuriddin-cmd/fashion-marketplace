import React from 'react';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const revalidate = 0;

export default function ForgotPasswordPage({ searchParams }: { searchParams?: { expired?: string } }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <ForgotPasswordForm linkExpired={searchParams?.expired === '1'} />
    </div>
  );
}
