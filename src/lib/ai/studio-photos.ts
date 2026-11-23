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

export const WHITE_PROMPT =
  'Create a professional e-commerce catalog photo of the product from the input image. ' +
  PRESERVE_RULES +
  ' Remove the original background, hanger, hands, people and surroundings completely. ' +
  'Place the product centered on a pure white (#FFFFFF) seamless studio background with soft, natural, ' +
  'even studio lighting and a subtle soft shadow. The product fills about 80% of the square frame.';

/**
 * Garment tone decides the mannequin color so garment, mannequin and backdrop never blend:
 *   light / mid-tone garment → matte graphite mannequin
 *   dark garment             → matte warm stone-beige mannequin
 */
export type GarmentTone = 'light' | 'dark';

/** How much of the mannequin is shown, chosen from the product category. */
export type MannequinFraming = 'knees' | 'full';

export type MannequinBody = 'female' | 'male' | 'child';

const MANNEQUIN_FINISH: Record<GarmentTone, string> = {
  light: 'a smooth matte graphite-grey (#3A3A3C) finish',
  dark: 'a smooth matte warm stone-beige (#CDBFAE) finish',
};

const FRAMING_TEXT: Record<MannequinFraming, string> = {
  knees:
    'Frame the shot from the top of the head down to just below the knees, so the garment is large and ' +
    'clearly visible; leave a small even margin above the head.',
  full:
    'Show the whole mannequin from head to feet with a small even margin, feet standing on the floor; ' +
    'the garment is the clear focus of the image.',
};

const BODY_TEXT: Record<MannequinBody, string> = {
  female: 'slim adult female',
  male: 'athletic adult male',
  child: 'child-size',
};

/** Tops and outerwear are framed to the knees; dresses, bottoms and sets in full length. */
const KNEE_FRAMING_KEYWORDS = [
  'blazer', 'jacket', 'coat', 'outerwear', 'top', 'blouse', 't-shirt', 'tee', 'shirt', 'sweater',
  'knit', 'hoodie', 'sweatshirt', 'cardigan', 'vest',
  'kurtka', 'palto', 'ko‘ylak', 'svitr', 'куртк', 'пальто', 'пиджак', 'рубашк', 'блуз', 'свитер', 'худи', 'футболк',
];

export function framingForCategory(categoryName: string | null | undefined): MannequinFraming {
  const name = (categoryName || '').toLowerCase();
  if (/dress|skirt|pant|trouser|jean|short|suit|jumpsuit|платье|юбк|брюк|джинс|костюм/.test(name)) return 'full';
  return KNEE_FRAMING_KEYWORDS.some((k) => name.includes(k)) ? 'knees' : 'full';
}

export function bodyForGender(gender: string | null | undefined): MannequinBody {
  const g = (gender || '').toUpperCase();
  if (g === 'MEN') return 'male';
  if (g === 'KIDS') return 'child';
  return 'female';
}

export function buildMannequinPrompt(opts: {
  tone: GarmentTone;
  framing: MannequinFraming;
  body: MannequinBody;
}): string {
  return (
    'Create a high-end fashion boutique e-commerce photo: the garment from the input image is worn by a ' +
    `full-size realistic ${BODY_TEXT[opts.body]} display mannequin with ${MANNEQUIN_FINISH[opts.tone]}, ` +
    'realistic human proportions, an abstract smooth egg-shaped head with no facial features and no hair, ' +
    'standing straight in a natural relaxed pose with arms hanging relaxed along the body. ' +
    PRESERVE_RULES +
    ' The garment is worn exactly like on a real person: shoulders and sleeves fully filled by the mannequin, ' +
    'correct garment length relative to the body, realistic folds and drape, same closures open or closed as ' +
    'in the input. The mannequin wears nothing else: no other clothing, no shoes, no jewelry; any visible legs ' +
    'are bare mannequin legs in the same finish. No visible stand or pole. ' +
    FRAMING_TEXT[opts.framing] +
    ' Background: clean seamless light warm grey studio backdrop (#EEEBE7) with a soft natural contact shadow ' +
    'on the floor. Soft, even, high-key studio lighting with gentle shadows, straight front view, centered, ' +
    'sharp focus, photorealistic.'
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
export async function toModelInput(source: Buffer): Promise<Buffer> {
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
  mannequinPrompt: string
): Promise<StudioPhotoResult> {
  const generated = await editImageWithOpenAi({
    image: input,
    imageMimeType: 'image/png',
    prompt: kind === 'white' ? WHITE_PROMPT : mannequinPrompt,
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
  /** Product category (decides knee-length vs full-length framing) */
  categoryName?: string | null;
  /** WOMEN | MEN | KIDS | UNISEX (decides the mannequin body) */
  gender?: string | null;
}): Promise<StudioPhotoResult[]> {
  const input = await toModelInput(params.source);
  let mannequinPrompt = '';
  if (params.kinds.includes('mannequin')) {
    const tone = await detectGarmentTone(input);
    const framing = framingForCategory(params.categoryName);
    const body = bodyForGender(params.gender);
    mannequinPrompt = buildMannequinPrompt({ tone, framing, body });
    console.log(`[Studio photo] job ${params.jobId}: mannequin tone=${tone} framing=${framing} body=${body}`);
  }
  const results = await Promise.allSettled(
    params.kinds.map((kind) => generateOne(kind, input, params.storeId, params.jobId, mannequinPrompt))
  );
  const ok: StudioPhotoResult[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push(r.value);
    else console.warn(`[Studio photo] ${params.kinds[i]} failed:`, r.reason?.message || r.reason);
  });
  return ok;
}
