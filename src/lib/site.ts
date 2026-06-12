/**
 * Constantes estructurales de la marca. Los textos editables (temporada,
 * contacto, WhatsApp, manifiesto…) viven en la DB — ver src/lib/content.ts.
 */

export const SITE_NAME = 'ENIGMA';

/** Fallback estático; el valor editable viene de getSiteContent(). */
export const SITE_DESCRIPTION =
  'ENIGMA® — ropa contemporánea. Piezas limitadas, producción consciente. Lo esencial no se explica: se lleva puesto.';

/** Mismo orden en que se muestran filtros y bloques de categoría. */
export const CATEGORIES = ['superior', 'inferior', 'accesorios'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  superior: 'PARTE SUPERIOR',
  inferior: 'PARTE INFERIOR',
  accesorios: 'ACCESORIOS',
};

export function waLink(number: string, message: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export const NAV = [
  { label: 'INICIO', href: '/' },
  { label: 'CATÁLOGO', href: '/catalogo' },
  { label: 'LOOKBOOK', href: '/lookbook' },
] as const;

export function formatPrice(price: number): string {
  return `$${price} USD`;
}
