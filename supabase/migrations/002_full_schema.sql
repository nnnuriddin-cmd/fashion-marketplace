-- ============================================================================
-- TrendMall: Full Schema Migration (002)
-- Architecture: Multi-Vendor Digital Fashion Marketplace
-- Target: Supabase PostgreSQL
-- ============================================================================
-- Notes on Migration Design:
-- 1. Idempotency: All statements use IF NOT EXISTS / IF EXISTS checks or DO blocks.
-- 2. Data Integrity: Historical orders are preserved even if users/products are deleted.
-- 3. Security: No sensitive user credentials/telegram codes exposed to public/anon.
-- 4. Multi-Vendor Orders: parent_orders -> seller_orders -> order_items.
--    Checkout is performed server-side via SUPABASE_SERVICE_ROLE_KEY.
-- 5. Backwards Compatibility: The legacy `orders` table is NOT dropped here to prevent
--    breaking legacy application routes before they are migrated to the new schema.
-- ============================================================================

-- ============================================================================
-- SECTION 1: EXTENSIONS & UTILITIES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reusable trigger function for auto-updating `updated_at` timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- SECTION 2: MODIFY EXISTING TABLES (001_init_schema compatibility)
-- ============================================================================

-- 2.1 users — add avatar_url
-- ----------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;


-- 2.2 categories — add hierarchical structure and taxonomy attributes
-- ----------------------------------------------------------------------------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- 2.3 products — comprehensive fashion catalog attributes
-- ----------------------------------------------------------------------------
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_price DECIMAL(12,2) CHECK (discount_price IS NULL OR discount_price >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'UZS';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS material TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS style TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS occasion TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS season TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0 CHECK (views_count >= 0);

-- Rename `image` -> `original_image` safely if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'image'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'original_image'
  ) THEN
    ALTER TABLE products RENAME COLUMN image TO original_image;
  END IF;
END $$;

-- If original_image column doesn't exist yet (e.g. fresh DB), create it
ALTER TABLE products ADD COLUMN IF NOT EXISTS original_image TEXT;

-- Rename `meta` -> `ai_metadata` safely if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'meta'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'ai_metadata'
  ) THEN
    ALTER TABLE products RENAME COLUMN meta TO ai_metadata;
  END IF;
END $$;

-- If ai_metadata column doesn't exist yet, create it
ALTER TABLE products ADD COLUMN IF NOT EXISTS ai_metadata JSONB DEFAULT '{}'::jsonb;

-- Add `processed_images` JSONB column
ALTER TABLE products ADD COLUMN IF NOT EXISTS processed_images JSONB DEFAULT '[]'::jsonb;

-- Migrate data from legacy `images` (text[]) column to `processed_images` (jsonb) if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'images' AND data_type = 'ARRAY'
  ) THEN
    UPDATE products
    SET processed_images = to_jsonb(images)
    WHERE images IS NOT NULL AND array_length(images, 1) > 0;

    ALTER TABLE products DROP COLUMN images;
  END IF;
END $$;

-- Adjust price column precision to 12,2 and ensure non-negative constraint
ALTER TABLE products ALTER COLUMN price TYPE DECIMAL(12,2);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'products_price_check'
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_price_check CHECK (price >= 0);
  END IF;
END $$;


-- 2.4 telegram_sessions — ingestion and AI workflow status
-- ----------------------------------------------------------------------------
ALTER TABLE telegram_sessions ADD COLUMN IF NOT EXISTS step TEXT DEFAULT 'AWAITING_PHOTO';
ALTER TABLE telegram_sessions ADD COLUMN IF NOT EXISTS raw_image_url TEXT;
ALTER TABLE telegram_sessions ADD COLUMN IF NOT EXISTS processed_image_url TEXT;
ALTER TABLE telegram_sessions ADD COLUMN IF NOT EXISTS extracted_metadata JSONB;
ALTER TABLE telegram_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- ============================================================================
-- SECTION 3: CREATE NEW TABLES
-- ============================================================================

-- 3.1 brands
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  logo       TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add FK from products.brand_id to brands(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_brand_id_fkey'
      AND table_name = 'products'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_brand_id_fkey
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;
  END IF;
END $$;


-- 3.2 parent_orders
-- Represents the checkout transaction initiated by the customer.
-- Preserves historical order data if the customer account is deleted.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS parent_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT UNIQUE NOT NULL,
  customer_id      UUID REFERENCES users(id) ON DELETE SET NULL, -- Nullable to safely allow ON DELETE SET NULL
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_method  TEXT DEFAULT 'STANDARD',
  payment_method   TEXT DEFAULT 'CASH',
  payment_status   TEXT DEFAULT 'PENDING',
  total_amount     DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
  order_notes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);


