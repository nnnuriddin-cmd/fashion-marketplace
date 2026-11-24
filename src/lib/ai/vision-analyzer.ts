import 'server-only';
import sharp from 'sharp';
import { isOpenAiVisionConfigured, runOpenAiVision } from './providers/openai-vision';
import { isGeminiVisionConfigured, runGeminiVision } from './providers/gemini-vision';

export type SupportedBotLanguage = 'uz' | 'ru' | 'en';

export interface VisionAnalysisResult {
  title: string;
  description: string;
  category: string;
  brand: string | null;
  color: string;
  material: string | null;
  gender: 'WOMEN' | 'MEN' | 'UNISEX' | 'KIDS';
  style: string | null;
  occasion: string | null;
  season: string | null;
  tags: string[];
  suggestedPrice?: number | null;
}

/**
 * Constructs a language-aware system prompt (shared by all vision providers).
 * Human-facing fields are generated in the requested language (uz, ru, en).
 * Machine-facing fields (category, gender) strictly remain in canonical English.
 */
export function getSystemPrompt(language: SupportedBotLanguage = 'uz'): string {
  let langInstructions = '';

  if (language === 'uz') {
    langInstructions = `LANGUAGE REQUIREMENT:
All human-facing fields ("title", "description", "color", "material", "style", "occasion", "season", "tags") MUST be written in natural, professional Uzbek using Latin script (O'zbek tili).
DO NOT use Cyrillic script.
Examples:
- "title": Uzbek Latin, concise, 3-80 chars (e.g. "Keng bichimli bej rangli zig‘ir kostyum", "Ipak midi ko‘ylak").
- "description": 2-3 sentences in Uzbek Latin detailing silhouette, fabric feel, cut, and key visual accents. Max 350 chars.
- "color": Uzbek Latin (e.g. "Bej", "Qora", "To‘q ko‘k", "Zaytun yashil", "Oq / Moviy"). Max 30 chars.
- "material": Uzbek Latin (e.g. "Zig‘ir", "Ipak", "Paxta", "Charm", "Denim", "Jun aralashmasi") if discernible, otherwise null.
- "style": Uzbek Latin (e.g. "Minimalizm", "Erkin bichim", "Kundalik", "Klassik", "Ko‘cha modasi", "Nafis", "Vintaj") if uncertain, null.
- "occasion": Uzbek Latin (e.g. "Kundalik", "Ish / Ofis", "Oqshom", "Rasmiy", "Sport") if uncertain, null.
- "season": Uzbek Latin (e.g. "Yoz", "Qish", "Bahor", "Kuz", "Barcha fasllar") if uncertain, null.
- "tags": 4 to 8 concise lowercase keywords in Uzbek Latin (e.g. ["zigir", "kostyum", "bej", "yozgi", "nafis"]).`;
  } else if (language === 'ru') {
    langInstructions = `LANGUAGE REQUIREMENT:
All human-facing fields ("title", "description", "color", "material", "style", "occasion", "season", "tags") MUST be written in natural, professional Russian.
Examples:
- "title": Russian, concise, 3-80 chars (e.g. "Свободный льняной жакет бежевого цвета", "Шелковое платье миди").
- "description": 2-3 sentences in Russian detailing silhouette, fabric feel, cut, and key visual accents. Max 350 chars.
- "color": Russian (e.g. "Бежевый", "Матовый черный", "Оливковый", "Белый / Синий"). Max 30 chars.
- "material": Russian (e.g. "Лен", "Шелк", "Хлопок", "Кожа", "Деним", "Шерстяная смесь") if discernible, otherwise null.
- "style": Russian (e.g. "Минимализм", "Оверсайз", "Повседневный", "Классический", "Стритвир", "Элегантный", "Винтаж") if uncertain, null.
- "occasion": Russian (e.g. "Повседневный", "Деловой", "Вечерний", "Торжественный", "Спорт") if uncertain, null.
- "season": Russian (e.g. "Лето", "Зима", "Весна", "Осень", "Всесезонный") if uncertain, null.
- "tags": 4 to 8 concise lowercase keywords in Russian (e.g. ["лен", "жакет", "бежевый", "лето", "шик"]).`;
  } else {
    langInstructions = `LANGUAGE REQUIREMENT:
All human-facing fields ("title", "description", "color", "material", "style", "occasion", "season", "tags") MUST be written in natural, professional English.
Examples:
- "title": English, concise, 3-80 chars (e.g. "Oversized Beige Linen Blazer", "Silk Cowl-Neck Midi Dress").
- "description": 2-3 sentences in English detailing silhouette, fabric feel, cut, and key visual accents. Max 350 chars.
- "color": English (e.g. "Beige", "Matte Black", "Olive Green", "White / Navy"). Max 30 chars.
- "material": English (e.g. "Linen", "Silk", "Cotton", "Leather", "Denim", "Wool Blend") if discernible, otherwise null.
- "style": English (e.g. "Minimalist", "Oversized", "Casual", "Tailored", "Streetwear", "Elegant", "Vintage") if uncertain, null.
- "occasion": English (e.g. "Casual", "Business", "Evening", "Formal", "Sport") if uncertain, null.
- "season": English (e.g. "Summer", "Winter", "Spring", "Autumn", "All Season") if uncertain, null.
- "tags": 4 to 8 concise lowercase keywords in English (e.g. ["linen", "blazer", "beige", "summer", "chic"]).`;
  }

  return `You are a professional fashion catalog specialist for TrendMall, a luxury fashion marketplace.
Analyze the apparel or fashion accessory in this image and return a strictly structured JSON object.

${langInstructions}

CRITICAL MACHINE-FACING FIELDS (DO NOT TRANSLATE):
- "category": Primary fashion category suggestion MUST ALWAYS BE IN ENGLISH to match the system taxonomy. Suggest one of: "Blazers & Jackets", "Dresses", "Tops & Blouses", "T-Shirts", "Shirts", "Sweaters & Knitwear", "Hoodies & Sweatshirts", "Coats & Outerwear", "Pants & Trousers", "Jeans", "Skirts", "Shorts", "Suits", "Sneakers", "Shoes & Boots", "Heels", "Bags & Handbags", "Accessories". NEVER translate the category name.
- "gender": Exactly one of: "WOMEN", "MEN", "UNISEX", "KIDS". NEVER translate this value.
- "brand": The brand name ONLY if a logo or brand label is clearly visible and readable in the photo. If not visible, return null. Never guess.
- "suggestedPrice": Always return null (prices are set by the seller).

Return strictly raw JSON with no markdown formatting or commentary.`;
}

