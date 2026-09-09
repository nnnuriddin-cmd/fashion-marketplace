'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { signUpAction } from '@/app/actions/auth';
import { UserPlus, User, Mail, Phone, Lock, AlertCircle, ArrowRight } from 'lucide-react';

export function RegisterForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Client-side validation checks
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('email', email);
      if (phone.trim()) {
        formData.append('phone', phone);
      }
      formData.append('password', password);
      formData.append('confirmPassword', confirmPassword);

      const res = await signUpAction(null, formData);
      if (res?.error) {
        setError(res.error);
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6 text-left">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
          <UserPlus className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-serif font-bold text-neutral-900">Create Your Account</h2>
        <p className="text-xs text-neutral-500">
          Join TrendMall to explore curated collections and track your orders.
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
            <User className="w-3.5 h-3.5 text-neutral-400" />
            <span>Full Name <span className="text-rose-500">*</span></span>
          </label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Jasur Aliyev"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-neutral-400" />
            <span>Email Address <span className="text-rose-500">*</span></span>
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. jasur@example.com"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-neutral-400" />
            <span>Phone Number <span className="text-neutral-400 font-normal">(optional)</span></span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +998 90 123 45 67"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>Password <span className="text-rose-500">*</span></span>
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 6 characters"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>Confirm Password <span className="text-rose-500">*</span></span>
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            className="w-full px-3.5 py-2 text-xs border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={'w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-colors flex items-center justify-center gap-2 ' + (isPending ? 'bg-neutral-400 cursor-not-allowed' : 'bg-neutral-900 hover:bg-neutral-800')}
        >
          {isPending ? (
            <span>Creating account...</span>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </>
          )}
        </button>
      </form>

      <div className="pt-4 border-t border-neutral-100 text-center text-xs text-neutral-500">
        Already have an account?{' '}
        <Link
          href="/account"
          className="font-semibold text-neutral-900 hover:underline inline-flex items-center gap-0.5"
        >
          <span>Sign In</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
