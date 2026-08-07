import { db, cached } from './db';

/**
 * Redirecciones 301 administradas (tabla redirects). Se llenan solas cuando el
 * admin cambia el slug de un producto, para que la URL vieja siga entregando
 * el enlace y su posicionamiento a la nueva en lugar de devolver un 404.
 */
export async function getRedirects(): Promise<Map<string, string>> {
  return cached('redirects', async () => {
    const map = new Map<string, string>();
    try {
      const { rows } = await db().execute('SELECT from_path, to_path FROM redirects');
      for (const r of rows) map.set(normalize(String(r.from_path)), String(r.to_path));
    } catch {
      // Base sin migrar: sin redirecciones, el 404 normal.
    }
    return map;
  });
}

/** Destino de una ruta, o null si no hay redirección para ella. */
export async function findRedirect(path: string): Promise<string | null> {
  const map = await getRedirects();
  return map.get(normalize(path)) ?? null;
}

/** Contador de uso, para poder limpiar las que ya nadie visita. Best-effort. */
export async function countRedirectHit(fromPath: string): Promise<void> {
  try {
    await db().execute({
      sql: 'UPDATE redirects SET hits = hits + 1 WHERE from_path = ?',
      args: [normalize(fromPath)],
    });
  } catch {
    // No pasa nada si falla: es solo estadística.
  }
}

function normalize(path: string): string {
  const clean = path.trim().replace(/\/+$/, '');
  return clean === '' ? '/' : clean.toLowerCase();
}