-- 3.3 seller_orders
-- Sub-orders split by vendor store.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seller_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_order_number  TEXT UNIQUE NOT NULL,
  parent_order_id   UUID NOT NULL REFERENCES parent_orders(id) ON DELETE CASCADE,
  store_id          UUID REFERENCES stores(id) ON DELETE SET NULL, -- Preserves order records if a store is closed
  status            TEXT NOT NULL DEFAULT 'NEW',
  subtotal          DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  commission_amount DECIMAL(12,2) DEFAULT 0.0 CHECK (commission_amount >= 0),
  seller_earnings   DECIMAL(12,2) DEFAULT 0.0 CHECK (seller_earnings >= 0),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);


-- 3.4 order_items
-- Purchased items with price, title, and image snapshots.
-- Preserves item history even if product catalog entry is removed.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id UUID NOT NULL REFERENCES seller_orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL, -- Nullable: historical snapshot remains intact
  product_name    TEXT NOT NULL, -- Preserved snapshot of product title
  product_image   TEXT,          -- Preserved snapshot of product image
  selected_size   TEXT,
  selected_color  TEXT,
  price           DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  subtotal        DECIMAL(12,2) NOT NULL CHECK (subtotal >= 0),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);


-- 3.5 reviews
-- Customer reviews and product ratings.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 3.6 marketplace_settings
-- Global configuration and platform commission rules.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_settings (
  id                    TEXT PRIMARY KEY DEFAULT 'default',
  default_commission    DECIMAL(5,2) DEFAULT 10.0 CHECK (default_commission >= 0 AND default_commission <= 100),
  auto_approve_products BOOLEAN DEFAULT TRUE,
  currency              TEXT DEFAULT 'UZS',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings seed
INSERT INTO marketplace_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- SECTION 4: TEMPORARY LEGACY COMPATIBILITY
-- ============================================================================
-- NOTE: The legacy `orders` table from 001_init_schema.sql is NOT dropped here.
-- It remains active as a transitional safety net until application code
-- (src/lib/db/queries.ts, src/app/account, src/app/seller/dashboard)
-- is completely updated to use parent_orders / seller_orders / order_items.
-- A separate cleanup migration (e.g. 003_drop_legacy_orders.sql) will remove it
-- once all application code and API routes have been fully verified.


-- ============================================================================
-- SECTION 5: INDEXES
-- ============================================================================

-- Stores
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON stores(owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);

-- Categories
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_gender ON categories(gender);

-- Brands
CREATE INDEX IF NOT EXISTS idx_brands_slug ON brands(slug);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_gender ON products(gender);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_trending ON products(is_trending) WHERE is_trending = TRUE;

-- Parent Orders
CREATE INDEX IF NOT EXISTS idx_parent_orders_customer_id ON parent_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_parent_orders_order_number ON parent_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_parent_orders_created_at ON parent_orders(created_at DESC);

-- Seller Orders
CREATE INDEX IF NOT EXISTS idx_seller_orders_parent_order_id ON seller_orders(parent_order_id);
CREATE INDEX IF NOT EXISTS idx_seller_orders_store_id ON seller_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_seller_orders_status ON seller_orders(status);

-- Order Items
CREATE INDEX IF NOT EXISTS idx_order_items_seller_order_id ON order_items(seller_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Telegram Sessions
DROP INDEX IF EXISTS idx_telegram_sessions_seller;
CREATE INDEX idx_telegram_sessions_seller ON telegram_sessions(seller_telegram_id, created_at DESC);

-- Reviews
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);


-- ============================================================================
-- SECTION 6: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- 6.1 users
-- ----------------------------------------------------------------------------
-- CRITICAL SECURITY NOTICE:
-- The `users` table contains sensitive columns: password_hash, email, phone,
-- telegram_id, and telegram_code. Public access with USING(true) is strictly FORBIDDEN.
--
-- NOTE ON SUPABASE AUTH:
-- The current application architecture stores custom credentials in `users`.
-- Policies using `auth.uid() = id` will strictly take effect once Supabase Auth
-- is implemented and users.id maps to auth.users.id.
-- Until Supabase Auth is integrated, server-side API routes and queries MUST access
-- user records using the service_role key to prevent permission rejection.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read user basic info" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Secure public view for non-sensitive merchant/user profiles (id, full_name, avatar_url, role)
CREATE OR REPLACE VIEW public_user_profiles AS
  SELECT id, full_name, avatar_url, role, created_at
  FROM users;

GRANT SELECT ON public_user_profiles TO anon, authenticated;


-- 6.2 stores
-- ----------------------------------------------------------------------------
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view approved stores" ON stores;
CREATE POLICY "Public can view approved stores"
  ON stores FOR SELECT
  USING (status = 'APPROVED' OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Seller can create store" ON stores;
CREATE POLICY "Seller can create store"
  ON stores FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Seller can update own store" ON stores;
CREATE POLICY "Seller can update own store"
  ON stores FOR UPDATE
  USING (owner_id = auth.uid());


-- 6.3 categories
-- ----------------------------------------------------------------------------
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read categories" ON categories;
CREATE POLICY "Public can read categories"
  ON categories FOR SELECT
  USING (true);


-- 6.4 brands
-- ----------------------------------------------------------------------------
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read brands" ON brands;
CREATE POLICY "Public can read brands"
  ON brands FOR SELECT
  USING (true);


-- 6.5 products
-- ----------------------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active products" ON products;
CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (
    status = 'ACTIVE'
    OR store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
  );

DROP POLICY IF EXISTS "Seller can create products in own store" ON products;
CREATE POLICY "Seller can create products in own store"
  ON products FOR INSERT
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Seller can update own products" ON products;
CREATE POLICY "Seller can update own products"
  ON products FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "Seller can delete own products" ON products;
CREATE POLICY "Seller can delete own products"
  ON products FOR DELETE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));


