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

const WHITE_PROMPT =
  'Create a professional e-commerce catalog photo of the product from the input image. ' +
  PRESERVE_RULES +
  ' Remove the original background, hanger, hands, people and surroundings completely. ' +
  'Place the product centered on a pure white (#FFFFFF) seamless studio background with soft, natural, ' +
  'even studio lighting and a subtle soft shadow. The product fills about 80% of the square frame.';

/**
 * Garment tone decides the mannequin color so the two never blend:
 *   light / mid-tone garment → matte graphite mannequin
 *   dark garment             → natural beige linen tailor's form
 */
export type GarmentTone = 'light' | 'dark';

const MANNEQUIN_STYLE: Record<GarmentTone, { form: string; stand: string }> = {
  light: { form: 'matte graphite-grey (#3A3A3C) dress form', stand: 'slim black metal' },
  dark: { form: "natural beige linen-covered tailor's dress form", stand: 'slim light oak wood' },
};

function mannequinPrompt(tone: GarmentTone): string {
  const style = MANNEQUIN_STYLE[tone];
  return (
    'Create a professional fashion boutique e-commerce photo of the garment from the input image ' +
    `dressed on a ${style.form}. ` +
    PRESERVE_RULES +
    ' The mannequin is a headless torso form that ends at the hips (no legs, no face, no skin, no head), ' +
    `mounted on a ${style.stand} stand with a small round base. ` +
    'The garment fits the form naturally with realistic folds and drape, worn the same way as in the input ' +
    '(same closures open or closed). ' +
    'Background: seamless light warm grey studio backdrop (#EEEBE7), clearly different from the mannequin, ' +
    'with a soft natural shadow on the floor under the stand so the mannequin looks grounded, not floating. ' +
    'Soft even studio lighting, straight front view, centered; the whole mannequin, stand and base are visible ' +
    'and the garment fills about 70-75% of the square frame.'
  );
}

/**
 * Estimates how light the garment is (0 = black, 255 = white), ignoring the background.
 * Background color is taken from the image border; pixels close to it are skipped.
 * Returns null if the garment cannot be separated from the background.
 */
export async function estimateGarmentLuminance(image: Buffer): Promise<number | null> {
  const size = 64;
  const { data } = await sharp(image)
    .resize(size, size, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = (x: number, y: number) => {
    const i = (y * size + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const border: number[][] = [];
  for (let i = 0; i < size; i++) border.push(px(i, 0), px(i, size - 1), px(0, i), px(size - 1, i));
  const median = (vals: number[]) => vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)];
  const bg = [0, 1, 2].map((c) => median(border.map((p) => p[c])));

  let sum = 0;
  let count = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b] = px(x, y);
      const dist = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
      if (dist < 60) continue;
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      count++;
    }
  }
  if (count < size * size * 0.05) return null;
  return sum / count;
}

/** Below this luminance the garment counts as dark (black, navy, dark brown, charcoal). */
const DARK_GARMENT_LUMINANCE = 100;

export async function detectGarmentTone(image: Buffer): Promise<GarmentTone> {
  try {
    const lum = await estimateGarmentLuminance(image);
    return lum !== null && lum < DARK_GARMENT_LUMINANCE ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

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
  jobId: string,
  tone: GarmentTone
): Promise<StudioPhotoResult> {
  const generated = await editImageWithOpenAi({
    image: input,
    imageMimeType: 'image/png',
    prompt: kind === 'white' ? WHITE_PROMPT : mannequinPrompt(tone),
    timeoutMs: GENERATION_TIMEOUT_MS,
  });

  const padColor = kind === 'white' ? '#ffffff' : '#eeebe7';
  const normalized = sharp(generated)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'contain', background: padColor })
    .flatten({ background: padColor });
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
  const tone = params.kinds.includes('mannequin') ? await detectGarmentTone(input) : 'light';
  if (params.kinds.includes('mannequin')) {
    console.log(`[Studio photo] job ${params.jobId}: garment tone ${tone} → ${MANNEQUIN_STYLE[tone].form}`);
  }
  const results = await Promise.allSettled(
    params.kinds.map((kind) => generateOne(kind, input, params.storeId, params.jobId, tone))
  );
  const ok: StudioPhotoResult[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push(r.value);
    else console.warn(`[Studio photo] ${params.kinds[i]} failed:`, r.reason?.message || r.reason);
  });
  return ok;
}
