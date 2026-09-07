'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Send, Store, ShieldCheck, CheckCircle } from 'lucide-react';

export default function SellerRegisterPage() {
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('+998909876543');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Yakkasaray, Tashkent');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="bg-emerald-100 text-emerald-700 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
          <CheckCircle className="w-12 h-12" />
        </div>

        <h1 className="text-3xl font-serif font-bold text-neutral-900">Seller Registration Submitted!</h1>
        <p className="text-sm text-neutral-600">
          Thank you for registering <strong>{storeName}</strong>! Your application is now in <strong>PENDING</strong> review status.
        </p>

        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl text-left text-xs text-amber-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
            <Send className="w-4 h-4 text-amber-700" />
            <span>Connect your Telegram Bot</span>
          </div>
          <p>Marketplace Admins will review and approve your store shortly.</p>
          <p>In the meantime, link your Telegram account to start listing clothing items using AI!</p>
        </div>

        <div className="pt-2 flex justify-center gap-4">
          <Link href="/seller/dashboard" className="bg-neutral-900 text-white font-semibold text-xs px-6 py-3 rounded-full hover:bg-neutral-800">
            Open Seller Dashboard →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
      <div className="bg-neutral-900 text-white p-8 rounded-3xl space-y-3 relative overflow-hidden">
        <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold">
          <Send className="w-3.5 h-3.5" />
          <span>AI-Powered Telegram Seller Assistant</span>
        </div>
        <h1 className="text-3xl font-serif font-bold tracking-tight">Open Your Digital Boutique</h1>
        <p className="text-xs text-neutral-300 max-w-xl leading-relaxed">
          Create your digital storefront inside TrendMall. Take a photo, send to Telegram, AI creates the product listing automatically!
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-6">
        <h3 className="text-lg font-serif font-bold text-neutral-900 border-b border-neutral-100 pb-3">
          Store Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Store / Boutique Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Silk & Thread Boutique"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Owner Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Malika Azizova"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Business Phone Number</label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">Telegram Username / Phone</label>
            <input
              type="text"
              placeholder="e.g. silk_thread_uz"
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Store Physical Location / District</label>
          <input
            type="text"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Store Description & Fashion Bio</label>
          <textarea
            rows={3}
            placeholder="Tell customers about your clothing collections..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 text-xs focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-neutral-900 hover:bg-neutral-800 text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md"
        >
          Submit Store Application →
        </button>
      </form>
    </div>
  );
}