-- 6.6 parent_orders
-- ----------------------------------------------------------------------------
-- Orders are created exclusively via server-side checkout with service_role key.
-- Customers can view their own orders via auth.uid() when logged in.
ALTER TABLE parent_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customer can view own orders" ON parent_orders;
CREATE POLICY "Customer can view own orders"
  ON parent_orders FOR SELECT
  USING (customer_id = auth.uid());


-- 6.7 seller_orders
-- ----------------------------------------------------------------------------
-- Sellers can view and update fulfillment status for their own store's orders.
ALTER TABLE seller_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seller can view own seller orders" ON seller_orders;
CREATE POLICY "Seller can view own seller orders"
  ON seller_orders FOR SELECT
  USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR parent_order_id IN (SELECT id FROM parent_orders WHERE customer_id = auth.uid())
  );

DROP POLICY IF EXISTS "Seller can update own seller order status" ON seller_orders;
CREATE POLICY "Seller can update own seller order status"
  ON seller_orders FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));


-- 6.8 order_items
-- ----------------------------------------------------------------------------
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order items visible to involved parties" ON order_items;
CREATE POLICY "Order items visible to involved parties"
  ON order_items FOR SELECT
  USING (
    seller_order_id IN (
      SELECT id FROM seller_orders WHERE
        store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
        OR parent_order_id IN (SELECT id FROM parent_orders WHERE customer_id = auth.uid())
    )
  );


-- 6.9 telegram_sessions
-- ----------------------------------------------------------------------------
ALTER TABLE telegram_sessions ENABLE ROW LEVEL SECURITY;
-- Telegram webhooks operate exclusively via server-side service_role client.
-- No public policies are exposed.


-- 6.10 reviews
-- ----------------------------------------------------------------------------
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read reviews" ON reviews;
CREATE POLICY "Public can read reviews"
  ON reviews FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "User can create reviews" ON reviews;
CREATE POLICY "User can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "User can update own reviews" ON reviews;
CREATE POLICY "User can update own reviews"
  ON reviews FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "User can delete own reviews" ON reviews;
CREATE POLICY "User can delete own reviews"
  ON reviews FOR DELETE
  USING (user_id = auth.uid());


-- 6.11 marketplace_settings
-- ----------------------------------------------------------------------------
ALTER TABLE marketplace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read settings" ON marketplace_settings;
CREATE POLICY "Public can read settings"
  ON marketplace_settings FOR SELECT
  USING (true);


-- ============================================================================
-- SECTION 7: SUPABASE STORAGE BUCKETS & POLICIES
-- ============================================================================

-- Create public storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 7.1 product-images policies
-- Storage folder pattern: product-images/{store_id}/*
-- Public can read images
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Authenticated store owner can upload only to their own store folder
DROP POLICY IF EXISTS "Store owner can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
CREATE POLICY "Store owner can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM stores WHERE owner_id = auth.uid()
    )
  );

-- Store owner can delete ONLY images belonging to their own store folder
DROP POLICY IF EXISTS "Store owner can delete own product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own product images" ON storage.objects;
CREATE POLICY "Store owner can delete own product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM stores WHERE owner_id = auth.uid()
    )
  );

-- 7.2 store-assets policies
-- Storage folder pattern: store-assets/{store_id}/*
DROP POLICY IF EXISTS "Public read store assets" ON storage.objects;
CREATE POLICY "Public read store assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "Store owner can upload store assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload store assets" ON storage.objects;
CREATE POLICY "Store owner can upload store assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'store-assets'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM stores WHERE owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Store owner can delete store assets" ON storage.objects;
CREATE POLICY "Store owner can delete store assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'store-assets'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM stores WHERE owner_id = auth.uid()
    )
  );


-- ============================================================================
-- SECTION 8: AUTOMATED TRIGGERS
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'users', 'stores', 'categories', 'brands', 'products',
      'parent_orders', 'seller_orders', 'order_items',
      'telegram_sessions', 'reviews', 'marketplace_settings'
    ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; '
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I '
      'FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl, tbl
    );
  END LOOP;
END $$;
