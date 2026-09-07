import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'trendmall.db');
let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    initSchema(dbInstance);
  }
  return dbInstance;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      fullName TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'CUSTOMER',
      telegramId TEXT UNIQUE,
      telegramCode TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      ownerId TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      logo TEXT,
      coverImage TEXT,
      location TEXT,
      city TEXT DEFAULT 'Tashkent',
      phone TEXT,
      telegramUsername TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      rating REAL DEFAULT 5.0,
      commissionRate REAL DEFAULT 10.0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ownerId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      gender TEXT,
      parentId TEXT,
      image TEXT,
      FOREIGN KEY (parentId) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      logo TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      storeId TEXT NOT NULL,
      categoryId TEXT NOT NULL,
      brandId TEXT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      discountPrice REAL,
      currency TEXT DEFAULT 'UZS',
      sku TEXT,
      stockQuantity INTEGER DEFAULT 0,
      sizes TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
      colors TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
      material TEXT,
      gender TEXT,
      style TEXT,
      occasion TEXT,
      season TEXT,
      tags TEXT NOT NULL DEFAULT '[]', -- JSON array
      originalImage TEXT NOT NULL,
      processedImages TEXT NOT NULL DEFAULT '[]', -- JSON array
      status TEXT NOT NULL DEFAULT 'DRAFT',
      aiMetadata TEXT,
      isFeatured INTEGER DEFAULT 0,
      isTrending INTEGER DEFAULT 0,
      viewsCount INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (storeId) REFERENCES stores(id),
      FOREIGN KEY (categoryId) REFERENCES categories(id),
      FOREIGN KEY (brandId) REFERENCES brands(id)
    );

    CREATE TABLE IF NOT EXISTS parent_orders (
      id TEXT PRIMARY KEY,
      orderNumber TEXT UNIQUE NOT NULL,
      customerId TEXT NOT NULL,
      customerName TEXT NOT NULL,
      customerPhone TEXT NOT NULL,
      deliveryAddress TEXT NOT NULL,
      deliveryMethod TEXT DEFAULT 'STANDARD',
      paymentMethod TEXT DEFAULT 'CASH',
      paymentStatus TEXT DEFAULT 'PENDING',
      totalAmount REAL NOT NULL,
      orderNotes TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS seller_orders (
      id TEXT PRIMARY KEY,
      subOrderNumber TEXT UNIQUE NOT NULL,
      parentOrderId TEXT NOT NULL,
      storeId TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      subtotal REAL NOT NULL,
      commissionAmount REAL DEFAULT 0.0,
      sellerEarnings REAL DEFAULT 0.0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (parentOrderId) REFERENCES parent_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (storeId) REFERENCES stores(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      sellerOrderId TEXT NOT NULL,
      productId TEXT NOT NULL,
      productName TEXT NOT NULL,
      productImage TEXT NOT NULL,
      selectedSize TEXT,
      selectedColor TEXT,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (sellerOrderId) REFERENCES seller_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (productId) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      userId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (productId) REFERENCES products(id),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS telegram_sessions (
      id TEXT PRIMARY KEY,
      sellerTelegramId TEXT NOT NULL,
      storeId TEXT NOT NULL,
      step TEXT NOT NULL,
      rawImageBase64 TEXT,
      rawImageUrl TEXT,
      processedImageUrl TEXT,
      extractedMetadataJson TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marketplace_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      defaultCommission REAL DEFAULT 10.0,
      autoApproveProducts INTEGER DEFAULT 1,
      currency TEXT DEFAULT 'UZS'
    );

    INSERT OR IGNORE INTO marketplace_settings (id, defaultCommission, autoApproveProducts, currency)
    VALUES ('default', 10.0, 1, 'UZS');
  `);
}
