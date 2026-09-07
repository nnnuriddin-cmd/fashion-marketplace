const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../trendmall.db');

// Ensure db directory or file can be created
const db = new Database(dbPath);

console.log('🌱 Initializing Database Schema...');

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
    sizes TEXT NOT NULL DEFAULT '[]',
    colors TEXT NOT NULL DEFAULT '[]',
    material TEXT,
    gender TEXT,
    style TEXT,
    occasion TEXT,
    season TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    originalImage TEXT NOT NULL,
    processedImages TEXT NOT NULL DEFAULT '[]',
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
    createdAt TEXT NOT NULL
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
    createdAt TEXT NOT NULL
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
    subtotal REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    productId TEXT NOT NULL,
    userId TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    createdAt TEXT NOT NULL
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
`);

console.log('🧹 Cleaning existing seed data...');
db.exec('DELETE FROM order_items;');
db.exec('DELETE FROM seller_orders;');
db.exec('DELETE FROM parent_orders;');
db.exec('DELETE FROM reviews;');
db.exec('DELETE FROM products;');
db.exec('DELETE FROM categories;');
db.exec('DELETE FROM brands;');
db.exec('DELETE FROM stores;');
db.exec('DELETE FROM users;');

console.log('👤 Seeding Users...');

const now = new Date().toISOString();

const adminUser = {
  id: 'usr-admin-1',
  email: 'admin@trendmall.uz',
  passwordHash: 'admin123',
  fullName: 'Marketplace Admin',
  phone: '+998901112233',
  role: 'ADMIN',
  telegramId: '111000',
  telegramCode: '999888',
  createdAt: now,
};

const customerUser = {
  id: 'usr-customer-1',
  email: 'anora@gmail.com',
  passwordHash: 'customer123',
  fullName: 'Anora Karimova',
  phone: '+998901234567',
  role: 'CUSTOMER',
  telegramId: '222111',
  telegramCode: null,
  createdAt: now,
};

const insertUser = db.prepare(`
  INSERT INTO users (id, email, passwordHash, fullName, phone, role, telegramId, telegramCode, createdAt)
  VALUES (@id, @email, @passwordHash, @fullName, @phone, @role, @telegramId, @telegramCode, @createdAt)
