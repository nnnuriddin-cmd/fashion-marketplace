import 'server-only';
import sharp from 'sharp';
import { getServerSupabase } from '@/lib/supabase-server';
import { STORAGE_BUCKET } from './image-processor';
import { editImageWithOpenAi, isOpenAiImageConfigured, OpenAiImageError } from './providers/openai-image';

/**
 * AI "studio" photos for products:
 *   white     – the same item on a clean white background
 *   mannequin – the same garment dressed on a display mannequin (apparel only)
 *   model     – the same garment worn by a fictional AI fashion model (adult apparel only)
 *
 * Generated images are stored in Supabase Storage under
 *   ai/<storeId>/<YYYY-MM-DD>/<jobId>-<kind>.webp
 * The per-day folder doubles as the usage counter for the daily limit.
 *
 * Env:
 *   AI_PHOTOS_ENABLED     – "false" disables the feature (default enabled when OPENAI_API_KEY is set)
 *   AI_PHOTO_DAILY_LIMIT  – products per store per day (default 10)
 */

export type StudioPhotoKind = 'white' | 'mannequin' | 'model';

export interface StudioPhotoResult {
  kind: StudioPhotoKind;
  publicUrl: string;
  /** JPEG bytes, ready to send to Telegram */
  jpeg: Buffer;
}

/** Time budget for one photo job (download + generation + upload) inside the 60s function. */
export const STUDIO_JOB_BUDGET_MS = 54000;
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

/**
 * Fictional AI fashion model wearing the product (adult clothing only).
 * The person is invented: never a real person or celebrity.
 * Simple neutral basics may complete the outfit, but never cover the product.
 */
export function buildModelPrompt(opts: { body: 'female' | 'male' }): string {
  const person =
    opts.body === 'male'
      ? 'a handsome adult male fashion model in his late 20s with a neat modern haircut and well-groomed look'
      : 'a beautiful adult female fashion model in her mid 20s with natural, elegant makeup and a neat, sleek hairstyle';
  return (
    'Create a photorealistic high-end fashion e-commerce catalog photo of ' +
    `${person}, wearing the garment from the input image. ` +
    'The model is a fictional person (not a real person or celebrity), with a friendly, confident expression, ' +
    'looking at the camera, standing in a natural relaxed fashion pose. ' +
    PRESERVE_RULES +
    ' The garment is worn naturally with realistic fit, folds and drape, same closures open or closed as in the ' +
    'input, and it is the clear focus of the photo, fully visible and not covered by hair, arms or other clothes. ' +
    'Complete the look only with simple, plain, neutral basics where needed (e.g. plain black or beige trousers or ' +
    'skirt, simple neutral shoes), in muted colors that do not compete with the product; no logos, no jewelry, no bags. ' +
    'Full-body shot from head to feet with a small margin. ' +
    'Background: clean seamless light warm grey studio backdrop (#EEEBE7) with a soft natural floor shadow. ' +
    'Soft, even, high-key studio lighting, sharp focus, realistic skin texture and hands, natural proportions.'
  );
}

/**
 * How the AI-model photo is cropped, so only the product is the focus:
 *   top    – tops & outerwear: head to mid-thigh (no shoes, little of the trousers)
 *   bottom – trousers, jeans, skirts, shorts: waist to feet
 *   full   – dresses, jumpsuits, suits: whole figure
 */
export type ModelFraming = 'top' | 'bottom' | 'full';

export function modelFramingForCategory(categoryName: string | null | undefined): ModelFraming {
  const name = (categoryName || '').toLowerCase();
  if (/dress|gown|jumpsuit|overall|suit|платье|костюм|комбинезон/.test(name)) return 'full';
  if (/pant|trouser|jean|short|skirt|legging|брюк|джинс|юбк|шорт|shim|yubka/.test(name)) return 'bottom';
  if (KNEE_FRAMING_KEYWORDS.some((k) => name.includes(k))) return 'top';
  return 'full';
}

/**
 * Finds the person on the light studio backdrop (bounding box of pixels that differ
 * from the border color) and crops a square around the part that shows the product.
 * Returns the input unchanged if the figure cannot be found reliably.
 */
