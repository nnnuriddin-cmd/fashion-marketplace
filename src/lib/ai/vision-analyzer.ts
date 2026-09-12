import 'server-only';

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
 * Constructs a language-aware Gemini system prompt.
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

Return strictly raw JSON with no markdown formatting or commentary.`;
}

/**
 * Structured JSON Schema for Gemini generateContent responseSchema.
 * Strictly mirrors VisionAnalysisResult attributes and adheres to Gemini REST schema specification.
 */
const VISION_ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: {
      type: 'STRING',
      description: 'Concise fashion product title, 3-120 characters',
    },
    description: {
      type: 'STRING',
      description: 'Factual 2-3 sentence product description',
    },
    category: {
      type: 'STRING',
      description: 'Primary fashion category',
    },
    brand: {
      type: 'STRING',
      nullable: true,
    },
    color: {
      type: 'STRING',
      description: 'Dominant product color or colors',
    },
    material: {
      type: 'STRING',
      nullable: true,
    },
    gender: {
      type: 'STRING',
      enum: ['WOMEN', 'MEN', 'UNISEX', 'KIDS'],
    },
    style: {
      type: 'STRING',
      nullable: true,
    },
    occasion: {
      type: 'STRING',
      nullable: true,
    },
    season: {
      type: 'STRING',
      nullable: true,
    },
    tags: {
      type: 'ARRAY',
      items: {
        type: 'STRING',
      },
    },
    suggestedPrice: {
      type: 'INTEGER',
      nullable: true,
    },
  },
  required: [
    'title',
    'description',
    'category',
    'brand',
    'color',
    'material',
    'gender',
    'style',
    'occasion',
    'season',
    'tags',
    'suggestedPrice',
  ],
};

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
 * Strictly validates and normalizes the raw Gemini output against the schema.
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
    suggestedPrice:
      typeof obj.suggestedPrice === 'number' &&
      Number.isFinite(obj.suggestedPrice) &&
      obj.suggestedPrice > 0
        ? Math.round(obj.suggestedPrice)
        : null,
  };
}

/**
 * Analyzes a garment image buffer using Gemini Vision (gemini-3.6-flash).
 * Receives actual image bytes, validates output structure, and returns a sanitized result.
 *
 * Security:
 * - Uses server-side GEMINI_API_KEY only.
 * - Never passes Telegram Bot tokens or external URLs.
 * - Enforces a 15-second request timeout.
 * - Validates output with strict schema rules.
 */
export async function analyzeClothingImage(
  imageBufferOrBase64: Buffer | string,
  mimeType = 'image/jpeg',
  language: SupportedBotLanguage = 'uz'
): Promise<VisionAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured');
  }

  let buffer: Buffer;
  if (Buffer.isBuffer(imageBufferOrBase64)) {
    buffer = imageBufferOrBase64;
  } else if (typeof imageBufferOrBase64 === 'string') {
    if (imageBufferOrBase64.startsWith('http://') || imageBufferOrBase64.startsWith('https://')) {
      throw new Error('Passing URLs to analyzeClothingImage is forbidden for security. Pass image Buffer.');
    }
    const base64Data = imageBufferOrBase64.replace(/^data:image\/\w+;base64,/, '');
    buffer = Buffer.from(base64Data, 'base64');
  } else {
    throw new Error('Image data must be provided as a Buffer or base64 string');
  }

  if (buffer.length < 100) {
    throw new Error('Invalid or empty image buffer provided to Gemini Vision');
  }

  const base64Payload = buffer.toString('base64');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
  const systemPrompt = getSystemPrompt(language);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000), // 15-second timeout
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Payload,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: VISION_ANALYSIS_SCHEMA,
        },
      }),
    });
  } catch (fetchErr: any) {
    if (fetchErr?.name === 'TimeoutError' || fetchErr?.name === 'AbortError') {
      throw new Error('Gemini Vision analysis timed out after 15 seconds');
    }
    throw new Error(`Failed to connect to Gemini API: ${fetchErr?.message || fetchErr}`);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini API error (HTTP ${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];

  // Collect text across all parts if available
  const parts = candidate?.content?.parts;
  let rawText = '';
  if (Array.isArray(parts)) {
    rawText = parts
      .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
      .join('');
  } else if (typeof candidate?.content?.parts?.[0]?.text === 'string') {
    rawText = candidate.content.parts[0].text;
  }

  const trimmed = rawText.trim();

  if (!trimmed) {
    const finishReason = candidate?.finishReason || 'UNKNOWN';
    throw new Error(`Gemini Vision produced no text output (finishReason: ${finishReason})`);
  }

  let cleanJson = trimmed;

  if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  } else {
    const codeBlockMatch = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      cleanJson = codeBlockMatch[1].trim();
    }
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanJson);
  } catch {
    throw new Error('Gemini Vision returned invalid JSON format');
  }

  return validateVisionAnalysisResult(parsedJson);
}

