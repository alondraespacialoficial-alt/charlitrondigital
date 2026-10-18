// Configuración del sitio. El dominio canónico se controla con VITE_SITE_URL
// (configurar en Vercel). Fallback al dominio de producción del proyecto.
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL ?? 'https://charlitrondigital.vercel.app'
).replace(/\/$/, '');

export const SITE_NAME = 'Charlitron Digital';

// Imagen Open Graph de marca (1200x630, logo centrado con márgenes amplios).
// Fallback social global: home, /blog y artículos sin portada.
export const DEFAULT_SOCIAL_IMAGE = absoluteUrl('/og-default.png');
export const DEFAULT_SOCIAL_IMAGE_ALT =
  'Logo de Charlitron Digital, agencia digital en San Luis Potosí';

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalized}`;
}
