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

export function cdnVideo(url: string): string {
  const m = url.match(CLOUDINARY_RE);
  if (!m || m[2] !== 'video') return url;
  if (/^[a-z]+_[^/]+\//.test(m[3])) return url;
  return `${m[1]}q_auto/${m[3]}`;
}
