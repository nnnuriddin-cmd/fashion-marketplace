import 'server-only';
import sharp from 'sharp';
import { getServerSupabase } from '@/lib/supabase-server';
import { STORAGE_BUCKET } from './image-processor';
import { editImageWithOpenAi, isOpenAiImageConfigured } from './providers/openai-image';

/**
 * AI "studio" photos for products:
 *   white     – the same item on a clean white background
 *   mannequin – the same garment dressed on a white mannequin (apparel only)
 *
 * Generated images are stored in Supabase Storage under
 *   ai/<storeId>/<YYYY-MM-DD>/<jobId>-<kind>.webp
 * The per-day folder doubles as the usage counter for the daily limit.
 *
 * Env:
 *   AI_PHOTOS_ENABLED     – "false" disables the feature (default enabled when OPENAI_API_KEY is set)
 *   AI_PHOTO_DAILY_LIMIT  – products per store per day (default 10)
 */

export type StudioPhotoKind = 'white' | 'mannequin';

export interface StudioPhotoResult {
  kind: StudioPhotoKind;
  publicUrl: string;
  /** JPEG bytes, ready to send to Telegram */
  jpeg: Buffer;
}

/** Must leave room for download/upload inside the 60s background function. */
const GENERATION_TIMEOUT_MS = 45000;
const OUTPUT_SIZE = 1000;

const PRESERVE_RULES =
  'Keep the product EXACTLY as in the input photo: identical colors and shade, fabric texture, pattern, print, ' +
  'logos, labels, buttons, zippers, stitching, pockets, collar, length, cut and proportions. ' +
  'Do not redesign, recolor, simplify or add any details. No text, no watermark, no extra items.';

const PROMPTS: Record<StudioPhotoKind, string> = {
  white:
    'Create a professional e-commerce catalog photo of the product from the input image. ' +
    PRESERVE_RULES +
    ' Remove the original background, hanger, hands, people and surroundings completely. ' +
    'Place the product centered on a pure white (#FFFFFF) seamless studio background with soft, natural, ' +
    'even studio lighting and a subtle soft shadow. The product fills about 80% of the square frame.',
  mannequin:
    'Create a professional fashion e-commerce photo showing the garment from the input image dressed on a ' +
    'plain matte white display mannequin (headless torso form, no face, no skin). ' +
    PRESERVE_RULES +
    ' The garment must fit the mannequin naturally with realistic folds. ' +
    'Pure white (#FFFFFF) seamless studio background, soft even studio lighting, front view, ' +
    'mannequin centered and filling about 85% of the square frame.',
};

const NON_APPAREL_KEYWORDS = [
  'sneaker', 'shoe', 'boot', 'heel', 'sandal', 'footwear',
  'bag', 'handbag', 'backpack', 'wallet', 'clutch',
  'accessor', 'jewel', 'watch', 'belt', 'hat', 'cap', 'sunglass', 'scarf',
  'oyoq kiyim', 'sumka', 'aksessuar', 'обувь', 'сумк', 'аксессуар',
];

/** Mannequin only makes sense for clothing, not for shoes, bags or accessories. */
export function isApparelCategory(categoryName: string | null | undefined): boolean {
  if (!categoryName) return true;
  const name = categoryName.toLowerCase();
  return !NON_APPAREL_KEYWORDS.some((k) => name.includes(k));
}

export function isAiPhotoEnabled(): boolean {
  return isOpenAiImageConfigured() && process.env.AI_PHOTOS_ENABLED?.trim().toLowerCase() !== 'false';
}

export function getAiPhotoDailyLimit(): number {
  const n = parseInt(process.env.AI_PHOTO_DAILY_LIMIT || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/** Current date in Tashkent (UTC+5), used for the daily limit window. */
function tashkentDate(): string {
  return new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}

function usageFolder(storeId: string): string {
  return `ai/${safeSegment(storeId)}/${tashkentDate()}`;
}

/** Number of products that already got AI photos today in this store. */
export async function countAiPhotoJobsToday(storeId: string): Promise<number> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(usageFolder(storeId), { limit: 1000 });
  if (error) {
    console.warn('AI photo usage lookup failed:', error.message);
    return 0;
  }
  const jobIds = new Set((data || []).map((f) => f.name.replace(/-(white|mannequin)\.webp$/, '')));
  jobIds.delete('.emptyFolderPlaceholder');
  return jobIds.size;
}

export async function hasAiPhotoQuota(storeId: string): Promise<boolean> {
  return (await countAiPhotoJobsToday(storeId)) < getAiPhotoDailyLimit();
}

/** Prepares the source photo for the image model: PNG, max 1024px, white instead of transparency. */
async function toModelInput(source: Buffer): Promise<Buffer> {
  return sharp(source)
    .rotate()
    .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
}

async function generateOne(
  kind: StudioPhotoKind,
  input: Buffer,
  storeId: string,
  jobId: string
): Promise<StudioPhotoResult> {
  const generated = await editImageWithOpenAi({
    image: input,
    imageMimeType: 'image/png',
    prompt: PROMPTS[kind],
    timeoutMs: GENERATION_TIMEOUT_MS,
  });

  const normalized = sharp(generated)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' });
  const [webp, jpeg] = await Promise.all([
    normalized.clone().webp({ quality: 90 }).toBuffer(),
    normalized.clone().jpeg({ quality: 88 }).toBuffer(),
  ]);

  const storagePath = `${usageFolder(storeId)}/${safeSegment(jobId)}-${kind}.webp`;
  const supabase = getServerSupabase();
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, webp, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) throw new Error(`Failed to store AI photo: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return { kind, publicUrl, jpeg };
}

/**
 * Generates the requested studio photos in parallel.
 * Returns the ones that succeeded (failures are logged, never thrown).
 */
export async function generateStudioPhotos(params: {
  source: Buffer;
  storeId: string;
  jobId: string;
  kinds: StudioPhotoKind[];
}): Promise<StudioPhotoResult[]> {
  const input = await toModelInput(params.source);
  const results = await Promise.allSettled(
    params.kinds.map((kind) => generateOne(kind, input, params.storeId, params.jobId))
  );
  const ok: StudioPhotoResult[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push(r.value);
    else console.warn(`[Studio photo] ${params.kinds[i]} failed:`, r.reason?.message || r.reason);
  });
  return ok;
}
