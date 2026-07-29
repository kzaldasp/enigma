import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { rateLimit, clientIp } from '../../lib/ratelimit';
import { readGeo, readDevice, readAttribution, isBot, todayEC } from '../../lib/geo';

export const prerender = false;

/**
 * Analítica propia: recibe el beacon de cada página y suma contadores.
 *
 * Sin cookies ni datos personales — no se guarda IP ni identificador alguno,
 * solo agregados por día/página/provincia/fuente/dispositivo. Por eso no
 * requiere aviso de consentimiento.
 *
 * La provincia sale de las cabeceras de geo que Vercel añade a esta misma
 * petición, así que es la del visitante real.
 */
export const POST: APIRoute = async ({ request }) => {
  // Respuesta mínima: al cliente no le importa el resultado.
  const ok = new Response(null, { status: 204 });

  if (isBot(request)) return ok;
  if (!rateLimit(`hit:${clientIp(request)}`, 120, 60 * 1000)) return ok;

  let body: { path?: string; ref?: string; s?: boolean; q?: string };
  try {
    body = await request.json();
  } catch {
    return ok;
  }

  // La ruta se normaliza: sin query, sin barra final, acotada.
  let path = String(body.path ?? '/').split('?')[0].split('#')[0];
  if (path.length > 1) path = path.replace(/\/+$/, '');
  path = path.slice(0, 120) || '/';

  const geo = readGeo(request);
  const device = readDevice(request);

  // `q` es el query string original de la página (trae los utm_*).
  const fakeUrl = new URL(`https://enigma593.com${path}${body.q ? `?${body.q}` : ''}`);
  const attr = readAttribution(fakeUrl, String(body.ref ?? ''));

  const isSession = body.s === true ? 1 : 0;

  try {
    await db().execute({
      sql: `INSERT INTO traffic
              (date, path, country, province, city, source, medium, campaign, device, views, sessions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT (date, path, country, province, city, source, medium, campaign, device)
            DO UPDATE SET views = views + 1, sessions = sessions + excluded.sessions`,
      args: [
        todayEC(),
        path,
        geo.country,
        geo.province,
        geo.city,
        attr.source,
        attr.medium,
        attr.campaign,
        device,
        isSession,
      ],
    });
  } catch {
    // La analítica nunca debe afectar la navegación.
  }

  return ok;
};
