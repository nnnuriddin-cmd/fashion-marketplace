import 'server-only';

/**
 * Gemini vision provider (fallback). Env: GEMINI_API_KEY.
 */

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-1.5-flash'];
const PER_MODEL_TIMEOUT_MS = 15000;

/** Structured JSON Schema for Gemini generateContent responseSchema (Gemini REST dialect). */
const GEMINI_VISION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Concise fashion product title, 3-120 characters' },
    description: { type: 'STRING', description: 'Factual 2-3 sentence product description' },
    category: { type: 'STRING', description: 'Primary fashion category' },
    brand: { type: 'STRING', nullable: true },
    color: { type: 'STRING', description: 'Dominant product color or colors' },
    material: { type: 'STRING', nullable: true },
    gender: { type: 'STRING', enum: ['WOMEN', 'MEN', 'UNISEX', 'KIDS'] },
    style: { type: 'STRING', nullable: true },
    occasion: { type: 'STRING', nullable: true },
    season: { type: 'STRING', nullable: true },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    suggestedPrice: { type: 'INTEGER', nullable: true },
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

export function isGeminiVisionConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Tries Gemini models in order and returns the first parsed (not yet validated) JSON object.
 * Throws if every model fails or the time budget runs out.
 */
export async function runGeminiVision(params: {
  systemPrompt: string;
  imageBase64: string;
  mimeType: string;
  timeoutMs: number;
}): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not configured');

  const deadline = Date.now() + params.timeoutMs;
  let lastError: Error | null = null;

  for (const model of GEMINI_MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) {
      lastError = lastError || new Error('Gemini Vision time budget exhausted');
      break;
    }
    const timeoutMs = Math.min(PER_MODEL_TIMEOUT_MS, remaining);
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: params.systemPrompt },
                { inline_data: { mime_type: params.mimeType, data: params.imageBase64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema: GEMINI_VISION_SCHEMA,
          },
        }),
      });
    } catch (fetchErr: any) {
      const isTimeout = fetchErr?.name === 'TimeoutError' || fetchErr?.name === 'AbortError';
      lastError = new Error(
        isTimeout
          ? `Gemini Vision analysis with model ${model} timed out after ${Math.round(timeoutMs / 1000)} seconds`
          : `Failed to connect to Gemini API (${model}): ${fetchErr?.message || fetchErr}`
      );
      console.warn(`[Gemini Vision] ${model} network error, trying next model:`, lastError.message);
      continue;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      lastError = new Error(`Gemini API error for ${model} (HTTP ${response.status}): ${errText.slice(0, 200)}`);

      // Overloaded or transient server error: fail over to next model
      if ([503, 429, 500, 502, 504].includes(response.status)) {
        console.warn(`[Gemini Vision] ${model} unavailable (HTTP ${response.status}), trying next model`);
        continue;
      }
      // Other client errors (bad request, invalid key): another model won't help
      throw lastError;
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts;
    const rawText = Array.isArray(parts)
      ? parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('')
      : '';
    const trimmed = rawText.trim();

    if (!trimmed) {
      lastError = new Error(
        `Gemini Vision (${model}) produced no text output (finishReason: ${candidate?.finishReason || 'UNKNOWN'})`
      );
      console.warn(`[Gemini Vision] ${model} produced empty text, trying next model`);
      continue;
    }

    try {
      return JSON.parse(stripCodeFence(trimmed));
    } catch {
      lastError = new Error(`Gemini Vision (${model}) returned invalid JSON format`);
      console.warn(`[Gemini Vision] ${model} returned malformed JSON, trying next model`);
    }
  }

  throw lastError || new Error('All Gemini Vision models failed to process image');
}

function stripCodeFence(text: string): string {
  if (text.startsWith('```')) {
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return match?.[1]?.trim() || text;
}
