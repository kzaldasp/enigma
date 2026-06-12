import { db, cached } from './db';

export type GalleryItem = {
  url: string;
  type: 'image' | 'video';
  caption: string | null;
  link: string | null;
};

/** Piezas del Archivo (museo), en el orden definido en el admin. */
export async function getGallery(): Promise<GalleryItem[]> {
  return cached('gallery', async () => {
    const { rows } = await db().execute(
      'SELECT url, type, caption, link FROM gallery_items ORDER BY position, id',
    );
    return rows.map((r) => ({
      url: String(r.url),
      type: String(r.type) === 'video' ? ('video' as const) : ('image' as const),
      caption: r.caption ? String(r.caption) : null,
      link: r.link ? String(r.link) : null,
    }));
  });
}