`);

insertUser.run(adminUser);
insertUser.run(customerUser);

// 10 Seller Users & Stores
const storeData = [
  {
    storeId: 'str-1',
    ownerId: 'usr-seller-1',
    email: 'seller1@trendmall.uz',
    sellerName: 'Malika Azizova',
    storeName: 'Silk & Thread Boutique',
    slug: 'silk-and-thread',
    desc: 'High-end artisan silk dresses, linen blazers, and luxury evening wear crafted for the modern woman.',
    logo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    cover: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
    location: 'Shota Rustaveli 12, Yakkasaray',
    phone: '+998909876543',
    telegram: 'silk_thread_uz',
    status: 'APPROVED',
    rating: 4.9,
  },
  {
    storeId: 'str-2',
    ownerId: 'usr-seller-2',
    email: 'seller2@trendmall.uz',
    sellerName: 'Timur Rakhimov',
    storeName: 'Urban Couture Studio',
    slug: 'urban-couture',
    desc: 'Minimalist streetwear, oversized jackets, and contemporary urban fashion inspired by European design.',
    logo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80',
    cover: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&q=80',
    location: 'Amir Temur Ave 88, Mirobod',
    phone: '+998912345678',
    telegram: 'urbancouture_uz',
    status: 'APPROVED',
    rating: 4.8,
  },
  {
    storeId: 'str-3',
    ownerId: 'usr-seller-3',
    email: 'seller3@trendmall.uz',
    sellerName: 'Nigora Umarova',
    storeName: 'Elegance Women Atelier',
    slug: 'elegance-women',
    desc: 'Classic suits, tailored coats, and chic office wear for fashion-forward professionals.',
    logo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80',
    cover: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
    location: 'Navoi Street 24, Shaykhontohur',
    phone: '+998935551212',
    telegram: 'elegance_atelier',
    status: 'APPROVED',
    rating: 5.0,
  },
  {
    storeId: 'str-4',
    ownerId: 'usr-seller-4',
    email: 'seller4@trendmall.uz',
    sellerName: 'Sardor Alimov',
    storeName: 'Denim & Co. Tashkent',
    slug: 'denim-co',
    desc: 'Premium selvedge denim, vintage wash jeans, and durable denim jackets for men and women.',
    logo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
    cover: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=1200&q=80',
    location: 'Taras Shevchenko 30, Mirobod',
    phone: '+998946663322',
    telegram: 'denim_co_tsh',
    status: 'APPROVED',
    rating: 4.7,
  },
  {
    storeId: 'str-5',
    ownerId: 'usr-seller-5',
    email: 'seller5@trendmall.uz',
    sellerName: 'Kamila Saidova',
    storeName: 'Leather Craft & Bags',
    slug: 'leather-craft',
    desc: 'Handcrafted genuine leather handbags, totes, boots, and luxury travel accessories.',
    logo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80',
    cover: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=80',
    location: 'Buyuk Ipak Yuli 45, Mirzo Ulugbek',
    phone: '+998977778899',
    telegram: 'leathercraft_uz',
    status: 'APPROVED',
    rating: 4.9,
  },
  {
    storeId: 'str-6',
    ownerId: 'usr-seller-6',
    email: 'seller6@trendmall.uz',
    sellerName: 'Bobur Mansurov',
    storeName: 'Shoe Vault Tashkent',
    slug: 'shoe-vault',
    desc: 'Exclusive sneakers, formal Italian leather shoes, and stylish boots for every occasion.',
    logo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80',
    cover: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?auto=format&fit=crop&w=1200&q=80',
    location: 'C-1, Chilanzar 15',
    phone: '+998998881122',
    telegram: 'shoevault_tsh',
    status: 'APPROVED',
    rating: 4.8,
  },
  {
    storeId: 'str-7',
    ownerId: 'usr-seller-7',
    email: 'seller7@trendmall.uz',
    sellerName: 'Dilnoza Kadyrova',
    storeName: 'Velvet & Lace Couture',
    slug: 'velvet-lace',
    desc: 'Romantic maxi dresses, bridal attire, cocktail gowns, and delicate silk scarves.',
    logo: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=300&q=80',
    cover: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
    location: 'Sebzar Street 10, Olmazor',
    phone: '+998903334455',
    telegram: 'velvet_lace_boutique',
    status: 'APPROVED',
    rating: 4.9,
  },
  {
    storeId: 'str-8',
    ownerId: 'usr-seller-8',
    email: 'seller8@trendmall.uz',
    sellerName: 'Jasur Tursunov',
    storeName: 'StreetStyle X',
    slug: 'streetstyle-x',
    desc: 'Trending oversized hoodies, graphic tees, cargo pants, and urban streetwear drops.',
    logo: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80',
    cover: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1200&q=80',
    location: 'Farhad Market Center, Uchtepa',
    phone: '+998951112244',
    telegram: 'streetstyle_x',
    status: 'APPROVED',
    rating: 4.6,
  },
  {
    storeId: 'str-9',
    ownerId: 'usr-seller-9',
    email: 'seller9@trendmall.uz',
    sellerName: 'Madina Zokirova',
    storeName: 'Accessory Haven',
    slug: 'accessory-haven',
    desc: 'Designer sunglasses, gold-plated jewelry, silk scarves, and luxury leather belts.',
    logo: 'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=300&q=80',
    cover: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=1200&q=80',
    location: 'Next Mall 2nd Floor, Yakkasaray',
    phone: '+998907775533',
    telegram: 'accessory_haven',
    status: 'APPROVED',
    rating: 4.8,
  },
  {
    storeId: 'str-10',
    ownerId: 'usr-seller-10',
    email: 'seller10@trendmall.uz',
    sellerName: 'Sherzod Yuldashev',
    storeName: 'Gentlemen & Co. Suits',
    slug: 'gentlemen-co',
    desc: 'Bespoke wool suits, tailored tuxedos, dress shirts, and handcrafted Italian silk ties.',
    logo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=300&q=80',
    cover: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1200&q=80',
    location: 'Hyatt Regency Gallery, Yunusabad',
    phone: '+998909990011',
    telegram: 'gentlemen_co_suits',
    status: 'APPROVED',
    rating: 5.0,
  },
];

const insertStore = db.prepare(`
  INSERT INTO stores (id, ownerId, name, slug, description, logo, coverImage, location, city, phone, telegramUsername, status, rating, commissionRate, createdAt)
  VALUES (@id, @ownerId, @name, @slug, @description, @logo, @coverImage, @location, @city, @phone, @telegramUsername, @status, @rating, @commissionRate, @createdAt)
