import 'server-only';
import { CategoryRow, BrandRow } from '@/lib/db/queries';
import { VisionAnalysisResult } from '@/lib/ai/vision-analyzer';

export interface PriceValidationResult {
  valid: boolean;
  price?: number;
  error?: string;
}

export interface StockValidationResult {
  valid: boolean;
  stock?: number;
  error?: string;
}

export interface MappedCategoryResult {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
}

export interface MappedBrandResult {
  brandId: string | null;
  brandName: string | null;
}

/**
 * Normalizes a string to lowercase alphanumeric characters only.
 */
function cleanAlphanumeric(str: string | null | undefined): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Validates product price input in Uzbek Som (UZS).
 * Enforces positive integer, minimum 1,000 UZS, maximum 500,000,000 UZS.
 * Normalizes spaces, commas, and currency labels.
 */
export function validatePriceInput(input: unknown): PriceValidationResult {
  if (typeof input !== 'string' && typeof input !== 'number') {
    return { valid: false, error: 'Price must be a valid number.' };
  }

  const cleanStr = String(input)
    .toLowerCase()
    .replace(/(uzs|сум|so'm|som)/gi, '')
    .replace(/[\s,_]/g, '')
    .trim();

  if (!cleanStr || !/^\d+$/.test(cleanStr)) {
    return {
      valid: false,
      error: 'Please enter a valid numeric price in UZS (e.g. <code>450000</code> or <code>450 000</code>).',
    };
  }

  const num = Number(cleanStr);
  if (!Number.isFinite(num) || isNaN(num)) {
    return { valid: false, error: 'Invalid numeric value.' };
  }

  if (num <= 0) {
    return { valid: false, error: 'Price must be greater than zero.' };
  }

  if (num < 1000) {
    return { valid: false, error: 'Minimum price is 1,000 UZS.' };
  }

  if (num > 500000000) {
    return { valid: false, error: 'Price cannot exceed 500,000,000 UZS (500 million).' };
  }

  return { valid: true, price: Math.round(num) };
}

/**
 * Validates product stock quantity input.
 * Enforces integer >= 1, rejects decimals, enforces maximum 10,000 units.
 */
export function validateStockInput(input: unknown): StockValidationResult {
  if (typeof input !== 'string' && typeof input !== 'number') {
    return { valid: false, error: 'Stock quantity must be a whole number.' };
  }

  const rawStr = String(input).trim();
  if (rawStr.includes('.') || rawStr.includes(',')) {
    return { valid: false, error: 'Stock quantity must be a whole integer (decimals not allowed).' };
  }

  const cleanStr = rawStr.replace(/[\s_]/g, '');
  if (!/^\d+$/.test(cleanStr)) {
    return {
      valid: false,
      error: 'Please enter a valid whole number (e.g. <code>5</code> or <code>10</code>).',
    };
  }

  const num = Number(cleanStr);
  if (!Number.isInteger(num)) {
    return { valid: false, error: 'Stock must be an integer.' };
  }

  if (num < 1) {
    return { valid: false, error: 'Stock must be at least 1 unit.' };
  }

  if (num > 10000) {
    return { valid: false, error: 'Stock cannot exceed 10,000 units.' };
  }

  return { valid: true, stock: num };
}

/**
 * Deterministically maps untrusted AI category suggestion and gender to a verified database category.
 * Prioritizes:
 * 1. Normalized exact match on name or slug
 * 2. High-precision semantic keywords (dresses, blazers, sneakers, bags, jewelry, etc.)
 * 3. Token overlap scoring with existing categories (subcategories prioritized)
 * 4. Fallback to root category by gender
 */
export function matchCategory(
  aiCat: string | null | undefined,
  gender: string | null | undefined,
  categories: CategoryRow[]
): MappedCategoryResult | null {
  if (!aiCat || categories.length === 0) return null;

  const cleanAi = cleanAlphanumeric(aiCat);
  const words = aiCat
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !['and', 'the', 'for', 'with'].includes(w));
  const g = (gender || '').toUpperCase();
  const isMen = g === 'MEN';
  const isWomen = g === 'WOMEN';

  // 1. Direct normalized exact name/slug match
  for (const cat of categories) {
    if (cleanAlphanumeric(cat.name) === cleanAi || cleanAlphanumeric(cat.slug) === cleanAi) {
      return { categoryId: cat.id, categoryName: cat.name, categorySlug: cat.slug };
    }
  }

  // 2. High-priority keyword rules based on gender and fashion taxonomy
  if (words.some((w) => ['dress', 'gown', 'skirt', 'frock'].includes(w))) {
    const d = categories.find((c) => c.slug === 'women-dresses');
    if (d) return { categoryId: d.id, categoryName: d.name, categorySlug: d.slug };
  }
  if (words.some((w) => ['heel', 'pump', 'stiletto'].includes(w))) {
    const h = categories.find((c) => c.slug === 'women-heels');
    if (h) return { categoryId: h.id, categoryName: h.name, categorySlug: h.slug };
  }
  if (words.some((w) => ['sneaker', 'trainer'].includes(w))) {
    const s = categories.find((c) => c.slug === 'shoes-sneakers');
    if (s) return { categoryId: s.id, categoryName: s.name, categorySlug: s.slug };
  }
  if (words.some((w) => ['boot', 'shoe', 'footwear', 'loafer', 'sandal', 'oxford'].includes(w))) {
    const s = categories.find((c) => c.slug === 'shoes');
    if (s) return { categoryId: s.id, categoryName: s.name, categorySlug: s.slug };
  }
  if (words.some((w) => ['bag', 'handbag', 'tote', 'clutch', 'backpack', 'purse', 'wallet'].includes(w))) {
    const b = categories.find((c) => c.slug === 'bags');
    if (b) return { categoryId: b.id, categoryName: b.name, categorySlug: b.slug };
  }
  if (words.some((w) => ['jewelry', 'accessory', 'necklace', 'bracelet', 'ring', 'belt', 'scarf', 'hat', 'sunglasses', 'watch'].includes(w))) {
    const a = categories.find((c) => c.slug === 'accessories');
    if (a) return { categoryId: a.id, categoryName: a.name, categorySlug: a.slug };
  }

  // Suits & Blazers vs Outerwear
  if (words.some((w) => ['suit', 'tuxedo'].includes(w))) {
    const s = categories.find((c) => (isMen ? c.slug === 'men-suits' : c.slug === 'women-blazers')) || categories.find((c) => c.slug === 'men-suits');
    if (s) return { categoryId: s.id, categoryName: s.name, categorySlug: s.slug };
  }
  if (words.some((w) => ['blazer'].includes(w))) {
    const b = categories.find((c) => (isMen ? c.slug === 'men-suits' : c.slug === 'women-blazers'));
    if (b) return { categoryId: b.id, categoryName: b.name, categorySlug: b.slug };
  }
  if (words.some((w) => ['hoodie', 'sweatshirt', 'tee', 'tshirt', 'streetwear'].includes(w))) {
    const h = categories.find((c) => (isMen ? c.slug === 'men-streetwear' : c.slug === 'women-tops'));
    if (h) return { categoryId: h.id, categoryName: h.name, categorySlug: h.slug };
  }
  if (words.some((w) => ['jacket', 'coat', 'parka', 'outerwear', 'trench', 'windbreaker'].includes(w))) {
    const j = categories.find((c) => (isMen ? c.slug === 'men-outerwear' : c.slug === 'women-blazers'));
    if (j) return { categoryId: j.id, categoryName: j.name, categorySlug: j.slug };
  }
  if (words.some((w) => ['top', 'knitwear', 'sweater', 'blouse', 'cardigan', 'shirt', 'polo'].includes(w))) {
    const t = categories.find((c) => (isMen ? c.slug === 'men-streetwear' : c.slug === 'women-tops'));
    if (t) return { categoryId: t.id, categoryName: t.name, categorySlug: t.slug };
  }

  // 3. Token overlap scoring with existing categories (subcategories prioritized over root)
  let bestCat: CategoryRow | null = null;
  let bestScore = 0;
  for (const cat of categories) {
    const catWords = cat.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    let score = 0;
    for (const w of words) {
      if (catWords.includes(w)) score += 3;
      else if (catWords.some((cw) => cw.includes(w) || w.includes(cw))) score += 1;
    }
    if (g && cat.gender && cat.gender === g) score += 1;
    if (cat.parent_id) score += 1; // Prioritize specific subcategory over generic root
    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
    }
  }
  if (bestScore >= 3 && bestCat) {
    return { categoryId: bestCat.id, categoryName: bestCat.name, categorySlug: bestCat.slug };
  }

  // 4. Fallback to gender root category
  if (isMen) {
    const m = categories.find((c) => c.slug === 'men');
    if (m) return { categoryId: m.id, categoryName: m.name, categorySlug: m.slug };
  }
  if (isWomen) {
    const w = categories.find((c) => c.slug === 'women');
    if (w) return { categoryId: w.id, categoryName: w.name, categorySlug: w.slug };
  }

  return null;
}

