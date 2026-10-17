// Optimización de imágenes EN CLIENTE antes del upload:
// genera WebP `web` (máx 1600px) y `thumb` (máx 480px) vía canvas.
// Sin dependencias y sin Supabase Image Transformations → costos predecibles.
import { supabase } from '../../lib/supabaseClient';

const BUCKET = 'article-images';

interface ProcessedImage {
  web: Blob;
  thumb: Blob;
}

async function renderToWebP(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.82),
  );
  if (!blob) throw new Error('No se pudo generar WebP');
  return blob;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  const scaleWeb = Math.min(1, 1600 / bitmap.width);
  const scaleThumb = Math.min(1, 480 / bitmap.width);

  const web = await renderToWebP(
    bitmap,
    Math.round(bitmap.width * scaleWeb),
    Math.round(bitmap.height * scaleWeb),
  );
  const thumb = await renderToWebP(
    bitmap,
    Math.round(bitmap.width * scaleThumb),
    Math.round(bitmap.height * scaleThumb),
  );
  bitmap.close();
  return { web, thumb };
}

export interface UploadedCover {
  webUrl: string;
  thumbUrl: string;
}

export async function uploadCover(file: File, articleId: string): Promise<UploadedCover> {
  const { web, thumb } = await processImage(file);
  const stamp = Date.now();
  const basePath = `covers/${articleId}/${stamp}`;

  const uploads = await Promise.all([
    supabase.storage.from(BUCKET).upload(`${basePath}-web.webp`, web, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    }),
    supabase.storage.from(BUCKET).upload(`${basePath}-thumb.webp`, thumb, {
      contentType: 'image/webp',
      cacheControl: '31536000',
      upsert: false,
    }),
  ]);
  for (const result of uploads) {
    if (result.error) throw result.error;
  }

  const { data: webData } = supabase.storage.from(BUCKET).getPublicUrl(`${basePath}-web.webp`);
  const { data: thumbData } = supabase.storage.from(BUCKET).getPublicUrl(`${basePath}-thumb.webp`);
  return { webUrl: webData.publicUrl, thumbUrl: thumbData.publicUrl };
}
