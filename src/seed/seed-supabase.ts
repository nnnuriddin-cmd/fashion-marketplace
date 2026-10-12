import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// Deterministic UUID Helper
// Converts legacy string IDs (e.g. 'usr-admin-1', 'str-1', 'cat-women')
// into stable, deterministic RFC 4122 v5 UUIDs to preserve relational integrity.
// ============================================================================
const SEED_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export function toDeterministicUUID(id: string): string {
  const hash = crypto.createHash('sha1').update(SEED_NAMESPACE + id).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '5' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32),
  ].join('-');
}

// ============================================================================
// Raw Business Data (faithfully preserved from src/seed/seed.js)
// ============================================================================

const rawAdminUser = {
  legacyId: 'usr-admin-1',
  email: 'admin@trendmall.uz',
  passwordHash: 'admin123',
  fullName: 'Marketplace Admin',
  phone: '+998901112233',
  role: 'ADMIN',
  telegramId: '111000',
  telegramCode: '999888',
};

const rawCustomerUser = {
  legacyId: 'usr-customer-1',
  email: 'anora@gmail.com',
  passwordHash: 'customer123',
  fullName: 'Anora Karimova',
  phone: '+998901234567',
  role: 'CUSTOMER',
  telegramId: '222111',
  telegramCode: null,
};

