import { db, cached } from './db';
import type { Category } from './site';

export type ProductSize = { size: string; stock: number | null };

export type Product = {
  id: number;
  slug: string;
  title: string;
  price: number;
  description: string;
  sizes: ProductSize[];
  /** URLs absolutas (Cloudinary) o relativas a public/ (seed inicial). */
  images: string[];
  category: Category;
  /** Texto libre desde el admin; 'AGOTADO' bloquea compra, 'NUEVO' destaca. */
  badge: string | null;
  /** AGOTADO manual o todas las tallas con stock controlado en 0. */
  soldOut: boolean;
};

function computeSoldOut(badge: string | null, sizes: ProductSize[]): boolean {
  if (badge === 'AGOTADO') return true;
  const tracked = sizes.filter((s) => s.stock !== null);
  return tracked.length > 0 && tracked.length === sizes.length && tracked.every((s) => s.stock === 0);
}

/** Catálogo activo completo, en el orden definido en el admin. */
export async function getProducts(): Promise<Product[]> {
  return cached('products', async () => {
    const [products, images, sizes] = await Promise.all([
      db().execute('SELECT * FROM products WHERE active = 1 ORDER BY sort_order, id'),
      db().execute('SELECT product_id, url FROM product_images ORDER BY product_id, position'),
      db().execute('SELECT product_id, size, stock FROM product_sizes ORDER BY product_id, position'),
    ]);

    const imagesBy = new Map<number, string[]>();
    for (const r of images.rows) {
      const pid = Number(r.product_id);
      if (!imagesBy.has(pid)) imagesBy.set(pid, []);
      imagesBy.get(pid)!.push(String(r.url));
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
      return {
        id,
        slug: String(p.slug),
        title: String(p.name),
        price: Number(p.price),
        description: String(p.description ?? ''),
        sizes: productSizes,
        images: imagesBy.get(id) ?? [],
        category: String(p.category) as Category,
        badge,
        soldOut: computeSoldOut(badge, productSizes),
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
