import { db, cached } from './db';
import { SITE_NAME } from './site';

/**
 * SEO editable desde el admin (tabla seo_pages) + utilidades de construcción
 * de metadatos. Toda página de la tienda pasa por aquí: el admin puede
 * sobreescribir título, descripción, H1, párrafo indexable e imagen social,
 * y si un campo queda vacío se usa el default que pasa la página.
 */
export type PageSeo = {
  title: string;
  description: string;
  heading: string;
  intro: string;
  ogImage: string;
  noindex: boolean;
};

const EMPTY: PageSeo = {
  title: '',
  description: '',
  heading: '',
  intro: '',
  ogImage: '',
  noindex: false,
};

/** Todas las filas de seo_pages, indexadas por ruta. */
async function getSeoPages(): Promise<Record<string, PageSeo>> {
  return cached('seo_pages', async () => {
    const map: Record<string, PageSeo> = {};
    try {
      const { rows } = await db().execute('SELECT * FROM seo_pages');
      for (const r of rows) {
        map[String(r.path)] = {
          title: String(r.title ?? ''),
          description: String(r.description ?? ''),
          heading: String(r.heading ?? ''),
          intro: String(r.intro ?? ''),
          ogImage: String(r.og_image ?? ''),
          noindex: Number(r.noindex ?? 0) === 1,
        };
      }
    } catch {
      // Base sin migrar o no disponible: la tienda usa sus defaults.
    }
    return map;
  });
}

/** SEO de una ruta concreta; nunca falla, devuelve campos vacíos si no hay fila. */
export async function getPageSeo(path: string): Promise<PageSeo> {
  const pages = await getSeoPages();
  return pages[normalizePath(path)] ?? EMPTY;
}

/** Rutas marcadas como noindex en el admin (para excluirlas del sitemap). */
export async function getNoindexPaths(): Promise<Set<string>> {
  const pages = await getSeoPages();
  return new Set(Object.entries(pages).filter(([, v]) => v.noindex).map(([k]) => k));
}

/** '/catalogo/' → '/catalogo'; '' → '/'. Las claves de seo_pages van sin barra final. */
export function normalizePath(path: string): string {
  const clean = path.replace(/\/+$/, '');
  return clean === '' ? '/' : clean;
}

/** El primero de los valores con contenido real. */
export function firstFilled(...values: (string | null | undefined)[]): string {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return '';
}

/**
 * Recorta en el último espacio antes del límite para no cortar palabras.
 * Google muestra ~60 caracteres de título y ~155 de descripción.
 */
export function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Añade la marca al título salvo que el texto ya la mencione. */
export function withBrand(title: string): string {
  const t = title.trim();
  if (!t) return `${SITE_NAME}®`;
  return /enigma/i.test(t) ? t : `${t} | ${SITE_NAME}®`;
}

/**
 * Resuelve el SEO final de una página: lo del admin gana, si no el default
 * de la página. `TITLE_MAX`/`DESC_MAX` evitan que un texto largo se corte
 * en el resultado de búsqueda.
 */
export const TITLE_MAX = 60;
export const DESC_MAX = 155;

export async function resolvePageSeo(
  path: string,
  defaults: { title: string; description: string; heading?: string; intro?: string },
): Promise<PageSeo & { title: string; description: string }> {
  const admin = await getPageSeo(path);
  return {
    ...admin,
    title: clamp(withBrand(firstFilled(admin.title, defaults.title)), TITLE_MAX),
    description: clamp(firstFilled(admin.description, defaults.description), DESC_MAX),
    heading: firstFilled(admin.heading, defaults.heading),
    intro: firstFilled(admin.intro, defaults.intro),
  };
}
