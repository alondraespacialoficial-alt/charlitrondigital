export interface ProcessedImage {
  web: Blob;
  thumb: Blob;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
}

async function renderToWebP(source: CanvasImageSource, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D no disponible');
  context.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.82),
  );
  if (!blob) throw new Error('No se pudo generar WebP');
  return blob;
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const webScale = Math.min(1, 1600 / bitmap.width);
    const thumbScale = Math.min(1, 480 / bitmap.width);
    const width = Math.round(bitmap.width * webScale);
    const height = Math.round(bitmap.height * webScale);
    const thumbWidth = Math.round(bitmap.width * thumbScale);
    const thumbHeight = Math.round(bitmap.height * thumbScale);

    const [web, thumb] = await Promise.all([
      renderToWebP(bitmap, width, height),
      renderToWebP(bitmap, thumbWidth, thumbHeight),
    ]);
    return { web, thumb, width, height, thumbWidth, thumbHeight };
  } finally {
    bitmap.close();
  }
}