import sharp from 'sharp';

/**
 * Loads product images for the bot.
 * Only images from trusted hosts are fetched (our Supabase Storage and the demo image CDN),
 * so a URL stored in the database can never make the server request arbitrary hosts.
 */
const MAX_BYTES = 10 * 1024 * 1024;
const CARD_PHOTO_SIZE = 800;

function trustedHosts(): string[] {
  const hosts = ['images.unsplash.com'];
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) hosts.push(new URL(supabaseUrl).host);
  } catch {
    // ignore malformed env
  }
  return hosts;
}

export function getProductPhotoUrl(product: {
  processed_images?: unknown;
  original_image?: string | null;
}): string | null {
  const processed = Array.isArray(product.processed_images) ? product.processed_images : [];
  const first = processed.find((u): u is string => typeof u === 'string' && u.length > 0);
  return first || product.original_image || null;
}

/** Downloads image bytes from a trusted host. Returns null on any problem. */
export async function fetchTrustedImage(url: string | null | undefined): Promise<Buffer | null> {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || !trustedHosts().includes(parsed.host)) return null;

  try {
    const res = await fetch(parsed, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return null;
    return bytes;
  } catch (err) {
    console.warn('Could not download product image:', err);
    return null;
  }
}

/**
 * Loads a product image for a Telegram card and converts it to JPEG.
 * Product images are stored as WebP, which Telegram does not reliably accept as a photo.
 */
export async function loadProductPhotoJpeg(url: string | null): Promise<Buffer | null> {
  const bytes = await fetchTrustedImage(url);
  if (!bytes) return null;
  try {
    return await sharp(bytes)
      .rotate()
      .resize(CARD_PHOTO_SIZE, CARD_PHOTO_SIZE, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.warn('Could not convert product photo for Telegram card:', err);
    return null;
  }
}
