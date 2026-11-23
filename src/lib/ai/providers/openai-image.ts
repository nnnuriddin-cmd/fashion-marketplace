import 'server-only';

/**
 * OpenAI image editing (POST /v1/images/edits).
 *
 * Env:
 *   OPENAI_API_KEY        – required
 *   OPENAI_IMAGE_MODEL    – default gpt-image-2
 *   OPENAI_IMAGE_QUALITY  – low | medium | high (default medium)
 */

const DEFAULT_MODEL = 'gpt-image-2';
const DEFAULT_QUALITY = 'medium';

export function isOpenAiImageConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

/** Returns the edited image as JPEG bytes. Throws on any failure. */
export async function editImageWithOpenAi(params: {
  image: Buffer;
  imageMimeType: 'image/png' | 'image/jpeg';
  prompt: string;
  timeoutMs: number;
}): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is not configured');

  const model = process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;
  const quality = process.env.OPENAI_IMAGE_QUALITY?.trim() || DEFAULT_QUALITY;

  const form = new FormData();
  form.append('model', model);
  form.append(
    'image',
    new Blob([new Uint8Array(params.image)], { type: params.imageMimeType }),
    params.imageMimeType === 'image/png' ? 'product.png' : 'product.jpg'
  );
  form.append('prompt', params.prompt);
  form.append('size', '1024x1024');
  form.append('quality', quality);
  form.append('output_format', 'jpeg');
  form.append('n', '1');
  // gpt-image-1.x needs explicit high fidelity to preserve product details;
  // gpt-image-2+ always uses high fidelity and rejects the parameter.
  if (model.startsWith('gpt-image-1') && !model.includes('mini')) {
    form.append('input_fidelity', 'high');
  }

  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(params.timeoutMs),
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new Error(
      isTimeout
        ? `OpenAI image edit timed out after ${Math.round(params.timeoutMs / 1000)}s`
        : `Failed to connect to OpenAI API: ${err?.message || err}`
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI image edit error for ${model} (HTTP ${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string' || !b64) {
    throw new Error(`OpenAI image edit (${model}) returned no image`);
  }
  if (data?.usage) {
    console.log(`[OpenAI Image] ${model} usage: in=${data.usage.input_tokens} out=${data.usage.output_tokens}`);
  }
  return Buffer.from(b64, 'base64');
}
