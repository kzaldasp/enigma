import { createClient, type Client } from '@libsql/client';

/**
 * Cliente libsql compartido con el admin (Turso en producción,
 * el archivo local de enigma-admin en desarrollo).
 */
let client: Client | null = null;

export function db(): Client {
  if (!client) {
    client = createClient({
      url: import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL ?? 'file:../enigma-admin/local.db',
      authToken:
        import.meta.env.DATABASE_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || undefined,
    });
  }
  return client;
}

/**
 * Caché en memoria con TTL — evita golpear la DB en cada request.
 * 60 s: un cambio en el admin tarda máximo un minuto en verse.
 */
const TTL_MS = 60_000;
const cache = new Map<string, { value: unknown; expires: number }>();

export async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Invalida el caché (tras crear un pedido, para reflejar stock). */
export function invalidateCache(): void {
  cache.clear();
}