/**
 * Sanitizes a string by stripping HTML tags, control characters, and normalizing whitespace.
 */
function sanitizeString(val: unknown, maxLen: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  const stripped = val
    .replace(/<script[\s\S]*?<\/script>/gi, '') // strip script blocks and content
    .replace(/<style[\s\S]*?<\/style>/gi, '') // strip style blocks and content
    .replace(/<[^>]*>/g, '') // strip any other HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // strip control chars
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
  return stripped.slice(0, maxLen);
}

/**
 * Sanitizes an optional/nullable string, converting empty/placeholder values to null.
 */
function sanitizeNullableString(val: unknown, maxLen: number): string | null {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'string') return null;
  const cleaned = sanitizeString(val, maxLen);
  if (
    !cleaned ||
    ['unknown', 'null', 'none', 'n/a', 'undefined'].includes(cleaned.toLowerCase())
  ) {
    return null;
  }
  return cleaned;
}

/**
 * Strictly validates and normalizes the raw AI output against the schema.
 * Rejects unexpected types, excessively long strings, prompt injections, and malformed structures.
 */
export function validateVisionAnalysisResult(raw: unknown): VisionAnalysisResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('AI output must be a non-null JSON object');
  }

  const obj = raw as Record<string, unknown>;

  // 1. Title validation (3 to 120 characters)
  const title = sanitizeString(obj.title, 120);
  if (title.length < 3) {
    throw new Error('AI output title is too short or empty (minimum 3 characters)');
  }

  // 2. Description validation (10 to 500 characters)
  const description = sanitizeString(obj.description, 500);
  if (description.length < 10) {
    throw new Error('AI output description is too short or empty (minimum 10 characters)');
  }

  // 3. Category suggestion validation (2 to 60 characters)
  const category = sanitizeString(obj.category || obj.categoryName, 60);
  if (!category || category.length < 2) {
    throw new Error('AI output category is invalid or missing');
  }

  // 4. Color validation (2 to 40 characters)
  const color = sanitizeString(obj.color, 40);
  if (!color || color.length < 2) {
    throw new Error('AI output color is invalid or missing');
  }

  // 5. Gender validation
  let gender: 'WOMEN' | 'MEN' | 'UNISEX' | 'KIDS' = 'UNISEX';
  const rawGender = String(obj.gender || '').toUpperCase().trim();
  if (['WOMEN', 'MEN', 'UNISEX', 'KIDS'].includes(rawGender)) {
    gender = rawGender as 'WOMEN' | 'MEN' | 'UNISEX' | 'KIDS';
  }

  // 6. Nullable attributes
  const brand = sanitizeNullableString(obj.brand, 60);
  const material = sanitizeNullableString(obj.material, 60);
  const style = sanitizeNullableString(obj.style, 50);
  const occasion = sanitizeNullableString(obj.occasion, 50);
  const season = sanitizeNullableString(obj.season, 50);

  // 7. Tags validation (Unicode-safe: preserves all letters, digits, underscores, and hyphens)
  let tags: string[] = [];
  if (Array.isArray(obj.tags)) {
    tags = obj.tags
      .map((t) => sanitizeString(t, 30).toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, ''))
      .filter((t) => t.length >= 2 && t.length <= 30)
      .slice(0, 10);
  }
  if (tags.length === 0) {
    tags = [
      category.toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, ''),
      color.toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, ''),
    ].filter(Boolean);
  }

  return {
    title,
    description,
    category,
    brand,
    color,
    material,
    gender,
    style,
    occasion,
    season,
    tags,
    // Prices are set by the seller only; AI price suggestions are intentionally ignored
    suggestedPrice: null,
  };
}

