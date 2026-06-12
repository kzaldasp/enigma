import type { ImageMetadata } from 'astro';

/**
 * Resolución de imágenes por clave (sin extensión).
 * Los placeholders actuales son SVG; al reemplazarlos por fotografía
 * real basta con soltar `<clave>.jpg|png|webp` en la misma carpeta
 * y borrar el SVG — nada más cambia.
 */
const productFiles = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/products/*.{svg,jpg,jpeg,png,webp,avif}',
  { eager: true },
);

const campaignFiles = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/campaign/*.{svg,jpg,jpeg,png,webp,avif}',
  { eager: true },
);

const categoryFiles = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/categories/*.{svg,jpg,jpeg,png,webp,avif}',
  { eager: true },
);

function resolve(
  files: Record<string, { default: ImageMetadata }>,
  key: string,
  dir: string,
): ImageMetadata {
  const hit = Object.entries(files).find(([path]) =>
    new RegExp(`/${key}\\.(svg|jpe?g|png|webp|avif)$`).test(path),
  );
  if (!hit) {
    throw new Error(`[images] No existe "${key}" en src/assets/${dir}/ — ¿falta correr "npm run placeholders"?`);
  }
  return hit[1].default;
}

export const productImage = (key: string) => resolve(productFiles, key, 'products');
export const campaignImage = (key: string) => resolve(campaignFiles, key, 'campaign');
export const categoryImage = (key: string) => resolve(categoryFiles, key, 'categories');
