'use client';

import React, { useState, useEffect } from 'react';
import { Send, ShieldCheck, Copy, Check, AlertCircle, RefreshCw, Unlink, ExternalLink } from 'lucide-react';
import { generateTelegramLinkCode, unlinkTelegramAccount } from '@/app/actions/telegram';

interface TelegramConnectCardProps {
  isLinked: boolean;
  storeName?: string | null;
  telegramUsername?: string | null;
}

export function TelegramConnectCard({
  isLinked: initialLinked,
  storeName,
  telegramUsername,
}: TelegramConnectCardProps) {
  const [isLinked, setIsLinked] = useState(initialLinked);
  const [loading, setLoading] = useState(false);
  const [unlinkLoading, setUnlinkLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Countdown timer for code expiry
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        setCode(null);
        setExpiresAt(null);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleGenerateCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateTelegramLinkCode();
      if (res.success && res.code && res.expiresAt) {
        setCode(res.code);
        setExpiresAt(res.expiresAt);
      } else {
        setError(res.error || 'Failed to generate linking code.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to disconnect your Telegram account from TrendMall? You will no longer receive order alerts.')) {
      return;
    }

    setUnlinkLoading(true);
    setError(null);
    try {
      const res = await unlinkTelegramAccount();
      if (res.success) {
        setIsLinked(false);
        setCode(null);
        setExpiresAt(null);
      } else {
        setError(res.error || 'Failed to disconnect Telegram.');
      }
    } catch (err) {
      setError('Failed to disconnect Telegram. Please try again.');
    } finally {
      setUnlinkLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center border border-sky-100">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-serif font-bold text-neutral-900">Telegram Seller Bot</h2>
            <p className="text-xs text-neutral-500">
              Instant order alerts & smartphone product publishing
            </p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {isLinked ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Connected</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
              <span>Not Connected</span>
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLinked ? (
        /* Connected state */
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-1 text-xs text-emerald-900">
            <div className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Bot Connected to {storeName || 'Your Store'}</span>
            </div>
            <p className="text-emerald-700 text-[11px] leading-relaxed">
              Your Telegram account receives instant push notifications when customers place new orders, and you can upload clothing photos directly to your catalog.
            </p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <a
              href="https://t.me/Modorauzbot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800"
            >
              <span>Open @Modorauzbot</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={handleUnlink}
              disabled={unlinkLoading}
              className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors disabled:opacity-50"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>{unlinkLoading ? 'Disconnecting...' : 'Disconnect Telegram'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Disconnected state */
        <div className="space-y-4">
          <p className="text-xs text-neutral-600 leading-relaxed">
            Connect your personal Telegram account to manage your boutique from your phone. You will receive real-time order alerts and can create products simply by sending clothing photos.
          </p>

          {code ? (
            /* Active Code Display */
            <div className="p-5 bg-neutral-900 text-white rounded-2xl space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-neutral-400">ONE-TIME LINKING CODE:</span>
                <span className="font-mono text-amber-400 font-bold">
                  Expires in {formatTime(secondsRemaining)}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-neutral-950 rounded-xl border border-neutral-800">
                <span className="font-mono text-xs sm:text-sm font-bold tracking-wider text-amber-400 break-all select-all leading-relaxed">
                  {code}
                </span>
                <button
                  onClick={handleCopy}
                  title="Copy Code"
                  className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors text-xs font-semibold"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              <div className="border-t border-neutral-800 pt-3 text-[11px] text-neutral-300 space-y-1.5">
                <p className="font-medium text-white">How to connect:</p>
                <ol className="list-decimal list-inside space-y-1 text-neutral-400">
                  <li>
                    Tap <strong>Open in Telegram</strong> below (recommended — automatically enters your code)
                  </li>
                  <li>
                    Or send manually to <strong>@Modorauzbot</strong>:
                    <div className="mt-1 font-mono text-[10px] text-amber-300 bg-neutral-950 p-2 rounded break-all select-all">
                      /link {code}
                    </div>
                  </li>
                  <li>The bot will instantly confirm your connection!</li>
                </ol>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <a
                  href={`https://t.me/Modorauzbot?start=${code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto text-center bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider px-5 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Open in Telegram</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  onClick={handleGenerateCode}
                  disabled={loading}
                  className="w-full sm:w-auto text-xs text-neutral-400 hover:text-white px-3 py-2 transition-colors flex items-center justify-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Generate Fresh Code</span>
                </button>
              </div>
            </div>
          ) : (
            /* Button to generate code */
            <div>
              <button
                onClick={handleGenerateCode}
                disabled={loading}
                className="bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors inline-flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-sky-400" />
                <span>{loading ? 'Generating Code...' : 'Connect Telegram'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
