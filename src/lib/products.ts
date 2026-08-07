import type { ResultSet } from '@libsql/client';
import { db, cached } from './db';
import type { Category } from './site';

export type ProductSize = { size: string; stock: number | null };
export type ProductMedia = { url: string; type: 'image' | 'video' };

export type Product = {
  id: number;
  slug: string;
  title: string;
  price: number;
  description: string;
  sizes: ProductSize[];
  /** Imágenes y videos cortos en orden; URLs absolutas o relativas a public/. */
  media: ProductMedia[];
  /** Solo las imágenes (para OG, JSON-LD y miniaturas de carrito). */
  images: string[];
  category: Category;
  /** Texto libre desde el admin; 'AGOTADO' bloquea compra, 'NUEVO' destaca. */
  badge: string | null;
  /** AGOTADO manual o todas las tallas con stock controlado en 0. */
  soldOut: boolean;
  /** Fecha de alta; alimenta el `lastmod` del sitemap. */
  createdAt: string;
  /** SEO editable desde el admin. Vacío = se genera del nombre/descripción. */
  seoTitle: string;
  seoDescription: string;
  /** 1 en el admin = la pieza no se indexa ni entra al sitemap/feed. */
  seoNoindex: boolean;
  /** Atributos del feed de Merchant Center. `brand` vacío = ENIGMA. */
  brand: string;
  gtin: string;
  mpn: string;
  color: string;
  material: string;
  gender: string;
  ageGroup: string;
  googleCategory: string;
};

/** Las columnas de SEO/feed son nuevas: en una base sin migrar llegan como
 *  undefined y aquí se normalizan a cadena vacía. */
function str(value: unknown): string {
  return value == null ? '' : String(value);
}

function computeSoldOut(badge: string | null, sizes: ProductSize[]): boolean {
  if (badge === 'AGOTADO') return true;
  const tracked = sizes.filter((s) => s.stock !== null);
  return tracked.length > 0 && tracked.length === sizes.length && tracked.every((s) => s.stock === 0);
}

/** Catálogo activo completo, en el orden definido en el admin. */
export async function getProducts(): Promise<Product[]> {
  return cached('products', async () => {
    let products: ResultSet, images: ResultSet, sizes: ResultSet;
    try {
      [products, images, sizes] = await Promise.all([
        db().execute('SELECT * FROM products WHERE active = 1 ORDER BY sort_order, id'),
        db().execute(
          'SELECT product_id, url, type FROM product_images ORDER BY product_id, position',
        ),
        db().execute('SELECT product_id, size, stock FROM product_sizes ORDER BY product_id, position'),
      ]);
    } catch {
      // DB no disponible: la landing sigue funcionando sin catálogo.
      return [];
    }

    const mediaBy = new Map<number, ProductMedia[]>();
    for (const r of images.rows) {
      const pid = Number(r.product_id);
      if (!mediaBy.has(pid)) mediaBy.set(pid, []);
      mediaBy.get(pid)!.push({
        url: String(r.url),
        type: String(r.type ?? 'image') === 'video' ? 'video' : 'image',
      });
    }
    const sizesBy = new Map<number, ProductSize[]>();
    for (const r of sizes.rows) {
      const pid = Number(r.product_id);
      if (!sizesBy.has(pid)) sizesBy.set(pid, []);
      sizesBy.get(pid)!.push({
        size: String(r.size),
        stock: r.stock === null ? null : Number(r.stock),
      });
    }

    return products.rows.map((p) => {
      const id = Number(p.id);
      const badge = p.badge ? String(p.badge) : null;
      const productSizes = sizesBy.get(id) ?? [];
      const media = mediaBy.get(id) ?? [];
      return {
        id,
        slug: String(p.slug),
        title: String(p.name),
        price: Number(p.price),
        description: String(p.description ?? ''),
        sizes: productSizes,
        media,
        images: media.filter((m) => m.type === 'image').map((m) => m.url),
        category: String(p.category) as Category,
        badge,
        soldOut: computeSoldOut(badge, productSizes),
        createdAt: String(p.created_at ?? ''),
        seoTitle: str(p.seo_title),
        seoDescription: str(p.seo_description),
        seoNoindex: Number(p.seo_noindex ?? 0) === 1,
        brand: str(p.brand),
        gtin: str(p.gtin),
        mpn: str(p.mpn),
        color: str(p.color),
        material: str(p.material),
        gender: str(p.gender),
        ageGroup: str(p.age_group),
        googleCategory: str(p.google_category),
      } satisfies Product;
    });
  });
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find((p) => p.slug === slug);
}

/** Novedades del home: primero las piezas NUEVO, se completa con el resto. */
export function pickNew(products: Product[], count = 4): Product[] {
  const fresh = products.filter((p) => p.badge === 'NUEVO');
  const rest = products.filter((p) => p.badge !== 'NUEVO');
  return [...fresh, ...rest].slice(0, count);
}

/** Relacionados: misma categoría primero, sin el producto actual. */
export function pickRelated(products: Product[], current: Product, count = 4): Product[] {
  const same = products.filter((p) => p.slug !== current.slug && p.category === current.category);
  const others = products.filter(
    (p) => p.slug !== current.slug && p.category !== current.category,
  );
  return [...same, ...others].slice(0, count);
}
