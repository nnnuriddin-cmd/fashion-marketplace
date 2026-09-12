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

export type BotLang = 'uz' | 'ru' | 'en';

export const TELEGRAM_I18N = {
  uz: {
    ai_complete: '✨ <b>AI tahlili yakunlandi!</b>',
    label_title: '🏷 <b>Nomi:</b>',
    label_category: '📁 <b>Kategoriya:</b>',
    label_brand: '🏢 <b>Brend:</b>',
    label_color: '🎨 <b>Rangi:</b>',
    label_material: '🧵 <b>Materiali:</b>',
    label_gender: '👤 <b>Jinsi:</b>',
    label_style: '👗 <b>Uslubi:</b>',
    label_occasion: '🎯 <b>Vaziyat:</b>',
    label_season: '☀️ <b>Mavsum:</b>',
    label_description: '📝 <b>Tavsif:</b>',
    label_tags: '🏷 <b>Teglar:</b>',
    label_photo_studio: '📸 <b>Rasm:</b> 1000x1000 WebP studiya formati tayyor.',
    label_photo_saved: '📸 <b>Studiya rasmi:</b> 1000x1000 WebP (Xavfsiz saqlandi)',
    step1_header: '💰 <b>1/2-qadam — Mahsulot narxini belgilang</b>',
    suggested_price_prompt: '💡 <i>AI tavsiya qilgan narx: {price} UZS</i>\n\nNarxni UZSda kiriting (masalan, <code>450000</code> yoki <code>450 000</code>) yoki quyidagi tugmani bosing:',
    enter_price_prompt: '✍️ Narxni UZSda kiriting (minimum 1 000 UZS):\nMisol: <code>150000</code>',
    review_header: "📋 <b>Mahsulot ma'lumotlarini tekshiring</b>",
    label_price: '💰 <b>Narxi:</b>',
    label_initial_stock: "📦 <b>Boshlang'ich miqdor:</b>",
    publish_instructions: "<i>Mahsulotni TrendMall’da sotuvga chiqarish uchun <b>🚀 E'lon qilish</b> tugmasini bosing yoki bekor qilish uchun <b>❌ Bekor qilish</b> tugmasini bosing.</i>",
    btn_use_price: '✅ {price} UZS ishlatish',
    btn_cancel: '❌ Bekor qilish',
    btn_publish: "🚀 E'lon qilish",
    btn_stock_1: '1 dona',
    btn_stock_5: '5 dona',
    btn_stock_10: '10 dona',
    step2_header: '📦 <b>2/2-qadam — Ombordagi miqdorni belgilang</b>',
    price_confirmed: '✅ <b>Narx tasdiqlandi:</b> <b>{price} UZS</b>',
    enter_stock_prompt: 'Mahsulot miqdorini kiriting (butun son, kamida 1; masalan, <code>10</code>) yoki quyidagi tezkor variantlardan birini tanlang:',
    choose_category_prompt: '❓ <b>Iltimos, ushbu mahsulot uchun eng mos kategoriyani tanlang:</b>',
    // Validation & alerts
    err_price_number: "Narx to'g'ri son bo'lishi kerak.",
    err_price_format: "Iltimos, narxni UZSda to'g'ri sonda kiriting (masalan, <code>450000</code> yoki <code>450 000</code>).",
    err_price_min: 'Minimal narx — 1 000 UZS.',
    err_price_max: 'Narx 500 000 000 UZS dan oshmasligi kerak.',
    err_stock_integer: "Mahsulot miqdori butun son bo'lishi kerak.",
    err_stock_min: "Mahsulot miqdori kamida 1 dona bo'lishi kerak.",
    err_stock_max: 'Mahsulot miqdori 10 000 donadan oshmasligi kerak.',
    alert_draft_cancelled: 'Qoralama bekor qilindi',
    alert_invalid_price: "Noto'g'ri narx (kamida 1 000 UZS)",
    alert_no_draft: 'Faol qoralama topilmadi',
    alert_price_set: 'Narx belgilandi: {price} UZS',
    alert_invalid_stock: "Noto'g'ri miqdor",
    alert_enter_price_first: 'Avval mahsulot narxini kiriting',
    alert_stock_set: 'Miqdor belgilandi: {stock} dona',
    alert_category_not_found: 'Kategoriya topilmadi',
    alert_session_expired: 'Sessiya muddati tugagan',
    alert_already_published: "Mahsulot allaqachon e'lon qilingan!",
    alert_publishing: "Mahsulot e'lon qilinmoqda...",
    alert_published_live: "🎉 Mahsulot e'lon qilindi!",
    msg_already_published: "✅ <b>{title}</b> allaqachon TrendMall'da faol!",
    msg_incomplete_draft: "⚠️ <b>To'liq bo'lmagan qoralama</b>\n\nAyrim zarur ma'lumotlar yetishmayapti. Iltimos, e'lon qilishdan oldin narx va miqdorni kiriting.",
    msg_publish_db_error: "⚠️ <b>E'lon qilishda xatolik yuz berdi</b>\n\nMahsulotni yaratishda xatolik yuz berdi. Qaytadan urinib ko'rish uchun <b>🚀 E'lon qilish</b> tugmasini bosing yoki /cancel yuboring.",
    msg_photo_get_error: "⚠️ <b>Rasmni Telegram'dan yuklab bo'lmadi</b>. Iltimos, rasmni qaytadan yuboring.",
    msg_photo_download_error: "⚠️ <b>Rasmni yuklab olishda xatolik</b>. Iltimos, rasmni qaytadan yuboring.",
    msg_image_processing_failed: "❌ <b>Rasmni qayta ishlashda xatolik</b>\n\nIltimos, 15MB dan oshmagan tiniq rasm (JPEG, PNG yoki WebP) yuboring.",
  },
  ru: {
    ai_complete: '✨ <b>Анализ товара завершён!</b>',
    label_title: '🏷 <b>Название:</b>',
    label_category: '📁 <b>Категория:</b>',
    label_brand: '🏢 <b>Бренд:</b>',
    label_color: '🎨 <b>Цвет:</b>',
    label_material: '🧵 <b>Материал:</b>',
    label_gender: '👤 <b>Пол:</b>',
    label_style: '👗 <b>Стиль:</b>',
    label_occasion: '🎯 <b>Случай:</b>',
    label_season: '☀️ <b>Сезон:</b>',
    label_description: '📝 <b>Описание:</b>',
    label_tags: '🏷 <b>Теги:</b>',
    label_photo_studio: '📸 <b>Фото:</b> Студийный формат 1000x1000 WebP готов.',
    label_photo_saved: '📸 <b>Студийное фото:</b> 1000x1000 WebP (Сохранено безопасно)',
    step1_header: '💰 <b>Шаг 1/2 — Укажите цену</b>',
    suggested_price_prompt: '💡 <i>Рекомендованная AI цена: {price} UZS</i>\n\nВведите цену в UZS (например, <code>450000</code> или <code>450 000</code>) или нажмите кнопку ниже:',
    enter_price_prompt: '✍️ Введите цену в UZS (минимум 1 000 UZS):\nПример: <code>150000</code>',
    review_header: '📋 <b>Проверьте данные товара</b>',
    label_price: '💰 <b>Цена:</b>',
    label_initial_stock: '📦 <b>Количество на складе:</b>',
    publish_instructions: '<i>Нажмите <b>🚀 Опубликовать</b>, чтобы разместить товар на TrendMall, или <b>❌ Отмена</b>, чтобы отменить.</i>',
    btn_use_price: '✅ Использовать {price} UZS',
    btn_cancel: '❌ Отмена',
    btn_publish: '🚀 Опубликовать',
    btn_stock_1: '1 шт.',
    btn_stock_5: '5 шт.',
    btn_stock_10: '10 шт.',
    step2_header: '📦 <b>Шаг 2/2 — Укажите количество на складе</b>',
    price_confirmed: '✅ <b>Цена подтверждена:</b> <b>{price} UZS</b>',
    enter_stock_prompt: 'Введите количество товара (целое число, минимум 1; например, <code>10</code>) или выберите быстрый вариант ниже:',
    choose_category_prompt: '❓ <b>Пожалуйста, выберите наиболее подходящую категорию для товара:</b>',
    // Validation & alerts
    err_price_number: 'Цена должна быть корректным числом.',
    err_price_format: 'Пожалуйста, укажите корректную цену в UZS (например, <code>450000</code> или <code>450 000</code>).',
    err_price_min: 'Минимальная цена — 1 000 UZS.',
    err_price_max: 'Цена не может превышать 500 000 000 UZS.',
    err_stock_integer: 'Количество товара должно быть целым числом.',
    err_stock_min: 'Количество должно быть не менее 1 шт.',
    err_stock_max: 'Количество не может превышать 10 000 шт.',
    alert_draft_cancelled: 'Черновик отменён',
    alert_invalid_price: 'Некорректная цена (мин. 1 000 UZS)',
    alert_no_draft: 'Нет активного черновика',
    alert_price_set: 'Цена установлена: {price} UZS',
    alert_invalid_stock: 'Некорректное количество',
    alert_enter_price_first: 'Сначала укажите цену товара',
    alert_stock_set: 'Количество установлено: {stock} шт.',
    alert_category_not_found: 'Категория не найдена',
    alert_session_expired: 'Сессия истекла',
    alert_already_published: 'Уже опубликовано!',
    alert_publishing: 'Публикация товара...',
    alert_published_live: '🎉 Товар опубликован!',
    msg_already_published: '✅ <b>{title}</b> уже активен на TrendMall!',
    msg_incomplete_draft: '⚠️ <b>Неполный черновик</b>\n\nНекоторые обязательные данные отсутствуют. Пожалуйста, укажите цену и количество перед публикацией.',
    msg_publish_db_error: '⚠️ <b>Ошибка публикации</b>\n\nПроизошла ошибка базы данных при создании товара. Нажмите <b>🚀 Опубликовать</b>, чтобы повторить, или /cancel.',
    msg_photo_get_error: '⚠️ <b>Не удалось получить фото из Telegram</b>. Пожалуйста, отправьте фото еще раз.',
    msg_photo_download_error: '⚠️ <b>Не удалось загрузить фото</b>. Пожалуйста, попробуйте еще раз.',
    msg_image_processing_failed: '❌ <b>Ошибка обработки изображения</b>\n\nПожалуйста, отправьте четкое фото (JPEG, PNG или WebP) до 15МБ.',
  },
  en: {
    ai_complete: '✨ <b>AI Fashion Recognition Complete!</b>',
    label_title: '🏷 <b>Title:</b>',
    label_category: '📁 <b>Category:</b>',
    label_brand: '🏢 <b>Brand:</b>',
    label_color: '🎨 <b>Color:</b>',
    label_material: '🧵 <b>Material:</b>',
    label_gender: '👤 <b>Target:</b>',
    label_style: '👗 <b>Style:</b>',
    label_occasion: '🎯 <b>Occasion:</b>',
    label_season: '☀️ <b>Season:</b>',
    label_description: '📝 <b>Description:</b>',
    label_tags: '🏷 <b>Tags:</b>',
    label_photo_studio: '📸 <b>Photo:</b> 1000x1000 Studio WebP ready.',
    label_photo_saved: '📸 <b>Studio Photo:</b> 1000x1000 WebP (Saved securely)',
    step1_header: '💰 <b>Step 1/2 — Set Product Price</b>',
    suggested_price_prompt: '💡 <i>AI Suggested: {price} UZS</i>\n\nEnter price in UZS (e.g. <code>450000</code> or <code>450 000</code>), or tap the button below:',
    enter_price_prompt: '✍️ Please enter the price in UZS (minimum 1,000 UZS):\nExample: <code>150000</code>',
    review_header: '📋 <b>Review Product Details</b>',
    label_price: '💰 <b>Price:</b>',
    label_initial_stock: '📦 <b>Initial Stock:</b>',
    publish_instructions: '<i>Tap <b>🚀 Publish Product</b> to make it live on TrendMall, or <b>❌ Cancel</b> to discard.</i>',
    btn_use_price: '✅ Use {price} UZS',
    btn_cancel: '❌ Cancel',
    btn_publish: '🚀 Publish Product',
    btn_stock_1: '1 pc',
    btn_stock_5: '5 pcs',
    btn_stock_10: '10 pcs',
    step2_header: '📦 <b>Step 2/2 — Set Available Stock</b>',
    price_confirmed: '✅ <b>Price Confirmed:</b> <b>{price} UZS</b>',
    enter_stock_prompt: 'Please enter the inventory quantity (whole number ≥ 1, e.g. <code>10</code>) or select a quick option below:',
    choose_category_prompt: '❓ <b>Please choose the closest category for this item:</b>',
    // Validation & alerts
    err_price_number: 'Price must be a valid number.',
    err_price_format: 'Please enter a valid numeric price in UZS (e.g. <code>450000</code> or <code>450 000</code>).',
    err_price_min: 'Minimum price is 1,000 UZS.',
    err_price_max: 'Price cannot exceed 500,000,000 UZS (500 million).',
    err_stock_integer: 'Stock quantity must be a whole number.',
    err_stock_min: 'Stock must be at least 1 unit.',
    err_stock_max: 'Stock cannot exceed 10,000 units.',
    alert_draft_cancelled: 'Draft cancelled',
    alert_invalid_price: 'Invalid price (min 1,000 UZS)',
    alert_no_draft: 'No active draft session',
    alert_price_set: 'Price set: {price} UZS',
    alert_invalid_stock: 'Invalid stock quantity',
    alert_enter_price_first: 'Please enter product price first',
    alert_stock_set: 'Stock set: {stock} pcs',
    alert_category_not_found: 'Category not found',
    alert_session_expired: 'Session expired',
    alert_already_published: 'Already published!',
    alert_publishing: 'Publishing product live...',
    alert_published_live: '🎉 Product published live!',
    msg_already_published: '✅ <b>{title}</b> is already live on TrendMall!',
    msg_incomplete_draft: '⚠️ <b>Incomplete Draft</b>\n\nSome required product details are missing. Please enter price and stock before publishing.',
    msg_publish_db_error: '⚠️ <b>Publication Failed</b>\n\nA database error occurred while creating your product. Please tap <b>🚀 Publish Product</b> to retry, or /cancel.',
    msg_photo_get_error: '⚠️ <b>Could not retrieve photo from Telegram</b>. Please try sending the photo again.',
    msg_photo_download_error: '⚠️ <b>Failed to download photo</b>. Please try sending it again.',
    msg_image_processing_failed: '❌ <b>Image processing failed</b>\n\nPlease send a clear photo (JPEG, PNG, or WebP) under 15MB.',
  },
};