`);

storeData.forEach((s) => {
  insertUser.run({
    id: s.ownerId,
    email: s.email,
    passwordHash: 'seller123',
    fullName: s.sellerName,
    phone: s.phone,
    role: 'SELLER',
    telegramId: `tg-${s.storeId}`,
    telegramCode: `code-${s.storeId}`,
    createdAt: now,
  });

  insertStore.run({
    id: s.storeId,
    ownerId: s.ownerId,
    name: s.storeName,
    slug: s.slug,
    description: s.desc,
    logo: s.logo,
    coverImage: s.cover,
    location: s.location,
    city: 'Tashkent',
    phone: s.phone,
    telegramUsername: s.telegram,
    status: s.status,
    rating: s.rating,
    commissionRate: 10.0,
    createdAt: now,
  });
});

console.log('🏷 Seeding Categories...');

const categories = [
  { id: 'cat-women', name: "Women's Fashion", slug: 'women', gender: 'WOMEN', parentId: null, image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-women-blazers', name: 'Blazers & Jackets', slug: 'women-blazers', gender: 'WOMEN', parentId: 'cat-women', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-women-dresses', name: 'Dresses & Gowns', slug: 'women-dresses', gender: 'WOMEN', parentId: 'cat-women', image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-women-tops', name: 'Tops & Knitwear', slug: 'women-tops', gender: 'WOMEN', parentId: 'cat-women', image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=600&q=80' },

  { id: 'cat-men', name: "Men's Fashion", slug: 'men', gender: 'MEN', parentId: null, image: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-men-suits', name: 'Suits & Blazers', slug: 'men-suits', gender: 'MEN', parentId: 'cat-men', image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-men-outerwear', name: 'Jackets & Outerwear', slug: 'men-outerwear', gender: 'MEN', parentId: 'cat-men', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-men-streetwear', name: 'Hoodies & Tees', slug: 'men-streetwear', gender: 'MEN', parentId: 'cat-men', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80' },

  { id: 'cat-shoes', name: 'Footwear & Shoes', slug: 'shoes', gender: 'UNISEX', parentId: null, image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-shoes-sneakers', name: 'Sneakers', slug: 'shoes-sneakers', gender: 'UNISEX', parentId: 'cat-shoes', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-shoes-heels', name: 'Heels & Pumps', slug: 'shoes-heels', gender: 'WOMEN', parentId: 'cat-shoes', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=600&q=80' },

  { id: 'cat-bags', name: 'Bags & Leather Goods', slug: 'bags', gender: 'UNISEX', parentId: null, image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80' },
  { id: 'cat-accessories', name: 'Accessories & Jewelry', slug: 'accessories', gender: 'UNISEX', parentId: null, image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&q=80' },
];

const insertCategory = db.prepare(`
  INSERT INTO categories (id, name, slug, gender, parentId, image)
  VALUES (@id, @name, @slug, @gender, @parentId, @image)