/**
 * Deterministically maps untrusted AI brand suggestion to a verified database brand.
 * If not matched, returns null for brandId (never invents a brand ID).
 */
export function matchBrand(
  aiBrand: string | null | undefined,
  brands: BrandRow[]
): MappedBrandResult {
  if (!aiBrand || brands.length === 0) {
    return { brandId: null, brandName: null };
  }

  const cleanAi = cleanAlphanumeric(aiBrand);
  for (const b of brands) {
    if (cleanAlphanumeric(b.name) === cleanAi || cleanAlphanumeric(b.slug) === cleanAi) {
      return { brandId: b.id, brandName: b.name };
    }
  }

  return { brandId: null, brandName: aiBrand.trim() };
}

/**
 * Formats the comprehensive product preview card for seller review before publication.
 */
export function formatProductPreview(params: {
  title: string;
  categoryName: string;
  brandName: string | null;
  color: string;
  material: string | null;
  gender: string;
  style: string | null;
  occasion: string | null;
  season: string | null;
  description: string;
  price: number;
  stock: number;
  tags: string[];
}): string {
  const lines = [
    `📋 <b>Review Product Details / Mahsulotni tekshirish</b>`,
    ``,
    `🏷 <b>Title:</b> ${params.title}`,
    `📁 <b>Category:</b> ${params.categoryName}`,
    params.brandName ? `🏢 <b>Brand:</b> ${params.brandName}` : null,
    `🎨 <b>Color:</b> ${params.color}`,
    params.material ? `🧵 <b>Material:</b> ${params.material}` : null,
    `👤 <b>Target:</b> ${params.gender}`,
    params.style ? `👗 <b>Style:</b> ${params.style}` : null,
    params.occasion ? `🎯 <b>Occasion:</b> ${params.occasion}` : null,
    params.season ? `☀️ <b>Season:</b> ${params.season}` : null,
    ``,
    `📝 <b>Description:</b>\n<i>${params.description}</i>`,
    ``,
    `💰 <b>Price:</b> <b>${params.price.toLocaleString()} UZS</b>`,
    `📦 <b>Initial Stock:</b> <b>${params.stock} pcs</b>`,
    `🏷 <b>Tags:</b> ${params.tags.map((t) => '#' + t).join(' ')}`,
    `📸 <b>Studio Photo:</b> 1000x1000 WebP (Saved securely)`,
    ``,
    `<i>Tap <b>🚀 Publish Product</b> to make it live on TrendMall, or <b>❌ Cancel</b> to discard.</i>`,
  ];

  return lines.filter(Boolean).join('\n');
}

