import { db, cached } from './db';

export type CategoryInfo = {
  slug: string;
  label: string;
  /** Imagen subida desde el admin; null = usar fallback local/producto. */
  imageUrl: string | null;
};

/** Categorías editables desde el admin, en su orden definido. */
export async function getCategories(): Promise<CategoryInfo[]> {
  return cached('categories', async () => {
    const { rows } = await db().execute(
      'SELECT slug, label, image_url FROM categories ORDER BY position, id',
    );
    return rows.map((r) => ({
      slug: String(r.slug),
      label: String(r.label),
      imageUrl: r.image_url ? String(r.image_url) : null,
    }));
  });
}

export async function categoryLabel(slug: string): Promise<string> {
  const cats = await getCategories();
  return cats.find((c) => c.slug === slug)?.label ?? slug.toUpperCase();
}
