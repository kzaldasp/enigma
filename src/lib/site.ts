/**
 * Constantes estructurales de la marca. Los textos editables (temporada,
 * contacto, WhatsApp, manifiesto…) viven en la DB — ver src/lib/content.ts.
 */

export const SITE_NAME = 'ENIGMA';

/** Fallback estático; el valor editable viene de getSiteContent(). */
export const SITE_DESCRIPTION =
  'ENIGMA® — ropa contemporánea. Piezas limitadas, producción consciente. Lo esencial no se explica: se lleva puesto.';

/** Las categorías son editables desde el admin — ver src/lib/categories.ts. */
export type Category = string;

export function waLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/**
 * URL pública absoluta. No se puede derivar de `request.url`: dentro de una
 * función serverless de Vercel el host es `localhost`, y ese link acabaría
 * en los correos y WhatsApp del cliente. Orden de preferencia:
 *   PUBLIC_SITE_URL → SITE (astro.config) → dominio de producción de Vercel.
 */
export function siteUrl(path: string): string {
  const env = (k: string): string | undefined =>
    (import.meta.env?.[k] as string | undefined) ?? process.env[k];

  const vercel = env('VERCEL_PROJECT_PRODUCTION_URL');
  const base =
    env('PUBLIC_SITE_URL') ??
    env('SITE') ??
    (vercel ? `https://${vercel}` : undefined) ??
    'https://enigma593.com';

  return new URL(path, base.startsWith('http') ? base : `https://${base}`).toString();
}

export const NAV = [
  { label: 'INICIO', href: '/' },
  { label: 'CATÁLOGO', href: '/catalogo' },
  { label: 'LOOKBOOK', href: '/lookbook' },
  { label: 'ARCHIVO', href: '/archivo' },
] as const;

export function formatPrice(price: number): string {
  return `$${price} USD`;
}

export const PROVINCES = [
  'Azuay',
  'Bolívar',
  'Cañar',
  'Carchi',
  'Chimborazo',
  'Cotopaxi',
  'El Oro',
  'Esmeraldas',
  'Galápagos',
  'Guayas',
  'Imbabura',
  'Loja',
  'Los Ríos',
  'Manabí',
  'Morona Santiago',
  'Napo',
  'Orellana',
  'Pastaza',
  'Pichincha',
  'Santa Elena',
  'Santo Domingo de los Tsáchilas',
  'Sucumbíos',
  'Tungurahua',
  'Zamora Chinchipe',
] as const;