/** Total time budget for AI analysis across all providers (Telegram webhook must answer in time). */
const ANALYSIS_TIME_BUDGET_MS = 35000;
const OPENAI_TIMEOUT_MS = 20000;
/** Longest side of the image sent to AI: smaller payload = cheaper and faster. */
const AI_IMAGE_MAX_DIMENSION = 1024;

/**
 * Downscales the photo to at most 1024px (auto-oriented JPEG) before sending it to AI.
 * Falls back to the original bytes if Sharp cannot process it.
 */
async function prepareImageForAi(buffer: Buffer, mimeType: string): Promise<{ base64: string; mimeType: string }> {
  try {
    const resized = await sharp(buffer)
      .rotate()
      .resize(AI_IMAGE_MAX_DIMENSION, AI_IMAGE_MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { base64: resized.toString('base64'), mimeType: 'image/jpeg' };
  } catch (err) {
    console.warn('[Vision] Could not downscale image, sending original:', err);
    return { base64: buffer.toString('base64'), mimeType };
  }
}

/**
 * Analyzes a garment image and returns sanitized product attributes.
 *
 * Providers (in order, each only if its key is configured):
 *   1. OpenAI (OPENAI_API_KEY, model OPENAI_VISION_MODEL) – primary
 *   2. Gemini (GEMINI_API_KEY) – fallback
 *
 * Security:
 * - Server-side API keys only; never passes Telegram Bot tokens or external URLs.
 * - Shared time budget across providers.
 * - Every provider's output goes through strict validateVisionAnalysisResult().
 */
export async function analyzeClothingImage(
  imageBufferOrBase64: Buffer | string,
  mimeType = 'image/jpeg',
  language: SupportedBotLanguage = 'uz'
): Promise<VisionAnalysisResult> {
  let buffer: Buffer;
  if (Buffer.isBuffer(imageBufferOrBase64)) {
    buffer = imageBufferOrBase64;
  } else if (typeof imageBufferOrBase64 === 'string') {
    if (imageBufferOrBase64.startsWith('http://') || imageBufferOrBase64.startsWith('https://')) {
      throw new Error('Passing URLs to analyzeClothingImage is forbidden for security. Pass image Buffer.');
    }
    buffer = Buffer.from(imageBufferOrBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
  } else {
    throw new Error('Image data must be provided as a Buffer or base64 string');
  }

  if (buffer.length < 100) {
    throw new Error('Invalid or empty image buffer provided to vision analysis');
  }

  const providers: Array<{ name: string; run: typeof runOpenAiVision; timeoutMs: number }> = [];
  if (isOpenAiVisionConfigured()) providers.push({ name: 'OpenAI', run: runOpenAiVision, timeoutMs: OPENAI_TIMEOUT_MS });
  if (isGeminiVisionConfigured()) providers.push({ name: 'Gemini', run: runGeminiVision, timeoutMs: ANALYSIS_TIME_BUDGET_MS });

  if (providers.length === 0) {
    throw new Error('No vision AI provider configured (set OPENAI_API_KEY or GEMINI_API_KEY)');
  }

  const image = await prepareImageForAi(buffer, mimeType);
  const systemPrompt = getSystemPrompt(language);
  const deadline = Date.now() + ANALYSIS_TIME_BUDGET_MS;
  let lastError: Error | null = null;

  for (const provider of providers) {
    const timeoutMs = Math.min(provider.timeoutMs, deadline - Date.now());
    if (timeoutMs < 3000) break;

    const startedAt = Date.now();
    try {
      const raw = await provider.run({
        systemPrompt,
        imageBase64: image.base64,
        mimeType: image.mimeType,
        timeoutMs,
      });
      const result = validateVisionAnalysisResult(raw);
      console.log(`[Vision] ${provider.name} analysis succeeded in ${Date.now() - startedAt}ms`);
      return result;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Vision] ${provider.name} failed after ${Date.now() - startedAt}ms:`, lastError.message);
    }
  }

  throw lastError || new Error('Vision analysis time budget exhausted');
}
