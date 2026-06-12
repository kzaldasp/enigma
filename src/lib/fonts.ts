/**
 * Catálogo curado de tipografías (Google Fonts) seleccionables desde el
 * admin (Contenido → Tipografía). Las predeterminadas (Cormorant Garamond
 * e Inter) se sirven self-hosted vía fontsource; el resto se carga desde
 * Google Fonts solo cuando está seleccionada.
 */
type FontDef = { query: string; serif: boolean };

export const FONT_CATALOG: Record<string, FontDef> = {
  // Serif / display
  'Cormorant Garamond': { query: '', serif: true }, // default — self-hosted
  'Playfair Display': { query: 'Playfair+Display:wght@400;500;600', serif: true },
  'EB Garamond': { query: 'EB+Garamond:wght@400;500;600', serif: true },
  'DM Serif Display': { query: 'DM+Serif+Display', serif: true },
  'Bodoni Moda': { query: 'Bodoni+Moda:wght@400;500;600', serif: true },
  'Marcellus': { query: 'Marcellus', serif: true },
  'Cinzel': { query: 'Cinzel:wght@400;500;600', serif: true },
  // Sans
  'Inter': { query: '', serif: false }, // default — self-hosted
  'Work Sans': { query: 'Work+Sans:wght@400;500;600', serif: false },
  'Manrope': { query: 'Manrope:wght@400;500;600', serif: false },
  'Space Grotesk': { query: 'Space+Grotesk:wght@400;500;600', serif: false },
  'Archivo': { query: 'Archivo:wght@400;500;600', serif: false },
  'Jost': { query: 'Jost:wght@400;500;600', serif: false },
  'Montserrat': { query: 'Montserrat:wght@400;500;600', serif: false },
};

export const DEFAULT_DISPLAY = 'Cormorant Garamond';
export const DEFAULT_BODY = 'Inter';

/**
 * Pila CSS con fallback acorde a la familia. Para fuentes fuera del catálogo
 * (importadas con URL de Google), el fallback lo decide el rol donde se usa.
 */
export function fontStack(name: string, role: 'display' | 'body' = 'display'): string {
  const def = FONT_CATALOG[name];
  const serif = def ? def.serif : role === 'display';
  const fallback = serif
    ? 'Georgia, "Times New Roman", serif'
    : 'system-ui, ui-sans-serif, sans-serif';
  return `"${name}", ${fallback}`;
}

/** Solo URLs css2 de Google Fonts — evita inyectar estilos arbitrarios. */
export function sanitizeFontUrl(url: string): string | null {
  const trimmed = url.trim();
  return /^https:\/\/fonts\.googleapis\.com\/css2\?[\w+&;=:,@%-]+$/.test(trimmed)
    ? trimmed
    : null;
}

/** URL de Google Fonts para las fuentes no-default seleccionadas (o null). */
export function googleFontsHref(names: (string | undefined | null)[]): string | null {
  const queries = [
    ...new Set(
      names
        .filter((n): n is string => Boolean(n))
        .map((n) => FONT_CATALOG[n]?.query)
        .filter((q): q is string => Boolean(q)),
    ),
  ];
  if (queries.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${queries.map((q) => `family=${q}`).join('&')}&display=swap`;
}