`);

categories.forEach((c) => insertCategory.run(c));

console.log('💎 Seeding Brands...');

const brands = [
  { id: 'brd-1', name: 'Zara', slug: 'zara', logo: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=200&q=80' },
  { id: 'brd-2', name: 'Mango', slug: 'mango', logo: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=200&q=80' },
  { id: 'brd-3', name: 'Massimo Dutti', slug: 'massimo-dutti', logo: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=200&q=80' },
  { id: 'brd-4', name: 'Nike', slug: 'nike', logo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80' },
  { id: 'brd-5', name: 'Adidas', slug: 'adidas', logo: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=200&q=80' },
  { id: 'brd-6', name: 'Gucci', slug: 'gucci', logo: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=200&q=80' },
  { id: 'brd-7', name: 'Prada', slug: 'prada', logo: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=200&q=80' },
  { id: 'brd-8', name: 'Atelier Handmade', slug: 'atelier-handmade', logo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' },
];

const insertBrand = db.prepare(`
  INSERT INTO brands (id, name, slug, logo)
  VALUES (@id, @name, @slug, @logo)
`);

brands.forEach((b) => insertBrand.run(b));

console.log('👗 Seeding 100+ Fashion Products...');

const insertProduct = db.prepare(`
  INSERT INTO products (
    id, storeId, categoryId, brandId, name, slug, description, price, discountPrice,
    currency, sku, stockQuantity, sizes, colors, material, gender, style, occasion,
    season, tags, originalImage, processedImages, status, aiMetadata, isFeatured, isTrending, viewsCount, createdAt
  ) VALUES (
    @id, @storeId, @categoryId, @brandId, @name, @slug, @description, @price, @discountPrice,
    @currency, @sku, @stockQuantity, @sizes, @colors, @material, @gender, @style, @occasion,
    @season, @tags, @originalImage, @processedImages, @status, @aiMetadata, @isFeatured, @isTrending, @viewsCount, @createdAt
  )