export async function cropModelPhoto(image: Buffer, framing: ModelFraming): Promise<Buffer> {
  if (framing === 'full') return image;
  const meta = await sharp(image).metadata();
  const W = meta.width || 0;
  const H = meta.height || 0;
  if (!W || !H) return image;

  // Detect the figure on a small copy
  const S = 200;
  const { data } = await sharp(image).resize(S, S, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => {
    const i = (y * S + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const border: number[][] = [];
  for (let i = 0; i < S; i++) border.push(px(i, 0), px(i, S - 1), px(0, i), px(S - 1, i));
  const median = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)];
  const bg = [0, 1, 2].map((c) => median(border.map((p) => p[c])));

  const isFigure = (x: number, y: number) => {
    const [r, g, b] = px(x, y);
    return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 60;
  };
  const rowHits = new Array(S).fill(0);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (isFigure(x, y)) rowHits[y]++;
  const minHits = 2;
  const top = rowHits.findIndex((n) => n >= minHits);
  const bottom = S - 1 - [...rowHits].reverse().findIndex((n) => n >= minHits);
  if (top < 0 || bottom - top < S * 0.4) return image; // no clear full-body figure

  // Back to full-size coordinates
  const fy0 = (top / S) * H;
  const fy1 = ((bottom + 1) / S) * H;
  const fh = fy1 - fy0;

  let y0: number;
  let y1: number;
  if (framing === 'top') {
    y0 = fy0 - 0.04 * H;
    y1 = fy0 + 0.6 * fh;
  } else {
    y0 = fy0 + 0.42 * fh;
    y1 = fy1 + 0.03 * H;
  }

  // Horizontal center, taken from the torso (shoulders to hips): there the person is one wide
  // blob, unlike the legs. For every torso row take the longest run of figure pixels that does
  // not touch the image edge (edges are backdrop gradients), then the median of run centers.
  const centers: number[] = [];
  const ry0 = Math.max(0, Math.floor(top + 0.12 * (bottom - top)));
  const ry1 = Math.min(S - 1, Math.ceil(top + 0.48 * (bottom - top)));
  for (let y = ry0; y <= ry1; y++) {
    let best: [number, number] | null = null;
    let runStart = -1;
    let lastHit = -10;
    const closeRun = (end: number) => {
      if (runStart < 0) return;
      const touchesEdge = runStart === 0 || end === S - 1;
      if (!touchesEdge && (!best || end - runStart > best[1] - best[0])) best = [runStart, end];
      runStart = -1;
    };
    for (let x = 0; x < S; x++) {
      if (!isFigure(x, y)) continue;
      if (x - lastHit > 4) {
        closeRun(lastHit);
        runStart = x;
      }
      lastHit = x;
    }
    closeRun(lastHit);
    if (best) centers.push((best[0] + best[1]) / 2);
  }
  if (centers.length === 0) return image;
  centers.sort((a, b) => a - b);
  const cx = ((centers[Math.floor(centers.length / 2)] + 0.5) / S) * W;

  // Square crop, shifted to stay inside the photo (no padding bands)
  const side = Math.min(Math.round(y1 - y0), W, H);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const x0 = Math.round(clamp(cx - side / 2, 0, W - side));
  const y0r = Math.round(clamp(y0, 0, H - side));

  return sharp(image)
    .extract({ left: x0, top: y0r, width: side, height: side })
    .jpeg({ quality: 92 })
    .toBuffer();
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
  const jobIds = new Set((data || []).map((f) => f.name.replace(/-(white|mannequin|model)\.webp$/, '')));
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


/** Retry once only if at least this much time is left in the job's budget. */
const MIN_RETRY_BUDGET_MS = 25000;

function buildPrompt(
  kind: StudioPhotoKind,
  input: Buffer,
  jobId: string,
  categoryName?: string | null,
  gender?: string | null
): Promise<string> {
  if (kind === 'white') return Promise.resolve(WHITE_PROMPT);
  if (kind === 'model') {
    const body = bodyForGender(gender) === 'male' ? 'male' : 'female';
    console.log(`[Studio photo] job ${jobId}: AI model body=${body}`);
    return Promise.resolve(buildModelPrompt({ body }));
  }
  return detectGarmentTone(input).then((tone) => {
    const framing = framingForCategory(categoryName);
    const body = bodyForGender(gender);
    console.log(`[Studio photo] job ${jobId}: mannequin tone=${tone} framing=${framing} body=${body}`);
    return buildMannequinPrompt({ tone, framing, body });
  });
}

/**
 * Generates ONE studio photo (white or mannequin) and stores it.
 * Retries once on a transient OpenAI error if enough of the time budget is left.
 * Throws if it could not be generated.
 */
export async function generateStudioPhoto(params: {
  source: Buffer;
  storeId: string;
  jobId: string;
  kind: StudioPhotoKind;
  /** Product category (decides knee-length vs full-length framing) */
  categoryName?: string | null;
  /** WOMEN | MEN | KIDS | UNISEX (decides the mannequin body) */
  gender?: string | null;
  /** Absolute time (ms since epoch) by which generation must finish */
  deadline: number;
}): Promise<StudioPhotoResult> {
  const { kind } = params;
  const input = await toModelInput(params.source);
  const prompt = await buildPrompt(kind, input, params.jobId, params.categoryName, params.gender);

  let generated: Buffer | null = null;
  for (let attempt = 1; attempt <= 2 && !generated; attempt++) {
    const timeoutMs = params.deadline - Date.now();
    if (timeoutMs < 5000) throw new Error(`No time left to generate ${kind} photo`);
    try {
      generated = await editImageWithOpenAi({ image: input, imageMimeType: 'image/png', prompt, timeoutMs });
    } catch (err) {
      const retryable =
        attempt === 1 &&
        err instanceof OpenAiImageError &&
        err.transient &&
        params.deadline - Date.now() >= MIN_RETRY_BUDGET_MS;
      console.warn(`[Studio photo] ${kind} attempt ${attempt} failed${retryable ? ', retrying' : ''}:`, (err as Error).message);
      if (!retryable) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!generated) throw new Error(`Could not generate ${kind} photo`);

  // AI model: frame the shot around the product so added basics (trousers, shoes…) don't look like part of a set
  if (kind === 'model') {
    const framing = modelFramingForCategory(params.categoryName);
    generated = await cropModelPhoto(generated, framing);
    console.log(`[Studio photo] job ${params.jobId}: model framing=${framing}`);
  }

  const padColor = kind === 'white' ? '#ffffff' : '#eeebe7';
  const normalized = sharp(generated)
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'contain', background: padColor })
    .flatten({ background: padColor });
  const [webp, jpeg] = await Promise.all([
    normalized.clone().webp({ quality: 90 }).toBuffer(),
    normalized.clone().jpeg({ quality: 88 }).toBuffer(),
  ]);

  const storagePath = `${usageFolder(params.storeId)}/${safeSegment(params.jobId)}-${kind}.webp`;
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