const rawStores = [
  {
    legacyStoreId: 'str-1',
    legacyOwnerId: 'usr-seller-1',
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
    legacyStoreId: 'str-2',
    legacyOwnerId: 'usr-seller-2',
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
    legacyStoreId: 'str-3',
    legacyOwnerId: 'usr-seller-3',
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
    legacyStoreId: 'str-4',
    legacyOwnerId: 'usr-seller-4',
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
    legacyStoreId: 'str-5',
    legacyOwnerId: 'usr-seller-5',
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
    legacyStoreId: 'str-6',
    legacyOwnerId: 'usr-seller-6',
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
    legacyStoreId: 'str-7',
    legacyOwnerId: 'usr-seller-7',
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
    legacyStoreId: 'str-8',
    legacyOwnerId: 'usr-seller-8',
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
    legacyStoreId: 'str-9',
    legacyOwnerId: 'usr-seller-9',
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
    legacyStoreId: 'str-10',
    legacyOwnerId: 'usr-seller-10',
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

const rawCategories = [
  // Root categories
  { legacyId: 'cat-women', name: "Women's Fashion", slug: 'women', gender: 'WOMEN', parentLegacyId: null, image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80', sortOrder: 1 },
  { legacyId: 'cat-men', name: "Men's Fashion", slug: 'men', gender: 'MEN', parentLegacyId: null, image: 'https://images.unsplash.com/photo-1490578474895-699cd4e2cf59?auto=format&fit=crop&w=600&q=80', sortOrder: 2 },
  { legacyId: 'cat-shoes', name: 'Footwear & Shoes', slug: 'shoes', gender: 'UNISEX', parentLegacyId: null, image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80', sortOrder: 3 },
  { legacyId: 'cat-bags', name: 'Bags & Leather Goods', slug: 'bags', gender: 'UNISEX', parentLegacyId: null, image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80', sortOrder: 4 },
  { legacyId: 'cat-accessories', name: 'Accessories & Jewelry', slug: 'accessories', gender: 'UNISEX', parentLegacyId: null, image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=600&q=80', sortOrder: 5 },

  // Subcategories
  { legacyId: 'cat-women-blazers', name: 'Blazers & Jackets', slug: 'women-blazers', gender: 'WOMEN', parentLegacyId: 'cat-women', image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80', sortOrder: 1 },
  { legacyId: 'cat-women-dresses', name: 'Dresses & Gowns', slug: 'women-dresses', gender: 'WOMEN', parentLegacyId: 'cat-women', image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80', sortOrder: 2 },
  { legacyId: 'cat-women-tops', name: 'Tops & Knitwear', slug: 'women-tops', gender: 'WOMEN', parentLegacyId: 'cat-women', image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=600&q=80', sortOrder: 3 },
  { legacyId: 'cat-men-suits', name: 'Suits & Blazers', slug: 'men-suits', gender: 'MEN', parentLegacyId: 'cat-men', image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80', sortOrder: 1 },
  { legacyId: 'cat-men-outerwear', name: 'Jackets & Outerwear', slug: 'men-outerwear', gender: 'MEN', parentLegacyId: 'cat-men', image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80', sortOrder: 2 },
  { legacyId: 'cat-men-streetwear', name: 'Hoodies & Tees', slug: 'men-streetwear', gender: 'MEN', parentLegacyId: 'cat-men', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80', sortOrder: 3 },
  { legacyId: 'cat-shoes-sneakers', name: 'Sneakers', slug: 'shoes-sneakers', gender: 'UNISEX', parentLegacyId: 'cat-shoes', image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=600&q=80', sortOrder: 1 },
  { legacyId: 'cat-shoes-heels', name: 'Heels & Pumps', slug: 'shoes-heels', gender: 'WOMEN', parentLegacyId: 'cat-shoes', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=600&q=80', sortOrder: 2 },
];

const rawBrands = [
  { legacyId: 'brd-1', name: 'Zara', slug: 'zara', logo: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=200&q=80' },
  { legacyId: 'brd-2', name: 'Mango', slug: 'mango', logo: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=200&q=80' },
  { legacyId: 'brd-3', name: 'Massimo Dutti', slug: 'massimo-dutti', logo: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=200&q=80' },
  { legacyId: 'brd-4', name: 'Nike', slug: 'nike', logo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=200&q=80' },
  { legacyId: 'brd-5', name: 'Adidas', slug: 'adidas', logo: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?auto=format&fit=crop&w=200&q=80' },
  { legacyId: 'brd-6', name: 'Gucci', slug: 'gucci', logo: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=200&q=80' },
  { legacyId: 'brd-7', name: 'Prada', slug: 'prada', logo: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=200&q=80' },
  { legacyId: 'brd-8', name: 'Atelier Handmade', slug: 'atelier-handmade', logo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80' },
];

const rawProducts = [
  // Silk & Thread Boutique (str-1)
  {
    storeId: 'str-1', categoryId: 'cat-women-blazers', brandId: 'brd-3',
    name: "Women's Oversized Linen Blazer", slug: 'womens-oversized-linen-blazer',
    desc: 'Crafted from breathable European linen blend, featuring subtle shoulder structure, classic peak lapels, and double-breasted horn buttons.',
    price: 450000, discountPrice: 390000, sizes: ['S', 'M', 'L'], colors: ['Beige', 'Cream', 'Olive'],
    material: '80% Linen, 20% Cotton', gender: 'WOMEN', style: 'Oversized', occasion: 'Casual / Work', season: 'Summer',
    img: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1,
  },
  {
    storeId: 'str-1', categoryId: 'cat-women-dresses', brandId: 'brd-8',
    name: 'Silk Slip Midi Dress in Emerald', slug: 'silk-slip-midi-dress-emerald',
    desc: 'Luxurious pure mulberry silk slip dress with adjustable bias-cut shoulder straps and a flattering cowl neckline.',
    price: 680000, discountPrice: 590000, sizes: ['XS', 'S', 'M'], colors: ['Emerald Green', 'Champagne'],
    material: '100% Mulberry Silk', gender: 'WOMEN', style: 'Elegant', occasion: 'Party / Evening', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1,
  },
  {
    storeId: 'str-1', categoryId: 'cat-women-dresses', brandId: 'brd-2',
    name: 'Floral Chiffon Wrap Maxi Dress', slug: 'floral-chiffon-wrap-maxi-dress',
    desc: 'Flowing floral printed chiffon dress featuring a wrap waist sash, subtle flutter sleeves, and romantic tiered ruffle hemline.',
    price: 520000, discountPrice: null, sizes: ['S', 'M', 'L', 'XL'], colors: ['Floral Pink', 'Sky Blue'],
    material: 'Chiffon Silk', gender: 'WOMEN', style: 'Romantic', occasion: 'Wedding / Outdoor', season: 'Spring',
    img: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1,
  },
  {
    storeId: 'str-1', categoryId: 'cat-women-tops', brandId: 'brd-8',
    name: 'Cashmere Blend Knit Cardigan', slug: 'cashmere-blend-knit-cardigan',
    desc: 'Ultra-soft cashmere and wool blend cardigan with tortoiseshell buttons and rib-knit cuffs.',
    price: 490000, discountPrice: 420000, sizes: ['S', 'M', 'L'], colors: ['Oatmeal', 'Soft Mocha'],
    material: '30% Cashmere, 70% Fine Merino', gender: 'WOMEN', style: 'Cozy Classic', occasion: 'Daily / Work', season: 'Autumn / Winter',
    img: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 0,
  },

  // Urban Couture Studio (str-2)
  {
    storeId: 'str-2', categoryId: 'cat-men-outerwear', brandId: 'brd-1',
    name: 'Minimalist Black Bomber Jacket', slug: 'minimalist-black-bomber-jacket',
    desc: 'Water-resistant technical satin bomber jacket with matte black hardware, dual zip closure, and interior utility pocket.',
    price: 590000, discountPrice: 495000, sizes: ['M', 'L', 'XL'], colors: ['Matte Black', 'Sage Green'],
    material: 'Nylon Tech Satin', gender: 'MEN', style: 'Minimalist', occasion: 'Streetwear / Daily', season: 'Autumn',
    img: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1,
  },
  {
    storeId: 'str-2', categoryId: 'cat-men-streetwear', brandId: 'brd-1',
    name: 'Heavyweight Fleece Hoodie', slug: 'heavyweight-fleece-hoodie',
    desc: '450 GSM custom French terry cotton hoodie with double-lined hood and drop shoulder design.',
    price: 380000, discountPrice: 320000, sizes: ['S', 'M', 'L', 'XL'], colors: ['Charcoal', 'Washed Beige', 'Black'],
    material: '100% Heavy Cotton', gender: 'MEN', style: 'Streetwear', occasion: 'Casual', season: 'Winter',
    img: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1,
  },
  {
    storeId: 'str-2', categoryId: 'cat-men-streetwear', brandId: 'brd-5',
    name: 'Oversized Boxy Graphic Tee', slug: 'oversized-boxy-graphic-tee',
    desc: 'Relaxed vintage washed cotton t-shirt featuring high-density screenprinted urban typographic artwork on back.',
    price: 240000, discountPrice: null, sizes: ['M', 'L', 'XL'], colors: ['Vintage Washed Black', 'Off-White'],
    material: '100% Combed Cotton', gender: 'UNISEX', style: 'Urban Oversized', occasion: 'Daily Streetwear', season: 'Summer',
    img: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 0,
  },

  // Elegance Women Atelier (str-3)
  {
    storeId: 'str-3', categoryId: 'cat-women-blazers', brandId: 'brd-3',
    name: 'Tailored Wool Blend Pantsuit', slug: 'tailored-wool-blend-pantsuit',
    desc: 'Sophisticated two-piece office suit including a structured double-breasted jacket and sleek high-waisted pleated trousers.',
    price: 950000, discountPrice: 850000, sizes: ['S', 'M', 'L'], colors: ['Midnight Navy', 'Camel'],
    material: 'Italian Wool Blend', gender: 'WOMEN', style: 'Tailored Formal', occasion: 'Business / Executive', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1548624313-0396c75e4b1a?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1,
  },
  {
    storeId: 'str-3', categoryId: 'cat-women-dresses', brandId: 'brd-2',
    name: 'Pleated A-Line Midi Skirt & Blouse Set', slug: 'pleated-a-line-midi-skirt-blouse-set',
    desc: 'Chic satin accordion-pleated skirt paired with a high-neck keyhole silk blouse for elegant daytime events.',
    price: 580000, discountPrice: null, sizes: ['S', 'M', 'L'], colors: ['Dusty Rose', 'Ivory'],
    material: 'Polyester Satin', gender: 'WOMEN', style: 'Classic Elegant', occasion: 'Work / Luncheon', season: 'Spring',
    img: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 0,
  },

  // Denim & Co Tashkent (str-4)
  {
    storeId: 'str-4', categoryId: 'cat-women-blazers', brandId: 'brd-1',
    name: 'Vintage Wash Trucker Denim Jacket', slug: 'vintage-wash-trucker-denim-jacket',
    desc: 'Classic 14oz rigid denim trucker jacket with custom brass buttons, chest flap pockets, and hand-distressed detailing.',
    price: 420000, discountPrice: 350000, sizes: ['S', 'M', 'L', 'XL'], colors: ['Vintage Blue Wash', 'Washed Black'],
    material: '100% Cotton Selvedge Denim', gender: 'UNISEX', style: 'Vintage Casual', occasion: 'Everyday Wear', season: 'Autumn',
    img: 'https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1,
  },
  {
    storeId: 'str-4', categoryId: 'cat-men-streetwear', brandId: 'brd-1',
    name: 'Straight Leg Selvedge Raw Jeans', slug: 'straight-leg-selvedge-raw-jeans',
    desc: 'Authentic 15oz Japanese selvedge denim jeans featuring a classic mid-rise straight leg fit and red selvedge ID line.',
    price: 480000, discountPrice: null, sizes: ['30', '32', '34', '36'], colors: ['Indigo Blue'],
    material: 'Japanese Selvedge Denim', gender: 'MEN', style: 'Heritage', occasion: 'Casual', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1,
  },

  // Leather Craft & Bags (str-5)
  {
    storeId: 'str-5', categoryId: 'cat-bags', brandId: 'brd-6',
    name: 'Handcrafted Full-Grain Leather Tote', slug: 'handcrafted-full-grain-leather-tote',
    desc: 'Spacious structured shopper tote bag made from premium vegetable-tanned Italian leather with interior laptop sleeve.',
    price: 890000, discountPrice: 750000, sizes: ['One Size'], colors: ['Cognac Brown', 'Obsidian Black'],
    material: 'Full-Grain Italian Calfskin', gender: 'UNISEX', style: 'Luxury Craft', occasion: 'Work / Travel', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1,
  },
  {
    storeId: 'str-5', categoryId: 'cat-bags', brandId: 'brd-7',
    name: 'Structured Crossbody Saddle Bag', slug: 'structured-crossbody-saddle-bag',
    desc: 'Curved silhouette shoulder bag featuring polished gold hardware, magnetic flap lock, and adjustable leather cross strap.',
    price: 640000, discountPrice: null, sizes: ['Medium'], colors: ['Deep Burgundy', 'Cream White'],
    material: 'Pebbled Calf Leather', gender: 'WOMEN', style: 'Chic Modern', occasion: 'Daily / Evening', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1,
  },

  // Shoe Vault Tashkent (str-6)
  {
    storeId: 'str-6', categoryId: 'cat-shoes-sneakers', brandId: 'brd-4',
    name: 'Air Retro Leather High-Top Sneakers', slug: 'air-retro-leather-high-top-sneakers',
    desc: 'Iconic high-top leather sneakers with cushioned Air sole unit, retro color blocking, and durable rubber outsole.',
    price: 850000, discountPrice: 720000, sizes: ['39', '40', '41', '42', '43', '44'], colors: ['White / Red / Black'],
    material: 'Genuine Leather & Rubber', gender: 'UNISEX', style: 'Street / Retro', occasion: 'Sport Casual', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1,
  },
  {
    storeId: 'str-6', categoryId: 'cat-shoes-heels', brandId: 'brd-2',
    name: 'Italian Leather Pointed Toe Stiletto Pumps', slug: 'italian-leather-pointed-toe-stiletto-pumps',
    desc: 'Sleek 90mm stiletto heels with a sharp pointed toe silhouette and padded leather footbed for effortless elegance.',
    price: 720000, discountPrice: 620000, sizes: ['36', '37', '38', '39', '40'], colors: ['Nude Beige', 'Classic Black'],
    material: 'Nappa Leather', gender: 'WOMEN', style: 'Luxury Glam', occasion: 'Evening / Formal', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 0,
  },
  {
    storeId: 'str-6', categoryId: 'cat-shoes-sneakers', brandId: 'brd-5',
    name: 'Suede Vintage Runner Sneakers', slug: 'suede-vintage-runner-sneakers',
    desc: 'Retro-inspired running sneakers with soft suede overlays, breathable mesh upper, and lightweight EVA foam midsole.',
    price: 540000, discountPrice: null, sizes: ['40', '41', '42', '43'], colors: ['Grey / Off-White'],
    material: 'Suede & Mesh', gender: 'UNISEX', style: 'Vintage Sport', occasion: 'Daily Walk', season: 'Spring / Summer',
    img: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1,
  },

  // Velvet & Lace Couture (str-7)
  {
    storeId: 'str-7', categoryId: 'cat-women-dresses', brandId: 'brd-8',
    name: 'Royal Velvet Evening Ball Gown', slug: 'royal-velvet-evening-ball-gown',
    desc: 'Opulent deep midnight blue plush velvet dress with off-the-shoulder neckline, corset boning bodice, and thigh slit hem.',
    price: 1200000, discountPrice: 990000, sizes: ['S', 'M', 'L'], colors: ['Midnight Velvet Blue', 'Ruby Red'],
    material: 'Silk Velvet', gender: 'WOMEN', style: 'Couture Evening', occasion: 'Gala / Wedding', season: 'Winter',
    img: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1,
  },
  {
    storeId: 'str-7', categoryId: 'cat-women-dresses', brandId: 'brd-8',
    name: 'French Lace Embroidered Midi Cocktail Dress', slug: 'french-lace-embroidered-midi-cocktail-dress',
    desc: 'Delicate floral eyelash lace over nude lining, featuring sheer long sleeves and an scalloped hemline.',
    price: 880000, discountPrice: null, sizes: ['XS', 'S', 'M'], colors: ['Black Lace / Nude', 'White Lace'],
    material: 'French Guipure Lace', gender: 'WOMEN', style: 'Romantic Couture', occasion: 'Cocktail / Reception', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 0,
  },

  // StreetStyle X (str-8)
  {
    storeId: 'str-8', categoryId: 'cat-men-streetwear', brandId: 'brd-1',
    name: 'Utility Cargo Pants with Straps', slug: 'utility-cargo-pants-straps',
    desc: 'Techwear cargo trousers with heavy cotton canvas weave, tactical webbing straps, adjustable ankle cuffs, and 8 functional pockets.',
    price: 460000, discountPrice: 390000, sizes: ['M', 'L', 'XL'], colors: ['Tactical Black', 'Olive Drab'],
    material: 'Heavy Cotton Canvas', gender: 'UNISEX', style: 'Techwear / Street', occasion: 'Urban Active', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1,
  },

  // Accessory Haven (str-9)
  {
    storeId: 'str-9', categoryId: 'cat-accessories', brandId: 'brd-7',
    name: 'Polarized Retro Acetate Sunglasses', slug: 'polarized-retro-acetate-sunglasses',
    desc: 'Bold rectangular sunglasses crafted from hand-polished Italian acetate with UV400 dark tint polarized lenses.',
    price: 320000, discountPrice: 270000, sizes: ['One Size'], colors: ['Black Frame / Black Tint', 'Tortoiseshell'],
    material: 'Handcrafted Acetate', gender: 'UNISEX', style: 'Retro Glam', occasion: 'Outdoor / Travel', season: 'Summer',
    img: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1,
  },
  {
    storeId: 'str-9', categoryId: 'cat-accessories', brandId: 'brd-6',
    name: '18K Gold Plated Chunky Chain Necklace', slug: '18k-gold-plated-chunky-chain-necklace',
    desc: 'Hypoallergenic stainless steel chain necklace with 18K thick gold plating and secure lobster clasp.',
    price: 280000, discountPrice: null, sizes: ['45cm'], colors: ['Warm Gold'],
    material: '18K Gold Plated Stainless Steel', gender: 'WOMEN', style: 'Statement Jewelry', occasion: 'Daily / Party', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 1,
  },

  // Gentlemen & Co. Suits (str-10)
  {
    storeId: 'str-10', categoryId: 'cat-men-suits', brandId: 'brd-3',
    name: 'Bespoke Charcoal Italian Wool Suit', slug: 'bespoke-charcoal-italian-wool-suit',
    desc: 'Impeccably tailored 100% Super 130s Italian virgin wool two-piece suit with peak lapels and hand-stitched pick detailing.',
    price: 1450000, discountPrice: 1250000, sizes: ['48', '50', '52', '54'], colors: ['Charcoal Grey', 'Deep Black'],
    material: '100% Super 130s Wool', gender: 'MEN', style: 'Bespoke Executive', occasion: 'Wedding / Corporate', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80',
    featured: 1, trending: 1,
  },
  {
    storeId: 'str-10', categoryId: 'cat-men-suits', brandId: 'brd-3',
    name: 'Egyptian Cotton Crisp White Dress Shirt', slug: 'egyptian-cotton-crisp-white-dress-shirt',
    desc: 'Non-iron 100% Giza Egyptian long-staple cotton tailored dress shirt with spread collar and mother-of-pearl buttons.',
    price: 360000, discountPrice: 310000, sizes: ['38', '39', '40', '41', '42'], colors: ['Crisp White', 'Sky Blue'],
    material: '100% Egyptian Cotton', gender: 'MEN', style: 'Formal Business', occasion: 'Work / Black Tie', season: 'All Season',
    img: 'https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?auto=format&fit=crop&w=800&q=80',
    featured: 0, trending: 0,
  },
];

// ============================================================================
// Payload Builders (Mapping to Supabase Schema)
// ============================================================================

export interface SeedPayloads {
  users: Record<string, unknown>[];
  stores: Record<string, unknown>[];
  brands: Record<string, unknown>[];
  rootCategories: Record<string, unknown>[];
  childCategories: Record<string, unknown>[];
  products: Record<string, unknown>[];
}

export function buildSeedPayloads(): SeedPayloads {
  const now = new Date().toISOString();

  // 1. Users: 1 admin + 1 customer + 10 sellers = 12 users
  const users: Record<string, unknown>[] = [
    {
      id: toDeterministicUUID(rawAdminUser.legacyId),
      email: rawAdminUser.email,
      password_hash: rawAdminUser.passwordHash,
      full_name: rawAdminUser.fullName,
      phone: rawAdminUser.phone,
      role: rawAdminUser.role,
      telegram_id: rawAdminUser.telegramId,
      telegram_code: rawAdminUser.telegramCode,
      created_at: now,
      updated_at: now,
    },
    {
      id: toDeterministicUUID(rawCustomerUser.legacyId),
      email: rawCustomerUser.email,
      password_hash: rawCustomerUser.passwordHash,
      full_name: rawCustomerUser.fullName,
      phone: rawCustomerUser.phone,
      role: rawCustomerUser.role,
      telegram_id: rawCustomerUser.telegramId,
      telegram_code: rawCustomerUser.telegramCode,
      created_at: now,
      updated_at: now,
    },
  ];

  for (const s of rawStores) {
    users.push({
      id: toDeterministicUUID(s.legacyOwnerId),
      email: s.email,
      password_hash: 'seller123',
      full_name: s.sellerName,
      phone: s.phone,
      role: 'SELLER',
      telegram_id: `tg-${s.legacyStoreId}`,
      telegram_code: `code-${s.legacyStoreId}`,
      created_at: now,
      updated_at: now,
    });
  }

  // 2. Stores: 10 stores
  const stores: Record<string, unknown>[] = rawStores.map((s) => ({
    id: toDeterministicUUID(s.legacyStoreId),
    owner_id: toDeterministicUUID(s.legacyOwnerId),
    name: s.storeName,
    slug: s.slug,
    description: s.desc,
    logo: s.logo,
    cover_image: s.cover,
    location: s.location,
    city: 'Tashkent',
    phone: s.phone,
    telegram_username: s.telegram,
    status: s.status,
    rating: s.rating,
    commission_rate: 10.0,
    created_at: now,
    updated_at: now,
  }));

  // 3. Brands: 8 brands
  const brands: Record<string, unknown>[] = rawBrands.map((b) => ({
    id: toDeterministicUUID(b.legacyId),
    name: b.name,
    slug: b.slug,
    logo: b.logo,
    created_at: now,
    updated_at: now,
  }));

  // 4. Categories: 5 root + 8 child = 13 categories
  const rootCategories: Record<string, unknown>[] = rawCategories
    .filter((c) => c.parentLegacyId === null)
    .map((c) => ({
      id: toDeterministicUUID(c.legacyId),
      name: c.name,
      slug: c.slug,
      gender: c.gender,
      parent_id: null,
      image: c.image,
      sort_order: c.sortOrder,
      created_at: now,
      updated_at: now,
    }));

  const childCategories: Record<string, unknown>[] = rawCategories
    .filter((c) => c.parentLegacyId !== null)
    .map((c) => ({
      id: toDeterministicUUID(c.legacyId),
      name: c.name,
      slug: c.slug,
      gender: c.gender,
      parent_id: toDeterministicUUID(c.parentLegacyId!),
      image: c.image,
      sort_order: c.sortOrder,
      created_at: now,
      updated_at: now,
    }));

  // 5. Products: 23 base products * 5 loop editions = 115 products
  const products: Record<string, unknown>[] = [];
  let idCounter = 1;

  for (let loop = 0; loop < 5; loop++) {
    rawProducts.forEach((p) => {
      const legacyProdId = `prd-${idCounter++}`;
      const suffix = loop > 0 ? ` - Edition ${loop + 1}` : '';
      const slugSuffix = loop > 0 ? `-${loop + 1}` : '';

      products.push({
        id: toDeterministicUUID(legacyProdId),
        store_id: toDeterministicUUID(p.storeId),
        category_id: toDeterministicUUID(p.categoryId),
        brand_id: toDeterministicUUID(p.brandId),
        title: `${p.name}${suffix}`, // Map name -> title
        slug: `${p.slug}${slugSuffix}`,
        description: p.desc,
        price: p.price,
        discount_price: p.discountPrice,
        currency: 'UZS',
        sku: `SKU-${100000 + (idCounter * 73) % 900000}`,
        stock_quantity: 10 + (idCounter % 20),
        sizes: p.sizes, // Native array for JSONB
        colors: p.colors, // Native array for JSONB
        material: p.material,
        gender: p.gender,
        style: p.style,
        occasion: p.occasion,
        season: p.season,
        tags: ['fashion', p.gender.toLowerCase(), p.style.toLowerCase(), 'trendmall'],
        original_image: p.img,
        processed_images: [p.img],
        status: 'ACTIVE', // Map PUBLISHED -> ACTIVE
        ai_metadata: {
          aiConfidence: 0.98,
          detectedCategory: p.categoryId,
          studioProcessed: true,
        },
        is_featured: Boolean(p.featured), // 0/1 -> boolean
        is_trending: Boolean(p.trending), // 0/1 -> boolean
        views_count: 50 + (idCounter * 17) % 450,
        created_at: now,
        updated_at: now,
      });
    });
  }

  return {
    users,
    stores,
    brands,
    rootCategories,
    childCategories,
    products,
  };
}

// ============================================================================
// Main Execution / Dry-Run Validation
// ============================================================================

async function runSeed() {
  const isDryRun = process.argv.includes('--dry-run');
  const payloads = buildSeedPayloads();

  console.log('📦 Supabase Seed Migration Script');
  console.log(`- Mode: ${isDryRun ? 'DRY-RUN (Validation only, no DB writes)' : 'LIVE SEED'}`);
  console.log('----------------------------------------------------');
  console.log(`👤 Users to insert/upsert:          ${payloads.users.length}`);
  console.log(`🏪 Stores to insert/upsert:         ${payloads.stores.length}`);
  console.log(`🏷️  Root Categories to insert:       ${payloads.rootCategories.length}`);
  console.log(`📂 Child Categories to insert:      ${payloads.childCategories.length}`);
  console.log(`💎 Brands to insert/upsert:         ${payloads.brands.length}`);
  console.log(`👗 Products to insert/upsert:       ${payloads.products.length}`);
  console.log('----------------------------------------------------');

  // Verify relational integrity among generated payloads
  const userIds = new Set(payloads.users.map((u) => u.id as string));
  const storeIds = new Set(payloads.stores.map((s) => s.id as string));
  const brandIds = new Set(payloads.brands.map((b) => b.id as string));
  const categoryIds = new Set([
    ...payloads.rootCategories.map((c) => c.id as string),
    ...payloads.childCategories.map((c) => c.id as string),
  ]);

  // Validate store owners
  for (const s of payloads.stores) {
    if (!userIds.has(s.owner_id as string)) {
      throw new Error(`Integrity error: Store "${s.name}" references non-existent owner_id ${s.owner_id}`);
    }
  }

  // Validate child category parents
  for (const c of payloads.childCategories) {
    if (!categoryIds.has(c.parent_id as string)) {
      throw new Error(`Integrity error: Category "${c.name}" references non-existent parent_id ${c.parent_id}`);
    }
  }

  // Validate product foreign keys
  for (const p of payloads.products) {
    if (!storeIds.has(p.store_id as string)) {
      throw new Error(`Integrity error: Product "${p.title}" references non-existent store_id ${p.store_id}`);
    }
    if (!categoryIds.has(p.category_id as string)) {
      throw new Error(`Integrity error: Product "${p.title}" references non-existent category_id ${p.category_id}`);
    }
    if (!brandIds.has(p.brand_id as string)) {
      throw new Error(`Integrity error: Product "${p.title}" references non-existent brand_id ${p.brand_id}`);
    }
  }

  console.log('✅ Relational integrity check PASSED: all foreign keys resolve cleanly.');

  // Safe environment loader (checks process.env, .env.local, and .env)
  function parseEnvFile(filePath: string): Record<string, string> {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const result: Record<string, string> = {};
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
    return result;
  }

  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let serviceRoleKeySource = serviceRoleKey ? 'process.env' : undefined;

  // 1. Check .env.local first (standard Next.js local secret file)
  const envLocalPath = path.join(process.cwd(), '.env.local');
  const envLocal = parseEnvFile(envLocalPath);
  if (!supabaseUrl && envLocal.NEXT_PUBLIC_SUPABASE_URL) {
    supabaseUrl = envLocal.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (!serviceRoleKey && envLocal.SUPABASE_SERVICE_ROLE_KEY) {
    serviceRoleKey = envLocal.SUPABASE_SERVICE_ROLE_KEY;
    serviceRoleKeySource = '.env.local';
  }

  // 2. Check .env as fallback
  const envPath = path.join(process.cwd(), '.env');
  const envDefault = parseEnvFile(envPath);
  if (!supabaseUrl && envDefault.NEXT_PUBLIC_SUPABASE_URL) {
    supabaseUrl = envDefault.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (!serviceRoleKey && envDefault.SUPABASE_SERVICE_ROLE_KEY) {
    serviceRoleKey = envDefault.SUPABASE_SERVICE_ROLE_KEY;
    serviceRoleKeySource = '.env';
  }

  if (isDryRun) {
    console.log('\n🔍 Sample Generated Records (Dry-Run):');
    console.log('- User:', JSON.stringify(payloads.users[0], null, 2));
    console.log('- Store:', JSON.stringify(payloads.stores[0], null, 2));
    console.log('- Brand:', JSON.stringify(payloads.brands[0], null, 2));
    console.log('- Root Category:', JSON.stringify(payloads.rootCategories[0], null, 2));
    console.log('- Child Category:', JSON.stringify(payloads.childCategories[0], null, 2));
    console.log('- Product:', JSON.stringify(payloads.products[0], null, 2));

    console.log('\n🔐 Environment Check (Dry-Run):');
    console.log(`- NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'Configured' : 'Missing'}`);
    console.log(
      `- SUPABASE_SERVICE_ROLE_KEY: ${
        serviceRoleKey ? `Detected (loaded from ${serviceRoleKeySource})` : 'NOT detected (missing in .env.local)'
      }`
    );
    console.log('\n[Dry-Run complete: No database mutations were executed.]');
    return;
  }

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
      'Please ensure SUPABASE_SERVICE_ROLE_KEY is set in .env.local.'
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  console.log('🚀 Executing live seed against Supabase...');

  // 1. Users
  console.log('-> Upserting users...');
  const { error: userErr } = await supabase.from('users').upsert(payloads.users, { onConflict: 'id' });
  if (userErr) throw new Error(`Failed to upsert users: ${userErr.message}`);

  // 2. Stores
  console.log('-> Upserting stores...');
  const { error: storeErr } = await supabase.from('stores').upsert(payloads.stores, { onConflict: 'id' });
  if (storeErr) throw new Error(`Failed to upsert stores: ${storeErr.message}`);

  // 3. Brands
  console.log('-> Upserting brands...');
  const { error: brandErr } = await supabase.from('brands').upsert(payloads.brands, { onConflict: 'id' });
  if (brandErr) throw new Error(`Failed to upsert brands: ${brandErr.message}`);

  // 4. Root Categories
  console.log('-> Upserting root categories...');
  const { error: rootCatErr } = await supabase.from('categories').upsert(payloads.rootCategories, { onConflict: 'id' });
  if (rootCatErr) throw new Error(`Failed to upsert root categories: ${rootCatErr.message}`);

  // 5. Child Categories
  console.log('-> Upserting child categories...');
  const { error: childCatErr } = await supabase.from('categories').upsert(payloads.childCategories, { onConflict: 'id' });
  if (childCatErr) throw new Error(`Failed to upsert child categories: ${childCatErr.message}`);

  // 6. Products (in batches of 25)
  console.log('-> Upserting products in batches of 25...');
  const batchSize = 25;
  for (let i = 0; i < payloads.products.length; i += batchSize) {
    const batch = payloads.products.slice(i, i + batchSize);
    const { error: prodErr } = await supabase.from('products').upsert(batch, { onConflict: 'id' });
    if (prodErr) throw new Error(`Failed to upsert products batch ${i}..${i + batch.length}: ${prodErr.message}`);
  }

  console.log('🎉 Live seed completed successfully!');
}

// Execute when run as script
if (require.main === module || process.argv[1]?.includes('seed-supabase')) {
  runSeed().catch((err) => {
    console.error('❌ Seed execution failed:', err);
    process.exit(1);
  });
}