`);

const rawProducts = [
  // Silk & Thread Boutique (str-1)
  {
    storeId: 'str-1', categoryId: 'cat-women-blazers', brandId: 'brd-3',
    name: "Women's Oversized Linen Blazer", slug: 'womens-oversized-linen-blazer',
    desc: 'Crafted from breathable European linen blend, featuring subtle shoulder structure, classic peak lapels, and double-breasted horn buttons.',
    price: 450000, discountPrice: 390000, sizes: ['S', 'M', 'L'], colors: ['Beige', 'Cream', 'Olive'],
    material: '80% Linen, 20% Cotton', gender: 'WOMEN', style: 'Oversized', occasion: 'Casual / Work', season: 'Summer',
    img: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1
  },
  {
    storeId: 'str-1', categoryId: 'cat-women-dresses', brandId: 'brd-8',
    name: 'Silk Slip Midi Dress in Emerald', slug: 'silk-slip-midi-dress-emerald',
    desc: 'Luxurious pure mulberry silk slip dress with adjustable bias-cut shoulder straps and a flattering cowl neckline.',
    price: 680000, discountPrice: 590000, sizes: ['XS', 'S', 'M'], colors: ['Emerald Green', 'Champagne'],
    material: '100% Mulberry Silk', gender: 'WOMEN', style: 'Elegant', occasion: 'Party / Evening', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1
  },
  {
    storeId: 'str-1', categoryId: 'cat-women-dresses', brandId: 'brd-2',
    name: 'Floral Chiffon Wrap Maxi Dress', slug: 'floral-chiffon-wrap-maxi-dress',
    desc: 'Flowing floral printed chiffon dress featuring a wrap waist sash, subtle flutter sleeves, and romantic tiered ruffle hemline.',
    price: 520000, discountPrice: null, sizes: ['S', 'M', 'L', 'XL'], colors: ['Floral Pink', 'Sky Blue'],
    material: 'Chiffon Silk', gender: 'WOMEN', style: 'Romantic', occasion: 'Wedding / Outdoor', season: 'Spring',
    img: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1
  },
  {
    storeId: 'str-1', categoryId: 'cat-women-tops', brandId: 'brd-8',
    name: 'Cashmere Blend Knit Cardigan', slug: 'cashmere-blend-knit-cardigan',
    desc: 'Ultra-soft cashmere and wool blend cardigan with tortoiseshell buttons and rib-knit cuffs.',
    price: 490000, discountPrice: 420000, sizes: ['S', 'M', 'L'], colors: ['Oatmeal', 'Soft Mocha'],
    material: '30% Cashmere, 70% Fine Merino', gender: 'WOMEN', style: 'Cozy Classic', occasion: 'Daily / Work', season: 'Autumn / Winter',
    img: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 0
  },

  // Urban Couture Studio (str-2)
  {
    storeId: 'str-2', categoryId: 'cat-men-outerwear', brandId: 'brd-1',
    name: 'Minimalist Black Bomber Jacket', slug: 'minimalist-black-bomber-jacket',
    desc: 'Water-resistant technical satin bomber jacket with matte black hardware, dual zip closure, and interior utility pocket.',
    price: 590000, discountPrice: 495000, sizes: ['M', 'L', 'XL'], colors: ['Matte Black', 'Sage Green'],
    material: 'Nylon Tech Satin', gender: 'MEN', style: 'Minimalist', occasion: 'Streetwear / Daily', season: 'Autumn',
    img: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1
  },
  {
    storeId: 'str-2', categoryId: 'cat-men-streetwear', brandId: 'brd-1',
    name: 'Heavyweight Fleece Hoodie', slug: 'heavyweight-fleece-hoodie',
    desc: '450 GSM custom French terry cotton hoodie with double-lined hood and drop shoulder design.',
    price: 380000, discountPrice: 320000, sizes: ['S', 'M', 'L', 'XL'], colors: ['Charcoal', 'Washed Beige', 'Black'],
    material: '100% Heavy Cotton', gender: 'MEN', style: 'Streetwear', occasion: 'Casual', season: 'Winter',
    img: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1
  },
  {
    storeId: 'str-2', categoryId: 'cat-men-streetwear', brandId: 'brd-5',
    name: 'Oversized Boxy Graphic Tee', slug: 'oversized-boxy-graphic-tee',
    desc: 'Relaxed vintage washed cotton t-shirt featuring high-density screenprinted urban typographic artwork on back.',
    price: 240000, discountPrice: null, sizes: ['M', 'L', 'XL'], colors: ['Vintage Washed Black', 'Off-White'],
    material: '100% Combed Cotton', gender: 'UNISEX', style: 'Urban Oversized', occasion: 'Daily Streetwear', season: 'Summer',
    img: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 0
  },

  // Elegance Women Atelier (str-3)
  {
    storeId: 'str-3', categoryId: 'cat-women-blazers', brandId: 'brd-3',
    name: 'Tailored Wool Blend Pantsuit', slug: 'tailored-wool-blend-pantsuit',
    desc: 'Sophisticated two-piece office suit including a structured double-breasted jacket and sleek high-waisted pleated trousers.',
    price: 950000, discountPrice: 850000, sizes: ['S', 'M', 'L'], colors: ['Midnight Navy', 'Camel'],
    material: 'Italian Wool Blend', gender: 'WOMEN', style: 'Tailored Formal', occasion: 'Business / Executive', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1548624313-0396c75e4b1a?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1
  },
  {
    storeId: 'str-3', categoryId: 'cat-women-dresses', brandId: 'brd-2',
    name: 'Pleated A-Line Midi Skirt & Blouse Set', slug: 'pleated-a-line-midi-skirt-blouse-set',
    desc: 'Chic satin accordion-pleated skirt paired with a high-neck keyhole silk blouse for elegant daytime events.',
    price: 580000, discountPrice: null, sizes: ['S', 'M', 'L'], colors: ['Dusty Rose', 'Ivory'],
    material: 'Polyester Satin', gender: 'WOMEN', style: 'Classic Elegant', occasion: 'Work / Luncheon', season: 'Spring',
    img: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 0
  },

  // Denim & Co Tashkent (str-4)
  {
    storeId: 'str-4', categoryId: 'cat-women-blazers', brandId: 'brd-1',
    name: 'Vintage Wash Trucker Denim Jacket', slug: 'vintage-wash-trucker-denim-jacket',
    desc: 'Classic 14oz rigid denim trucker jacket with custom brass buttons, chest flap pockets, and hand-distressed detailing.',
    price: 420000, discountPrice: 350000, sizes: ['S', 'M', 'L', 'XL'], colors: ['Vintage Blue Wash', 'Washed Black'],
    material: '100% Cotton Selvedge Denim', gender: 'UNISEX', style: 'Vintage Casual', occasion: 'Everyday Wear', season: 'Autumn',
    img: 'https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1
  },
  {
    storeId: 'str-4', categoryId: 'cat-men-streetwear', brandId: 'brd-1',
    name: 'Straight Leg Selvedge Raw Jeans', slug: 'straight-leg-selvedge-raw-jeans',
    desc: 'Authentic 15oz Japanese selvedge denim jeans featuring a classic mid-rise straight leg fit and red selvedge ID line.',
    price: 480000, discountPrice: null, sizes: ['30', '32', '34', '36'], colors: ['Indigo Blue'],
    material: 'Japanese Selvedge Denim', gender: 'MEN', style: 'Heritage', occasion: 'Casual', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1
  },

  // Leather Craft & Bags (str-5)
  {
    storeId: 'str-5', categoryId: 'cat-bags', brandId: 'brd-6',
    name: 'Handcrafted Full-Grain Leather Tote', slug: 'handcrafted-full-grain-leather-tote',
    desc: 'Spacious structured shopper tote bag made from premium vegetable-tanned Italian leather with interior laptop sleeve.',
    price: 890000, discountPrice: 750000, sizes: ['One Size'], colors: ['Cognac Brown', 'Obsidian Black'],
    material: 'Full-Grain Italian Calfskin', gender: 'UNISEX', style: 'Luxury Craft', occasion: 'Work / Travel', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1
  },
  {
    storeId: 'str-5', categoryId: 'cat-bags', brandId: 'brd-7',
    name: 'Structured Crossbody Saddle Bag', slug: 'structured-crossbody-saddle-bag',
    desc: 'Curved silhouette shoulder bag featuring polished gold hardware, magnetic flap lock, and adjustable leather cross strap.',
    price: 640000, discountPrice: null, sizes: ['Medium'], colors: ['Deep Burgundy', 'Cream White'],
    material: 'Pebbled Calf Leather', gender: 'WOMEN', style: 'Chic Modern', occasion: 'Daily / Evening', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1
  },

  // Shoe Vault Tashkent (str-6)
  {
    storeId: 'str-6', categoryId: 'cat-shoes-sneakers', brandId: 'brd-4',
    name: 'Air Retro Leather High-Top Sneakers', slug: 'air-retro-leather-high-top-sneakers',
    desc: 'Iconic high-top leather sneakers with cushioned Air sole unit, retro color blocking, and durable rubber outsole.',
    price: 850000, discountPrice: 720000, sizes: ['39', '40', '41', '42', '43', '44'], colors: ['White / Red / Black'],
    material: 'Genuine Leather & Rubber', gender: 'UNISEX', style: 'Street / Retro', occasion: 'Sport Casual', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1
  },
  {
    storeId: 'str-6', categoryId: 'cat-shoes-heels', brandId: 'brd-2',
    name: 'Italian Leather Pointed Toe Stiletto Pumps', slug: 'italian-leather-pointed-toe-stiletto-pumps',
    desc: 'Sleek 90mm stiletto heels with a sharp pointed toe silhouette and padded leather footbed for effortless elegance.',
    price: 720000, discountPrice: 620000, sizes: ['36', '37', '38', '39', '40'], colors: ['Nude Beige', 'Classic Black'],
    material: 'Nappa Leather', gender: 'WOMEN', style: 'Luxury Glam', occasion: 'Evening / Formal', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 0
  },
  {
    storeId: 'str-6', categoryId: 'cat-shoes-sneakers', brandId: 'brd-5',
    name: 'Suede Vintage Runner Sneakers', slug: 'suede-vintage-runner-sneakers',
    desc: 'Retro-inspired running sneakers with soft suede overlays, breathable mesh upper, and lightweight EVA foam midsole.',
    price: 540000, discountPrice: null, sizes: ['40', '41', '42', '43'], colors: ['Grey / Off-White'],
    material: 'Suede & Mesh', gender: 'UNISEX', style: 'Vintage Sport', occasion: 'Daily Walk', season: 'Spring / Summer',
    img: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1
  },

  // Velvet & Lace Couture (str-7)
  {
    storeId: 'str-7', categoryId: 'cat-women-dresses', brandId: 'brd-8',
    name: 'Royal Velvet Evening Ball Gown', slug: 'royal-velvet-evening-ball-gown',
    desc: 'Opulent deep midnight blue plush velvet dress with off-the-shoulder neckline, corset boning bodice, and thigh slit hem.',
    price: 1200000, discountPrice: 990000, sizes: ['S', 'M', 'L'], colors: ['Midnight Velvet Blue', 'Ruby Red'],
    material: 'Silk Velvet', gender: 'WOMEN', style: 'Couture Evening', occasion: 'Gala / Wedding', season: 'Winter',
    img: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1
  },
  {
    storeId: 'str-7', categoryId: 'cat-women-dresses', brandId: 'brd-8',
    name: 'French Lace Embroidered Midi Cocktail Dress', slug: 'french-lace-embroidered-midi-cocktail-dress',
    desc: 'Delicate floral eyelash lace over nude lining, featuring sheer long sleeves and an scalloped hemline.',
    price: 880000, discountPrice: null, sizes: ['XS', 'S', 'M'], colors: ['Black Lace / Nude', 'White Lace'],
    material: 'French Guipure Lace', gender: 'WOMEN', style: 'Romantic Couture', occasion: 'Cocktail / Reception', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 0
  },

  // StreetStyle X (str-8)
  {
    storeId: 'str-8', categoryId: 'cat-men-streetwear', brandId: 'brd-1',
    name: 'Utility Cargo Pants with Straps', slug: 'utility-cargo-pants-straps',
    desc: 'Techwear cargo trousers with heavy cotton canvas weave, tactical webbing straps, adjustable ankle cuffs, and 8 functional pockets.',
    price: 460000, discountPrice: 390000, sizes: ['M', 'L', 'XL'], colors: ['Tactical Black', 'Olive Drab'],
    material: 'Heavy Cotton Canvas', gender: 'UNISEX', style: 'Techwear / Street', occasion: 'Urban Active', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1
  },

  // Accessory Haven (str-9)
  {
    storeId: 'str-9', categoryId: 'cat-accessories', brandId: 'brd-7',
    name: 'Polarized Retro Acetate Sunglasses', slug: 'polarized-retro-acetate-sunglasses',
    desc: 'Bold rectangular sunglasses crafted from hand-polished Italian acetate with UV400 dark tint polarized lenses.',
    price: 320000, discountPrice: 270000, sizes: ['One Size'], colors: ['Black Frame / Black Tint', 'Tortoiseshell'],
    material: 'Handcrafted Acetate', gender: 'UNISEX', style: 'Retro Glam', occasion: 'Outdoor / Travel', season: 'Summer',
    img: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1
  },
  {
    storeId: 'str-9', categoryId: 'cat-accessories', brandId: 'brd-6',
    name: '18K Gold Plated Chunky Chain Necklace', slug: '18k-gold-plated-chunky-chain-necklace',
    desc: 'Hypoallergenic stainless steel chain necklace with 18K thick gold plating and secure lobster clasp.',
    price: 280000, discountPrice: null, sizes: ['45cm'], colors: ['Warm Gold'],
    material: '18K Gold Plated Stainless Steel', gender: 'WOMEN', style: 'Statement Jewelry', occasion: 'Daily / Party', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1
  },

  // Gentlemen & Co. Suits (str-10)
  {
    storeId: 'str-10', categoryId: 'cat-men-suits', brandId: 'brd-3',
    name: 'Bespoke Charcoal Italian Wool Suit', slug: 'bespoke-charcoal-italian-wool-suit',
    desc: 'Impeccably tailored 100% Super 130s Italian virgin wool two-piece suit with peak lapels and hand-stitched pick detailing.',
    price: 1450000, discountPrice: 1250000, sizes: ['48', '50', '52', '54'], colors: ['Charcoal Grey', 'Deep Black'],
    material: '100% Super 130s Wool', gender: 'MEN', style: 'Bespoke Executive', occasion: 'Wedding / Corporate', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1
  },
  {
    storeId: 'str-10', categoryId: 'cat-men-suits', brandId: 'brd-3',
    name: 'Egyptian Cotton Crisp White Dress Shirt', slug: 'egyptian-cotton-crisp-white-dress-shirt',
    desc: 'Non-iron 100% Giza Egyptian long-staple cotton tailored dress shirt with spread collar and mother-of-pearl buttons.',
    price: 360000, discountPrice: 310000, sizes: ['38', '39', '40', '41', '42'], colors: ['Crisp White', 'Sky Blue'],
    material: '100% Egyptian Cotton', gender: 'MEN', style: 'Formal Business', occasion: 'Work / Black Tie', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 0
  }
];

// Duplicate & synthesize additional product items to surpass 100 products for complete marketplace density
let idCounter = 1;
for (let loop = 0; loop < 5; loop++) {
  rawProducts.forEach((p) => {
    const pId = `prd-${idCounter++}`;
    const suffix = loop > 0 ? ` - Edition ${loop + 1}` : '';
    const slugSuffix = loop > 0 ? `-${loop + 1}` : '';

    insertProduct.run({
      id: pId,
      storeId: p.storeId,
      categoryId: p.categoryId,
      brandId: p.brandId,
      name: `${p.name}${suffix}`,
      slug: `${p.slug}${slugSuffix}`,
      description: p.desc,
      price: p.price,
      discountPrice: p.discountPrice,
      currency: 'UZS',
      sku: `SKU-${Math.floor(100000 + Math.random() * 900000)}`,
      stockQuantity: Math.floor(5 + Math.random() * 25),
      sizes: JSON.stringify(p.sizes),
      colors: JSON.stringify(p.colors),
      material: p.material,
      gender: p.gender,
      style: p.style,
      occasion: p.occasion,
      season: p.season,
      tags: JSON.stringify(['fashion', p.gender.toLowerCase(), p.style.toLowerCase(), 'trendmall']),
      originalImage: p.img,
      processedImages: JSON.stringify([p.img]),
      status: 'PUBLISHED',
      aiMetadata: JSON.stringify({ aiConfidence: 0.98, detectedCategory: p.categoryId, studioProcessed: true }),
      isFeatured: p.featured,
      isTrending: p.trending,
      viewsCount: Math.floor(50 + Math.random() * 500),
      createdAt: now,
    });
  });
}

console.log('✅ Seed completed successfully!');
console.log(`- Stores seeded: 10`);
console.log(`- Categories seeded: ${categories.length}`);
console.log(`- Brands seeded: ${brands.length}`);
console.log(`- Products seeded: ${idCounter - 1}`);
