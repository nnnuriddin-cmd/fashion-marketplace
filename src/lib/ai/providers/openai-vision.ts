import 'server-only';

/**
 * OpenAI vision provider (Chat Completions + Structured Outputs).
 *
 * Env:
 *   OPENAI_API_KEY           – required to enable this provider
 *   OPENAI_VISION_MODEL      – model id (default: gpt-5-mini)
 *   OPENAI_REASONING_EFFORT  – reasoning effort for reasoning models (default: low; "none" to omit)
 */

const DEFAULT_MODEL = 'gpt-5-mini';
const DEFAULT_REASONING_EFFORT = 'low';

/**
 * Strict JSON schema mirroring VisionAnalysisResult.
 * Structured Outputs strict mode requires every property in `required`
 * and `additionalProperties: false`; optional values are expressed as nullable types.
 */
const OPENAI_VISION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', description: 'Concise fashion product title, 3-120 characters' },
    description: { type: 'string', description: 'Factual 2-3 sentence product description' },
    category: { type: 'string', description: 'Primary fashion category (English taxonomy name)' },
    brand: { type: ['string', 'null'] },
    color: { type: 'string', description: 'Dominant product color or colors' },
    material: { type: ['string', 'null'] },
    gender: { type: 'string', enum: ['WOMEN', 'MEN', 'UNISEX', 'KIDS'] },
    style: { type: ['string', 'null'] },
    occasion: { type: ['string', 'null'] },
    season: { type: ['string', 'null'] },
    tags: { type: 'array', items: { type: 'string' } },
    suggestedPrice: { type: ['integer', 'null'] },
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

export function isOpenAiVisionConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Sends the image to OpenAI and returns the parsed (not yet validated) JSON object.
 * Throws on any failure so the caller can fall back to another provider.
 */
export async function runOpenAiVision(params: {
  systemPrompt: string;
  imageBase64: string;
  mimeType: string;
  timeoutMs: number;
}): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not configured');

  const model = process.env.OPENAI_VISION_MODEL?.trim() || DEFAULT_MODEL;
  const effortEnv = process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  const reasoningEffort = effortEnv === 'none' ? null : effortEnv || DEFAULT_REASONING_EFFORT;

  const baseBody = {
    model,
    messages: [
      { role: 'system', content: params.systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze the fashion item in this photo and return the JSON object.' },
          {
            type: 'image_url',
            image_url: { url: `data:${params.mimeType};base64,${params.imageBase64}` },
          },
        ],
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'fashion_product', strict: true, schema: OPENAI_VISION_SCHEMA },
    },
    max_completion_tokens: 4000,
  };

  const deadline = Date.now() + params.timeoutMs;
  let response = await postChatCompletion(
    apiKey,
    reasoningEffort ? { ...baseBody, reasoning_effort: reasoningEffort } : baseBody,
    deadline - Date.now()
  );

  // Non-reasoning models reject `reasoning_effort`: retry once without it
  if (!response.ok && response.status === 400 && reasoningEffort) {
    const errText = await response.text().catch(() => '');
    if (!errText.includes('reasoning_effort')) {
      throw new Error(`OpenAI API error for ${model} (HTTP 400): ${errText.slice(0, 300)}`);
    }
    console.warn(`[OpenAI Vision] ${model} does not support reasoning_effort, retrying without it`);
    response = await postChatCompletion(apiKey, baseBody, deadline - Date.now());
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI API error for ${model} (HTTP ${response.status}): ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const choice = data?.choices?.[0];
  const message = choice?.message;

  if (message?.refusal) {
    throw new Error(`OpenAI (${model}) refused to analyze the image: ${String(message.refusal).slice(0, 200)}`);
  }
  if (choice?.finish_reason === 'length') {
    throw new Error(`OpenAI (${model}) output was truncated (max_completion_tokens reached)`);
  }

  const content = typeof message?.content === 'string' ? message.content.trim() : '';
  if (!content) {
    throw new Error(`OpenAI (${model}) returned empty content (finish_reason: ${choice?.finish_reason || 'unknown'})`);
  }

  if (data?.usage) {
    console.log(
      `[OpenAI Vision] ${model} tokens: in=${data.usage.prompt_tokens} out=${data.usage.completion_tokens}`
    );
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`OpenAI (${model}) returned invalid JSON`);
  }
}

async function postChatCompletion(apiKey: string, body: unknown, timeoutMs: number): Promise<Response> {
  if (timeoutMs <= 0) throw new Error('OpenAI Vision time budget exhausted');
  try {
    return await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new Error(
      isTimeout
        ? `OpenAI Vision timed out after ${Math.round(timeoutMs / 1000)}s`
        : `Failed to connect to OpenAI API: ${err?.message || err}`
    );
  }
}
