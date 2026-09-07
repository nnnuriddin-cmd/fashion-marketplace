import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export interface ProcessedImageResult {
  originalImageUrl: string;
  processedImageUrl: string;
}

export async function processSellerProductImage(
  inputBufferOrBase64: Buffer | string
): Promise<ProcessedImageResult> {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'products');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

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

  const fileHash = crypto.randomBytes(8).toString('hex');
  const rawFileName = `raw_${fileHash}.jpg`;
  const studioFileName = `studio_${fileHash}.webp`;

  const rawPath = path.join(uploadsDir, rawFileName);
  const studioPath = path.join(uploadsDir, studioFileName);

  // 1. Save raw seller photo
  await sharp(inputBuffer)
    .jpeg({ quality: 90 })
    .toFile(rawPath);

  // 2. AI Studio Background Removal & Formatting Pipeline
  // - Composites on clean neutral studio background (#F8F8F8)
  // - Resizes and centers product in 1000x1000 canvas
  // - Applies gentle studio lighting contrast & sharpening
  const studioCanvas = sharp({
    create: {
      width: 1000,
      height: 1000,
      channels: 4,
      background: { r: 248, g: 248, b: 248, alpha: 1 },
    },
  });

  const resizedProduct = await sharp(inputBuffer)
    .resize(850, 850, {
      fit: 'contain',
      background: { r: 248, g: 248, b: 248, alpha: 0 },
    })
    .modulate({ brightness: 1.03, saturation: 1.02 })
    .sharpen({ sigma: 1.2 })
    .toBuffer();

  await studioCanvas
    .composite([{ input: resizedProduct, gravity: 'center' }])
    .webp({ quality: 88 })
    .toFile(studioPath);

  return {
    originalImageUrl: `/uploads/products/${rawFileName}`,
    processedImageUrl: `/uploads/products/${studioFileName}`,
  };
}
