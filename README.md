# TrendMall | Multi-Vendor AI-Powered Digital Fashion Marketplace

TrendMall is a modern, full-stack multi-vendor digital fashion shopping mall designed for physical clothing stores, boutiques, designer brands, and Instagram-based fashion sellers.

The core differentiator is an **AI-powered Telegram Seller Assistant**:
> *"Take a photo → Send to Telegram Bot → AI removes background, formats image & extracts attributes → Seller inputs price/stock → Live on marketplace!"*

---

## 🌟 Core Architecture Highlights

1. **Customer Web Storefront (`Next.js 14 App Router + Tailwind CSS + Lucide`)**:
   - Fashion-focused Hero section, Category chips, Store discovery grid.
   - Multi-faceted Product Search & Filter Engine (Keywords, Category, Subcategory, Gender, Price Range, Brand, Store, Color, Size, Sale, Style, Occasion, Sorting).
   - Prepared for future AI Semantic Search ("black elegant women's dress for wedding under $100").
   - Individual Storefront Pages (`/store/[slug]`) and Product Detail Pages (`/product/[slug]`).
2. **Multi-Vendor Parent/Child Order Engine**:
   - Single customer checkout supports items from multiple stores simultaneously.
   - Generates 1 `ParentOrder` (e.g. `ORD-10001`) and isolated `SellerOrder`s (`ORD-10001-A`, `ORD-10001-B`) with automated seller commission calculations.
3. **AI Telegram Seller Assistant & Processing Pipeline**:
   - Integrated with Gemini Vision AI + Sharp studio image processing.
   - Isolates clothing item, places on standardized studio background (`1000x1000 square WebP format`).
   - Generates product title, category, gender, color, style, material, description, and search tags.
   - Interactive Telegram inline confirmation card: `[ 🚀 Publish Now ]`.
4. **Real-time Event-Driven Telegram Notifications**:
   - Instant order alerts to seller Telegram with inline `[ ✅ Accept Order ]` and `[ ❌ Reject Order ]` buttons.
   - Customer status updates (`CONFIRMED`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`).
5. **Seller Dashboard (`/seller`) & Admin Moderation Panel (`/admin`)**:
   - Store registration & approval workflow (`PENDING` → `APPROVED` / `SUSPENDED`).
   - Sales metrics, GMV tracking, marketplace commission reports.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+)
- npm or yarn

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Initialize database schema & seed 100+ fashion products across 10 stores
npm run seed

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠 Project Structure

```
fashion-marketplace/
├── src/
│   ├── app/
│   │   ├── (customer)/             # Customer pages (Homepage, Search, Product, Store, Cart, Checkout)
│   │   ├── seller/                 # Seller onboarding, Dashboard & Telegram guide
│   │   ├── admin/                  # Admin master control panel & approvals
│   │   └── api/                    # REST APIs (Checkout, Telegram Webhook, AI image processor)
│   ├── components/                 # UI Components (ProductCard, StoreCard, Navbar, Footer, AdminApprover)
│   ├── lib/
│   │   ├── db/                     # SQLite / PostgreSQL schema & database instance
│   │   ├── ai/                     # Vision AI analyzer & Sharp image background processor
│   │   ├── telegram/               # Telegram Bot handler & notification publisher
│   │   └── cart-context.tsx        # Multi-vendor store-grouped shopping cart provider
│   └── seed/                       # Demo Seed Script (10 stores, 115 products, categories, brands)
├── public/                         # Static assets & studio product image uploads
├── trendmall.db                    # SQLite Database file
└── package.json
```

---

## 🔐 Environment Variables

Create `.env.local` in root directory if connecting to live Telegram or Gemini endpoints:

```env
# Optional Gemini API key for live vision AI extraction (Fallback smart vision engine active by default)
GEMINI_API_KEY=your_gemini_api_key_here

# Optional Telegram Bot Token (Simulated Telegram Webhook active by default)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

---

## 📊 Database Schema Relationships

- `User (1) ── (N) Store`
- `Store (1) ── (N) Product`
- `Category (1) ── (N) Product`
- `User (Customer) (1) ── (N) ParentOrder`
- `ParentOrder (1) ── (N) SellerOrder`
- `SellerOrder (1) ── (N) OrderItem`
