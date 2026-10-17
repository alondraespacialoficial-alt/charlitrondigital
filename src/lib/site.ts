// Configuración del sitio. El dominio canónico se controla con VITE_SITE_URL
// (configurar en Vercel). Fallback al dominio de producción del proyecto.
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL ?? 'https://charlitrondigital.vercel.app'
).replace(/\/$/, '');

export const SITE_NAME = 'Charlitron Digital';

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}
