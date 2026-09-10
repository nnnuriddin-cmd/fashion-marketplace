'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Send, Sparkles, CheckCircle, Upload, ShieldCheck } from 'lucide-react';

export default function SellerTelegramGuidePage() {
  const [simulatedPhotoUrl, setSimulatedPhotoUrl] = useState('https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80');
  const [commercialInput, setCommercialInput] = useState('450000 S M L 10');
  const [simStep, setSimStep] = useState<'IDLE' | 'PROCESSING' | 'WAITING_DETAILS' | 'READY_PUBLISH' | 'PUBLISHED'>('IDLE');
  const [aiOutput, setAiOutput] = useState<any>(null);

  const handleSimulatePhotoUpload = () => {
    setSimStep('PROCESSING');
    setTimeout(() => {
      setSimStep('WAITING_DETAILS');
    }, 500);
  };

  const handleSimulateTextSubmit = () => {
    setSimStep('PROCESSING');
    setTimeout(() => {
      setSimStep('READY_PUBLISH');
    }, 500);
  };

  const handleSimulatePublish = () => {
    setSimStep('PROCESSING');
    setTimeout(() => {
      setSimStep('PUBLISHED');
    }, 600);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      {/* Header Banner */}
      <div className="bg-neutral-900 text-white p-8 rounded-3xl space-y-3 relative overflow-hidden shadow-lg">
        <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-full text-xs font-semibold">
          <Send className="w-3.5 h-3.5 text-amber-400" />
          <span>Telegram Seller Bot Pairings</span>
        </div>

        <h1 className="text-3xl font-serif font-bold tracking-tight">AI Telegram Seller Assistant</h1>

        <p className="text-xs text-neutral-300 max-w-xl leading-relaxed">
          Manage your boutique storefront, create new catalog products from smartphone photos, and receive instant customer order notifications via Telegram.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Connection Code Card (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-neutral-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Pair Your Telegram Account</span>
            </h3>

            <p className="text-xs text-neutral-500">
              To connect your Telegram account, visit your Account Dashboard to generate a secure one-time linking code:
            </p>

            <div className="bg-neutral-900 text-white p-4 rounded-2xl text-center space-y-2">
              <div className="text-xs text-neutral-400 font-mono">SELLER BOT ONBOARDING:</div>
              <Link
                href="/account"
                className="inline-block bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl transition-colors"
              >
                Go to Account to Link Telegram →
              </Link>
              <div className="text-[10px] text-neutral-400">Generate code → send /link CODE to @Modorauzbot</div>
            </div>

            <div className="pt-2 text-xs space-y-2 text-neutral-600 border-t border-neutral-100">
              <div className="font-bold text-neutral-900">Bot Menu Capabilities:</div>
              <ul className="space-y-1 text-neutral-500">
                <li>• <code>➕ Add Product</code>: Photo → AI BG removal → Publish</li>
                <li>• <code>📦 My Products</code>: Active inventory overview</li>
                <li>• <code>🛍 Orders</code>: Real-time customer order cards</li>
                <li>• <code>📊 Sales Analytics</code>: Daily &amp; monthly revenue</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Live Telegram AI Simulator (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-neutral-950 text-white p-6 rounded-3xl border border-neutral-800 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-white font-mono">Telegram AI Workflow Simulator</h3>
              </div>
              <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-mono">INTERACTIVE PREVIEW</span>
            </div>

            <p className="text-xs text-neutral-400">
              Test how the AI receives phone photos, removes backgrounds, extracts attributes, and publishes live to the storefront.
            </p>

            {/* Step 1: Upload Photo */}
            <div className="space-y-3 bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-400 font-mono">STEP 1: Send Photo</span>
                <span className="text-neutral-400 text-[11px]">Raw Phone Photo</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={simulatedPhotoUrl}
                  onChange={(e) => setSimulatedPhotoUrl(e.target.value)}
                  className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
                <button
                  onClick={handleSimulatePhotoUpload}
                  disabled={simStep === 'PROCESSING'}
                  className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Send Photo</span>
                </button>
              </div>
            </div>

            {/* Step 2: Commercial Input */}
            {(simStep === 'WAITING_DETAILS' || simStep === 'READY_PUBLISH' || simStep === 'PUBLISHED') && (
              <div className="space-y-3 bg-neutral-900 p-4 rounded-2xl border border-neutral-800 animate-fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-sky-400 font-mono">STEP 2: Enter Price, Sizes, Stock</span>
                  <span className="text-emerald-400 text-[11px]">✓ AI BG Removal Complete</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commercialInput}
                    onChange={(e) => setCommercialInput(e.target.value)}
                    placeholder="e.g. 450000 S M L 10"
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                  <button
                    onClick={handleSimulateTextSubmit}
                    className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2 rounded-xl"
                  >
                    Submit Info
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Publish Button */}
            {(simStep === 'READY_PUBLISH' || simStep === 'PUBLISHED') && (
              <div className="space-y-3 bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
                <div className="text-xs font-bold text-amber-300 font-mono">STEP 3: Interactive Telegram Card</div>

                {simStep === 'PUBLISHED' ? (
                  <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 p-4 rounded-xl text-xs space-y-1">
                    <div className="font-bold text-sm flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>🚀 Product Published Live to Marketplace!</span>
                    </div>
                    <p>Item is now visible on your store page and customer search results.</p>
                  </div>
                ) : (
                  <button
                    onClick={handleSimulatePublish}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>🚀 Publish Now to TrendMall</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
