import type { APIRoute } from 'astro';
import { getProducts } from '../lib/products';
import { getCampaigns } from '../lib/campaigns';
import { getSiteContent } from '../lib/content';

export const prerender = false;

/**
 * Sitemap dinámico: rutas fijas + productos activos + campañas publicadas.
 * Con el lookbook apagado en el admin, sus rutas redirigen: no se anuncian.
 */
export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL('https://enigma-1nor.vercel.app')).href.replace(/\/$/, '');
  const [products, campaigns, content] = await Promise.all([
    getProducts(),
    getCampaigns(),
    getSiteContent(),
  ]);

  const urls = [
    '/',
    '/catalogo',
    ...(content.lookbookEnabled ? ['/lookbook'] : []),
    '/archivo',
    '/marca',
    '/legal',
    ...products.map((p) => `/producto/${p.slug}`),
    ...(content.lookbookEnabled
      ? campaigns.filter((c) => c.items.length > 0).map((c) => `/lookbook/${c.slug}`)
      : []),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' },
  });
};