/**
 * Formats the AI extraction details card and step 1 price prompt.
 */
export function formatAiExtractionDetails(
  aiResult: VisionAnalysisResult,
  mappedCategoryName: string,
  mappedBrandName: string | null
): string {
  const lines = [
    `✨ <b>AI Fashion Recognition Complete!</b>`,
    ``,
    `🏷 <b>Title:</b> ${aiResult.title}`,
    `📁 <b>Category:</b> ${mappedCategoryName}`,
    mappedBrandName ? `🏢 <b>Brand:</b> ${mappedBrandName}` : null,
    `🎨 <b>Color:</b> ${aiResult.color}`,
    aiResult.material ? `🧵 <b>Material:</b> ${aiResult.material}` : null,
    `👤 <b>Target:</b> ${aiResult.gender}`,
    aiResult.style ? `👗 <b>Style:</b> ${aiResult.style}` : null,
    aiResult.occasion ? `🎯 <b>Occasion:</b> ${aiResult.occasion}` : null,
    aiResult.season ? `☀️ <b>Season:</b> ${aiResult.season}` : null,
    ``,
    `📝 <b>Description:</b>\n<i>${aiResult.description}</i>`,
    ``,
    `🏷 <b>Tags:</b> ${aiResult.tags.map((t) => '#' + t).join(' ')}`,
    `📸 <b>Photo:</b> 1000x1000 Studio WebP ready.`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `💰 <b>Step 1/2 — Set Product Price</b>`,
  ];

  if (aiResult.suggestedPrice && aiResult.suggestedPrice > 0) {
    lines.push(
      `💡 <i>AI Suggested: ${aiResult.suggestedPrice.toLocaleString()} UZS</i>`,
      ``,
      `Enter price in UZS (e.g. <code>450000</code> or <code>450 000</code>), or tap the button below:`
    );
  } else {
    lines.push(
      ``,
      `Please enter product price in UZS (e.g. <code>450000</code> or <code>450 000</code>):`
    );
  }

  return lines.filter(Boolean).join('\n');
}
