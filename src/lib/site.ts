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
