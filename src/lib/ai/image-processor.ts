import 'server-only';
import sharp from 'sharp';
import crypto from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';

export const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB max input
export const MIN_IMAGE_SIZE_BYTES = 100; // 100 bytes minimum
export const STORAGE_BUCKET = 'product-images';
export const STUDIO_DIMENSION = 1000;
export const PRODUCT_MAX_DIMENSION = 850;

export interface ProcessedProductImage {
  publicUrl: string;
  storagePath: string;
  width: number;
  height: number;
  format: 'webp';
  sizeBytes: number;
}

export interface ProcessAndStoreOptions {
  inputBuffer: Buffer;
  storeId: string;
  fileId?: string;
}

/**
 * Validates and transforms an input image buffer into a standardized 1000x1000 WebP
 * with neutral studio canvas background (#F8F8F8), gentle contrast adjustment, and sharpening.
 *
 * Security & Validation:
 * - Rejects files exceeding MAX_IMAGE_SIZE_BYTES (15MB) or under MIN_IMAGE_SIZE_BYTES.
 * - Rejects non-image or corrupt binary payloads via Sharp metadata analysis.
 * - Auto-orients images using EXIF data to avoid sideways smartphone camera photos.
 * - Memory-only processing: does NOT touch the local filesystem.
 */
export async function processProductImageBuffer(inputBuffer: Buffer): Promise<Buffer> {
  if (!inputBuffer || inputBuffer.length < MIN_IMAGE_SIZE_BYTES) {
    throw new Error('Image data is empty or too small to be valid.');
  }

  if (inputBuffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Image size exceeds maximum allowed limit of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB.`);
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(inputBuffer).metadata();
  } catch {
    throw new Error('Corrupted or invalid image file. Please send a valid JPEG, PNG, or WebP photo.');
  }

  const allowedFormats = ['jpeg', 'png', 'webp', 'heif', 'avif', 'tiff'];
  if (!metadata.format || !allowedFormats.includes(metadata.format.toLowerCase())) {
    throw new Error(`Unsupported image format: ${metadata.format || 'unknown'}. Allowed formats: JPEG, PNG, WebP.`);
  }

  if (!metadata.width || !metadata.height || metadata.width < 50 || metadata.height < 50) {
    throw new Error('Image dimensions are too small (minimum 50x50 pixels required).');
  }

  // 1. Studio background canvas (1000x1000, #F8F8F8)
  const studioCanvas = sharp({
    create: {
      width: STUDIO_DIMENSION,
      height: STUDIO_DIMENSION,
      channels: 4,
      background: { r: 248, g: 248, b: 248, alpha: 1 },
    },
  });

  // 2. Center and resize product photo (max 850x850, contained, gentle contrast enhancement)
  const resizedProduct = await sharp(inputBuffer)
    .rotate() // Auto-orient based on EXIF tag
    .resize(PRODUCT_MAX_DIMENSION, PRODUCT_MAX_DIMENSION, {
      fit: 'contain',
      background: { r: 248, g: 248, b: 248, alpha: 0 },
    })
    .modulate({ brightness: 1.03, saturation: 1.02 })
    .sharpen({ sigma: 1.2 })
    .toBuffer();

  // 3. Composite onto canvas and export high-quality WebP
  return studioCanvas
    .composite([{ input: resizedProduct, gravity: 'center' }])
    .webp({ quality: 88, effort: 4 })
    .toBuffer();
}

/**
 * Uploads a processed image buffer to Supabase Storage in the 'product-images' bucket
 * and returns the permanent public URL.
 */
export async function uploadProductImageToStorage(
  imageBuffer: Buffer,
  storeId: string,
  fileId?: string
): Promise<{ publicUrl: string; storagePath: string }> {
  const sanitizedStoreId = storeId.replace(/[^a-zA-Z0-9_-]/g, '');
  const uniqueId = fileId ? fileId.replace(/[^a-zA-Z0-9_-]/g, '') : crypto.randomUUID();
  const storagePath = `products/${sanitizedStoreId}/${uniqueId}.webp`;

  const supabase = getServerSupabase();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, imageBuffer, {
      contentType: 'image/webp',
      cacheControl: '31536000', // 1 year immutable
      upsert: true,
    });

  if (error) {
    console.error('Failed to upload image to Supabase Storage bucket:', STORAGE_BUCKET, error);
    throw new Error(`Failed to store product image: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);

  return { publicUrl, storagePath };
}

/**
 * End-to-end memory pipeline:
 * Validates input -> Sharp 1000x1000 WebP -> Supabase Storage upload -> returns permanent public URL.
 * Never touches the local filesystem.
 */
export async function processAndStoreProductImage({
  inputBuffer,
  storeId,
  fileId,
}: ProcessAndStoreOptions): Promise<ProcessedProductImage> {
  const processedBuffer = await processProductImageBuffer(inputBuffer);
  const { publicUrl, storagePath } = await uploadProductImageToStorage(
    processedBuffer,
    storeId,
    fileId
  );

  return {
    publicUrl,
    storagePath,
    width: STUDIO_DIMENSION,
    height: STUDIO_DIMENSION,
    format: 'webp',
    sizeBytes: processedBuffer.length,
  };
}

// Backwards-compatible legacy signature
export interface ProcessedImageResult {
  originalImageUrl: string;
  processedImageUrl: string;
}

export async function processSellerProductImage(
  inputBufferOrBase64: Buffer | string,
  storeId?: string
): Promise<ProcessedImageResult> {
  let inputBuffer: Buffer;
  if (typeof inputBufferOrBase64 === 'string') {
    if (inputBufferOrBase64.startsWith('http://') || inputBufferOrBase64.startsWith('https://')) {
      const res = await fetch(inputBufferOrBase64);
      const arrayBuf = await res.arrayBuffer();
      inputBuffer = Buffer.from(arrayBuf);
    } else {
      const base64Data = inputBufferOrBase64.replace(/^data:image\/\w+;base64,/, '');
      inputBuffer = Buffer.from(base64Data, 'base64');
    }
  } else {
    inputBuffer = inputBufferOrBase64;
  }

  const resolvedStoreId = storeId || 'general';
  const result = await processAndStoreProductImage({
    inputBuffer,
    storeId: resolvedStoreId,
  });

  return {
    originalImageUrl: result.publicUrl,
    processedImageUrl: result.publicUrl,
  };
}

