import React from 'react';
import Link from 'next/link';
import { Send, ShieldCheck, Truck, RotateCcw } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-neutral-900 text-neutral-300 pt-12 pb-8 border-t border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Value Props Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pb-12 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="bg-neutral-800 p-2.5 rounded-full text-amber-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">AI Telegram Assistant</h4>
              <p className="text-xs text-neutral-400">Upload photos & publish in seconds</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-neutral-800 p-2.5 rounded-full text-amber-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Fast Local Delivery</h4>
              <p className="text-xs text-neutral-400">Directly from boutique storefronts</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-neutral-800 p-2.5 rounded-full text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Verified Boutiques</h4>
              <p className="text-xs text-neutral-400">Approved physical & Instagram stores</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-neutral-800 p-2.5 rounded-full text-amber-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Multi-Vendor Cart</h4>
              <p className="text-xs text-neutral-400">Shop from 10+ stores in 1 checkout</p>
            </div>
          </div>
        </div>

        {/* Footer Sitemap Links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 py-10">
          <div className="col-span-2">
            <Link href="/" className="text-2xl font-serif font-bold text-white tracking-tight">
              TRENDMALL
            </Link>
            <p className="mt-3 text-xs text-neutral-400 leading-relaxed max-w-sm">
              The modern multi-vendor fashion marketplace. Discover verified clothing stores, boutiques, and Instagram sellers inside one centralized digital shopping mall.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Link href="/seller/register" className="text-xs bg-amber-700 hover:bg-amber-600 text-white font-semibold px-4 py-2 rounded-md transition-colors">
                Start Selling on Telegram →
              </Link>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Shop Categories</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/search?gender=WOMEN" className="hover:text-white">Women's Fashion</Link></li>
              <li><Link href="/search?gender=MEN" className="hover:text-white">Men's Fashion</Link></li>
              <li><Link href="/search?category=shoes" className="hover:text-white">Footwear & Shoes</Link></li>
              <li><Link href="/search?category=bags" className="hover:text-white">Handbags & Totes</Link></li>
              <li><Link href="/search?category=accessories" className="hover:text-white">Accessories</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Marketplace</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/stores" className="hover:text-white">All Stores Directory</Link></li>
              <li><Link href="/search?sale=true" className="hover:text-white">Sale & Special Deals</Link></li>
              <li><Link href="/seller/register" className="hover:text-white">Seller Registration</Link></li>
              <li><Link href="/seller/dashboard" className="hover:text-white">Seller Dashboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Customer Support</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/account" className="hover:text-white">Track Orders</Link></li>
              <li><Link href="/cart" className="hover:text-white">Shopping Cart</Link></li>
              <li><Link href="/admin" className="hover:text-white">Admin Control Panel</Link></li>
              <li className="text-neutral-500">Support: +998 (90) 123-45-67</li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-neutral-800 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} TrendMall Marketplace Inc. All rights reserved. Built with AI-Powered Telegram Seller operations.
        </div>
      </div>
    </footer>
  );
}
