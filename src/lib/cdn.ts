/**
 * Optimización de medios de Cloudinary insertando transformaciones en la
 * URL de entrega: f_auto (WebP/AVIF según navegador), q_auto y ancho máximo.
 * URLs locales (seed /products/*.svg, /uploads/*) pasan sin tocar.
 */
const CLOUDINARY_RE = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\/)(.+)$/;

export function cdnImage(url: string, width: number): string {
  const m = url.match(CLOUDINARY_RE);
  if (!m || m[2] !== 'image') return url;
  if (/^[a-z]+_[^/]+\//.test(m[3])) return url; // ya tiene transformaciones
  return `${m[1]}f_auto,q_auto,w_${width},c_limit/${m[3]}`;
}

/** Anchos de la escalera responsive: cubren de móvil a pantalla retina grande. */
export const IMAGE_WIDTHS = [480, 750, 1080, 1440, 2000] as const;

/**
 * `srcset` para que el navegador baje solo el ancho que necesita: en un
 * teléfono son ~500 px en vez de los 2000 px del hero, y esa diferencia es la
 * que decide el LCP con datos móviles. Devuelve '' si la URL no es de
 * Cloudinary (los SVG locales ya pesan poco y no admiten transformación).
 */
export function cdnSrcset(url: string, widths: readonly number[] = IMAGE_WIDTHS): string {
  if (!CLOUDINARY_RE.test(url)) return '';
  return widths.map((w) => `${cdnImage(url, w)} ${w}w`).join(', ');
}

export function cdnVideo(url: string): string {
  const m = url.match(CLOUDINARY_RE);
  if (!m || m[2] !== 'video') return url;
  if (/^[a-z]+_[^/]+\//.test(m[3])) return url;
  return `${m[1]}q_auto/${m[3]}`;
}
