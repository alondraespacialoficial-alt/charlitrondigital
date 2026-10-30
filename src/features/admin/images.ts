// Optimización de imágenes EN CLIENTE antes del upload:
// genera WebP `web` (máx 1600px) y `thumb` (máx 480px) vía canvas.
// Sin dependencias y sin Supabase Image Transformations → costos predecibles.
import { supabase } from '../../lib/supabaseClient';
import { processImage } from './imageProcessing';

export { processImage } from './imageProcessing';

const BUCKET = 'article-images';

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
