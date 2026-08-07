/**
 * Constantes estructurales de la marca. Los textos editables (temporada,
 * contacto, WhatsApp, manifiesto…) viven en la DB — ver src/lib/content.ts.
 */

export const SITE_NAME = 'ENIGMA';

/** Fallback estático; el valor editable viene de getSiteContent(). */
export const SITE_DESCRIPTION =
  'Marca ecuatoriana de gorras y ropa de lujo. Series cortas y numeradas: lo que se agota no vuelve. Envíos a todo el Ecuador.';

/**
 * Frases con las que la marca quiere competir en Google. No se pintan como
 * meta keywords (Google las ignora desde 2009 y delatan sobreoptimización):
 * son la guía para escribir títulos, descripciones y textos de categoría.
 */
export const TARGET_QUERIES = [
  'marca de ropa ecuatoriana',
  'marcas de gorras ecuatorianas',
  'ropa de lujo Ecuador',
  'gorras Ecuador',
  'gorras Ibarra',
] as const;

/** Las categorías son editables desde el admin — ver src/lib/categories.ts. */
export type Category = string;

export function waLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/**
 * Número guardado en formato internacional sin "+" → legible.
 * 593980324621 → +593 98 032 4621. Si no calza con ese largo, se muestra
 * tal cual con el "+" delante: mejor un número crudo que uno mal cortado.
 */
export function formatPhone(number: string): string {
  const digits = number.replace(/\D/g, '');
  if (digits.length !== 12) return digits ? `+${digits}` : '';
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
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

/**
 * URL del panel de administración (otro despliegue). Solo se usa en los avisos
 * internos, para poder abrir el pedido con un clic. Sin ADMIN_URL configurada
 * devuelve '' y el correo se queda sin botón, sin romperse.
 */
export function adminUrl(path: string): string {
  const env = (k: string): string | undefined =>
    (import.meta.env?.[k] as string | undefined) ?? process.env[k];

  const base = env('ADMIN_URL');
  if (!base) return '';
  return new URL(path, base.startsWith('http') ? base : `https://${base}`).toString();
}

export const NAV = [
  { label: 'INICIO', href: '/' },
  { label: 'CATÁLOGO', href: '/catalogo' },
  { label: 'LOOKBOOK', href: '/lookbook' },
  { label: 'ARCHIVO', href: '/archivo' },
] as const;

/**
 * Navegación real: el lookbook se puede apagar desde el admin (Campañas),
 * y entonces no debe aparecer en ningún menú.
 */
export function navItems(lookbookEnabled: boolean): { label: string; href: string }[] {
  return NAV.filter((item) => lookbookEnabled || item.href !== '/lookbook').map((item) => ({
    ...item,
  }));
}

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
