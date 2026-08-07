import type { APIRoute } from 'astro';
import { getProducts, type Product, type ProductSize } from '../lib/products';
import { getCategories, type CategoryInfo } from '../lib/categories';
import { getSiteContent } from '../lib/content';
import { siteUrl } from '../lib/site';

export const prerender = false;

/**
 * Feed de productos para Google Merchant Center (RSS 2.0 + namespace g:).
 *
 * Cómo se conecta: Merchant Center → Productos → Fuentes de datos → Añadir
 * fuente de datos → "Archivo" / desde URL, y se pega
 * https://enigma593.com/feed.xml con la frecuencia de recogida diaria. El feed
 * se apaga desde el admin (SEO → feed) y entonces esta ruta responde 404, que
 * es lo que Merchant Center interpreta como fuente no disponible.
 *
 * Advertencia: la tienda cobra por transferencia bancaria con comprobante
 * validado a mano, no con pasarela en línea. Merchant Center suele pedir
 * revisión manual del proceso de compra en estos casos (y puede exigir que la
 * política de pago, envíos y cambios esté visible en /legal antes de aprobar
 * la cuenta). Conviene avisarlo en la verificación en vez de esperar el
 * rechazo automático.
 *
 * Una entrada por talla, agrupadas con g:item_group_id = slug: así Google
 * muestra la pieza una sola vez y no compite consigo misma por variante.
 */

/** Escapa lo que va dentro de un nodo XML; los textos vienen del admin. */
function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Límite duro de Google: 150 caracteres en title, 5000 en description. */
function trim(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function absolute(url: string): string {
  return url.startsWith('http') ? url : siteUrl(url);
}

/** 'M/L' → 'm-l'; el g:id tiene que ser estable y sin caracteres raros. */
function idSlug(size: string): string {
  return (
    size
      .toLowerCase()
      // Cualquier cosa que no sea alfanumérica ASCII (tildes, barras, espacios)
      // pasa a guion: el g:id debe ser estable y legible.
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'u'
  );
}

function tag(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return `    <${name}>${xml(String(value))}</${name}>`;
}

function item(
  p: Product,
  size: ProductSize | null,
  cat: CategoryInfo | undefined,
  shippingCost: number,
  country: string,
): string {
  const brand = p.brand || 'ENIGMA';
  const link = siteUrl(`/producto/${p.slug}`);
  const named = p.title.toLowerCase().includes(brand.toLowerCase())
    ? p.title
    : `${brand} ${p.title}`;
  // El título de la variante nombra la talla: es lo que Google espera cuando
  // varias entradas comparten item_group_id.
  const title = trim(size ? `${named} — Talla ${size.size}` : named, 150);
  // description es obligatoria en Merchant Center; sin texto en el admin se
  // arma con el nombre y la categoría en vez de dejarla vacía.
  const description = trim(
    p.description || p.seoDescription || `${named}, ${cat?.label ?? p.category} de ${brand}.`,
    5000,
  );
  // Stock null = talla sin control de inventario en el admin → disponible.
  const inStock = !p.soldOut && (size === null || size.stock !== 0);
  const images = p.images.map(absolute);

  return [
    '  <item>',
    tag('g:id', size ? `${p.slug}-${idSlug(size.size)}` : p.slug),
    tag('g:item_group_id', p.slug),
    tag('title', title),
    tag('description', description),
    tag('link', link),
    tag('g:image_link', images[0]),
    // Solo imágenes: Merchant Center rechaza videos en image_link.
    ...images.slice(1, 11).map((url) => tag('g:additional_image_link', url)),
    tag('g:availability', inStock ? 'in_stock' : 'out_of_stock'),
    tag('g:price', `${p.price.toFixed(2)} USD`),
    tag('g:condition', 'new'),
    tag('g:brand', brand),
    size ? tag('g:size', size.size) : '',
    tag('g:color', p.color),
    tag('g:material', p.material),
    // gender y age_group deben usar el vocabulario de Google
    // (male/female/unisex, adult/kids…); se emite lo que puso el admin.
    tag('g:gender', p.gender),
    tag('g:age_group', p.ageGroup),
    tag('g:google_product_category', p.googleCategory || cat?.googleCategory || ''),
    tag('g:product_type', cat?.label || p.category),
    // Marca propia sin código de barras: Google exige declarar la ausencia de
    // identificadores. Con gtin o mpn presentes NO debe ir identifier_exists.
    ...(p.gtin || p.mpn
      ? [tag('g:gtin', p.gtin), tag('g:mpn', p.mpn)]
      : [tag('g:identifier_exists', 'no')]),
    '    <g:shipping>',
    tag('g:country', country),
    tag('g:price', `${shippingCost.toFixed(2)} USD`),
    '    </g:shipping>',
    '  </item>',
  ]
    .filter(Boolean)
    .join('\n');
}

export const GET: APIRoute = async () => {
  const content = await getSiteContent();
  if (!content.seoFeedEnabled) {
    return new Response('Feed desactivado', { status: 404 });
  }

  const products = await getProducts();
  let categories: CategoryInfo[] = [];
  try {
    categories = await getCategories();
  } catch {
    // Sin categorías el feed sale igual: product_type cae al slug y
    // google_product_category solo lo lleva quien lo tenga en el producto.
  }
  const catBy = new Map(categories.map((c) => [c.slug, c]));
  const country = content.contactCountry || 'EC';

  const items = products
    // Las piezas marcadas noindex no se indexan ni se anuncian. Sin imagen no
    // hay entrada válida: image_link es obligatorio en Merchant Center.
    .filter((p) => !p.seoNoindex && p.images.length > 0)
    .flatMap((p) => {
      const cat = catBy.get(p.category);
      const variants: (ProductSize | null)[] = p.sizes.length > 0 ? p.sizes : [null];
      return variants.map((size) => item(p, size, cat, content.shippingCost, country));
    });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>${xml('ENIGMA® — Catálogo')}</title>
  <link>${xml(siteUrl('/'))}</link>
  <description>${xml(trim(content.siteDescription, 5000))}</description>
${items.join('\n')}
</channel>
</rss>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Merchant Center recoge el feed una vez al día; una hora de caché
      // basta para absorber reintentos sin servir precios viejos.
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
