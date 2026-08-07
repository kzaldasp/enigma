import type { APIRoute } from 'astro';
import { getProducts } from '../lib/products';
import { getCampaigns } from '../lib/campaigns';
import { getSiteContent } from '../lib/content';
import { getCategories } from '../lib/categories';
import { getNoindexPaths, normalizePath } from '../lib/seo';

export const prerender = false;

/**
 * Sitemap dinámico: rutas fijas + categorías + productos activos + campañas
 * publicadas. Con el lookbook apagado en el admin, sus rutas redirigen: no se
 * anuncian.
 *
 * Lo que se anuncia debe ser indexable, así que se excluye todo lo que esté
 * marcado noindex (rutas en seo_pages y piezas con seo_noindex): un sitemap
 * que ofrece páginas noindex es una contradicción que Search Console reporta.
 *
 * No se emiten `changefreq` ni `priority`: Google los ignora desde hace años
 * (lo dijo explícitamente) y solo añaden ruido y mantenimiento. Sí se emite
 * `lastmod`, que sí usa, pero únicamente donde hay una fecha real — la de alta
 * del producto. Para las rutas fijas se omite antes que inventar una.
 */
type Entry = {
  path: string;
  /** AAAA-MM-DD; solo cuando hay fecha real en la base. */
  lastmod?: string;
  /** URLs absolutas de imagen para la extensión de imágenes. */
  images?: string[];
};

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * `created_at` llega como 'AAAA-MM-DD HH:MM:SS' (datetime de SQLite) o en ISO.
 * Se queda solo con la fecha: es un formato válido de W3C Datetime y evita
 * declarar una hora en un huso que no sabemos cuál es.
 */
function toLastmod(value: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match?.[1];
}

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL('https://enigma593.com')).href.replace(/\/$/, '');
  const absolute = (url: string) => (/^https?:\/\//i.test(url) ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`);

  const [products, campaigns, content, categories, noindexPaths] = await Promise.all([
    getProducts(),
    getCampaigns(),
    getSiteContent(),
    getCategories(),
    getNoindexPaths(),
  ]);

  const entries: Entry[] = [
    { path: '/' },
    { path: '/catalogo' },
    ...categories.map((c) => ({ path: `/catalogo/${c.slug}` })),
    ...(content.lookbookEnabled ? [{ path: '/lookbook' }] : []),
    { path: '/archivo' },
    { path: '/marca' },
    { path: '/legal' },
    ...products
      .filter((p) => !p.seoNoindex)
      .map((p) => ({
        path: `/producto/${p.slug}`,
        lastmod: toLastmod(p.createdAt),
        // Solo la primera imagen: es la que representa la pieza. Anunciar la
        // galería completa no aporta nada en Google Imágenes.
        images: p.images.slice(0, 1).map(absolute),
      })),
    ...(content.lookbookEnabled
      ? campaigns.filter((c) => c.items.length > 0).map((c) => ({ path: `/lookbook/${c.slug}` }))
      : []),
  ].filter((entry) => !noindexPaths.has(normalizePath(entry.path)));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries
  .map((entry) => {
    const parts = [`<loc>${esc(base + entry.path)}</loc>`];
    if (entry.lastmod) parts.push(`<lastmod>${entry.lastmod}</lastmod>`);
    for (const image of entry.images ?? []) {
      parts.push(`<image:image><image:loc>${esc(image)}</image:loc></image:image>`);
    }
    return `  <url>${parts.join('')}</url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' },
  });
};