/**
 * Returns localized string for Telegram seller UI.
 */
export function getTelegramText(
  lang: BotLang | string | null | undefined,
  key: keyof typeof TELEGRAM_I18N['uz'],
  replacements?: Record<string, string | number>
): string {
  const safeLang: BotLang = (lang === 'ru' || lang === 'en') ? lang : 'uz';
  let template = TELEGRAM_I18N[safeLang]?.[key] || TELEGRAM_I18N.uz[key] || '';
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return template;
}

/**
 * Validates product price input in Uzbek Som (UZS).
 * Enforces positive integer, minimum 1,000 UZS, maximum 500,000,000 UZS.
 * Normalizes spaces, commas, and currency labels.
 */
export function validatePriceInput(input: unknown, lang: BotLang = 'uz'): PriceValidationResult {
  if (typeof input !== 'string' && typeof input !== 'number') {
    return { valid: false, error: getTelegramText(lang, 'err_price_number') };
  }

  const cleanStr = String(input)
    .toLowerCase()
    .replace(/(uzs|сум|so'm|som)/gi, '')
    .replace(/[\s,_]/g, '')
    .trim();

  if (!cleanStr || !/^\d+$/.test(cleanStr)) {
    return {
      valid: false,
      error: getTelegramText(lang, 'err_price_format'),
    };
  }

  const num = Number(cleanStr);
  if (!Number.isFinite(num) || isNaN(num)) {
    return { valid: false, error: getTelegramText(lang, 'err_price_number') };
  }

  if (num <= 0) {
    return { valid: false, error: getTelegramText(lang, 'err_price_min') };
  }

  if (num < 1000) {
    return { valid: false, error: getTelegramText(lang, 'err_price_min') };
  }

  if (num > 500000000) {
    return { valid: false, error: getTelegramText(lang, 'err_price_max') };
  }

  return { valid: true, price: Math.round(num) };
}

/**
 * Validates product stock quantity input.
 * Enforces integer >= 1, rejects decimals, enforces maximum 10,000 units.
 */
export function validateStockInput(input: unknown, lang: BotLang = 'uz'): StockValidationResult {
  if (typeof input !== 'string' && typeof input !== 'number') {
    return { valid: false, error: getTelegramText(lang, 'err_stock_integer') };
  }

  const rawStr = String(input).trim();
  if (rawStr.includes('.') || rawStr.includes(',')) {
    return { valid: false, error: getTelegramText(lang, 'err_stock_integer') };
  }

  const cleanStr = rawStr.replace(/[\s_]/g, '');
  if (!/^\d+$/.test(cleanStr)) {
    return {
      valid: false,
      error: getTelegramText(lang, 'err_stock_integer'),
    };
  }

  const num = Number(cleanStr);
  if (!Number.isInteger(num)) {
    return { valid: false, error: getTelegramText(lang, 'err_stock_integer') };
  }

  if (num < 1) {
    return { valid: false, error: getTelegramText(lang, 'err_stock_min') };
  }

  if (num > 10000) {
    return { valid: false, error: getTelegramText(lang, 'err_stock_max') };
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
export function formatProductPreview(
  params: {
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
  },
  lang: BotLang = 'uz'
): string {
  const stockUnit = lang === 'ru' ? 'шт.' : lang === 'en' ? 'pcs' : 'dona';
  const lines = [
    getTelegramText(lang, 'review_header'),
    '',
    `${getTelegramText(lang, 'label_title')} ${params.title}`,
    `${getTelegramText(lang, 'label_category')} ${params.categoryName}`,
    params.brandName ? `${getTelegramText(lang, 'label_brand')} ${params.brandName}` : null,
    `${getTelegramText(lang, 'label_color')} ${params.color}`,
    params.material ? `${getTelegramText(lang, 'label_material')} ${params.material}` : null,
    `${getTelegramText(lang, 'label_gender')} ${params.gender}`,
    params.style ? `${getTelegramText(lang, 'label_style')} ${params.style}` : null,
    params.occasion ? `${getTelegramText(lang, 'label_occasion')} ${params.occasion}` : null,
    params.season ? `${getTelegramText(lang, 'label_season')} ${params.season}` : null,
    '',
    `${getTelegramText(lang, 'label_description')}\n<i>${params.description}</i>`,
    '',
    `${getTelegramText(lang, 'label_price')} <b>${params.price.toLocaleString()} UZS</b>`,
    `${getTelegramText(lang, 'label_initial_stock')} <b>${params.stock} ${stockUnit}</b>`,
    `${getTelegramText(lang, 'label_tags')} ${params.tags.map((t) => '#' + t).join(' ')}`,
    getTelegramText(lang, 'label_photo_saved'),
    '',
    getTelegramText(lang, 'publish_instructions'),
  ];

  return lines.filter(Boolean).join('\n');
}

/**
 * Formats the AI extraction details card and step 1 price prompt.
 */
export function formatAiExtractionDetails(
  aiResult: VisionAnalysisResult,
  mappedCategoryName: string,
  mappedBrandName: string | null,
  lang: BotLang = 'uz'
): string {
  const lines = [
    getTelegramText(lang, 'ai_complete'),
    '',
    `${getTelegramText(lang, 'label_title')} ${aiResult.title}`,
    `${getTelegramText(lang, 'label_category')} ${mappedCategoryName}`,
    mappedBrandName ? `${getTelegramText(lang, 'label_brand')} ${mappedBrandName}` : null,
    `${getTelegramText(lang, 'label_color')} ${aiResult.color}`,
    aiResult.material ? `${getTelegramText(lang, 'label_material')} ${aiResult.material}` : null,
    `${getTelegramText(lang, 'label_gender')} ${aiResult.gender}`,
    aiResult.style ? `${getTelegramText(lang, 'label_style')} ${aiResult.style}` : null,
    aiResult.occasion ? `${getTelegramText(lang, 'label_occasion')} ${aiResult.occasion}` : null,
    aiResult.season ? `${getTelegramText(lang, 'label_season')} ${aiResult.season}` : null,
    '',
    `${getTelegramText(lang, 'label_description')}\n<i>${aiResult.description}</i>`,
    '',
    `${getTelegramText(lang, 'label_tags')} ${aiResult.tags.map((t) => '#' + t).join(' ')}`,
    getTelegramText(lang, 'label_photo_studio'),
    '',
    '━━━━━━━━━━━━━━━━━━',
    getTelegramText(lang, 'step1_header'),
  ];

  if (aiResult.suggestedPrice && aiResult.suggestedPrice > 0) {
    lines.push(
      '',
      getTelegramText(lang, 'suggested_price_prompt', {
        price: aiResult.suggestedPrice.toLocaleString(),
      })
    );
  } else {
    lines.push('', getTelegramText(lang, 'enter_price_prompt'));
  }

  return lines.filter(Boolean).join('\n');
}
