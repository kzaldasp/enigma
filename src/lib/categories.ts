import { db, cached } from './db';

export type CategoryInfo = {
  slug: string;
  label: string;
  /** Imagen subida desde el admin; null = usar fallback local/producto. */
  imageUrl: string | null;
  /** SEO de /catalogo/<slug>. Vacío = default calculado del label. */
  seoTitle: string;
  seoDescription: string;
  /** Párrafo indexable bajo el H1 de la categoría. */
  seoIntro: string;
  googleCategory: string;
};

/** Categorías editables desde el admin, en su orden definido. */
export async function getCategories(): Promise<CategoryInfo[]> {
  return cached('categories', async () => {
    const { rows } = await db().execute('SELECT * FROM categories ORDER BY position, id');
    return rows.map((r) => ({
      slug: String(r.slug),
      label: String(r.label),
      imageUrl: r.image_url ? String(r.image_url) : null,
      seoTitle: r.seo_title == null ? '' : String(r.seo_title),
      seoDescription: r.seo_description == null ? '' : String(r.seo_description),
      seoIntro: r.seo_intro == null ? '' : String(r.seo_intro),
      googleCategory: r.google_category == null ? '' : String(r.google_category),
    }));
  });
}

export async function categoryLabel(slug: string): Promise<string> {
  const cats = await getCategories();
  return cats.find((c) => c.slug === slug)?.label ?? slug.toUpperCase();
}

export async function getCategory(slug: string): Promise<CategoryInfo | undefined> {
  const cats = await getCategories();
  return cats.find((c) => c.slug === slug);
}
