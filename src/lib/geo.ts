/**
 * Geolocalización y atribución a partir de la petición.
 *
 * Vercel añade cabeceras de geo en cada request (x-vercel-ip-*), así que la
 * provincia sale sin depender de ningún servicio externo ni de cookies.
 * En local esas cabeceras no existen y todo queda vacío.
 */

/** ISO 3166-2:EC → nombre de provincia. */
const EC_PROVINCES: Record<string, string> = {
  A: 'Azuay',
  B: 'Bolívar',
  F: 'Cañar',
  C: 'Carchi',
  H: 'Chimborazo',
  X: 'Cotopaxi',
  O: 'El Oro',
  E: 'Esmeraldas',
  W: 'Galápagos',
  G: 'Guayas',
  I: 'Imbabura',
  L: 'Loja',
  R: 'Los Ríos',
  M: 'Manabí',
  S: 'Morona Santiago',
  N: 'Napo',
  D: 'Orellana',
  Y: 'Pastaza',
  P: 'Pichincha',
  SE: 'Santa Elena',
  SD: 'Santo Domingo de los Tsáchilas',
  U: 'Sucumbíos',
  T: 'Tungurahua',
  Z: 'Zamora Chinchipe',
};

export type Geo = { country: string; province: string; city: string };

export function readGeo(request: Request): Geo {
  const h = request.headers;
  const country = (h.get('x-vercel-ip-country') ?? '').toUpperCase();
  const rawRegion = (h.get('x-vercel-ip-country-region') ?? '').toUpperCase();
  // La cabecera puede venir como "P" o como "EC-P".
  const region = rawRegion.includes('-') ? rawRegion.split('-')[1] : rawRegion;

  let city = '';
  try {
    city = decodeURIComponent(h.get('x-vercel-ip-city') ?? '');
  } catch {
    city = h.get('x-vercel-ip-city') ?? '';
  }

  const province =
    country === 'EC' ? (EC_PROVINCES[region] ?? '') : region ? `${country}-${region}` : '';

  return { country, province, city: city.slice(0, 60) };
}

/** móvil / escritorio a partir del user-agent. */
export function readDevice(request: Request): string {
  const ua = request.headers.get('user-agent') ?? '';
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'movil' : 'escritorio';
}

/** Rastreadores y bots que no deben contar como visitas. */
export function isBot(request: Request): boolean {
  const ua = request.headers.get('user-agent') ?? '';
  if (!ua) return true;
  return /bot|crawler|spider|crawling|preview|monitor|curl|wget|headless|lighthouse|pingdom|uptime/i.test(
    ua,
  );
}

export type Attribution = { source: string; medium: string; campaign: string };

/**
 * De dónde viene la visita. Prioriza los parámetros UTM (campañas pagadas)
 * y si no hay, deduce la fuente del referente.
 */
export function readAttribution(url: URL, referrer: string): Attribution {
  const p = url.searchParams;
  const utmSource = (p.get('utm_source') ?? '').trim().toLowerCase();

  if (utmSource) {
    return {
      source: utmSource.slice(0, 40),
      medium: (p.get('utm_medium') ?? 'cpc').trim().toLowerCase().slice(0, 40),
      campaign: (p.get('utm_campaign') ?? '').trim().toLowerCase().slice(0, 60),
    };
  }

  if (!referrer) return { source: 'directo', medium: 'directo', campaign: '' };

  let host = '';
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return { source: 'directo', medium: 'directo', campaign: '' };
  }

  // Tráfico interno del propio sitio: no es una fuente nueva.
  if (host.endsWith('enigma593.com')) return { source: 'directo', medium: 'directo', campaign: '' };

  const KNOWN: [RegExp, string, string][] = [
    [/instagram|l\.instagram/, 'instagram', 'social'],
    [/facebook|fb\.|l\.facebook/, 'facebook', 'social'],
    [/tiktok/, 'tiktok', 'social'],
    [/whatsapp|wa\.me/, 'whatsapp', 'social'],
    [/google/, 'google', 'organico'],
    [/bing|duckduckgo|yahoo/, 'buscadores', 'organico'],
    [/t\.co|twitter|x\.com/, 'twitter', 'social'],
    [/youtube/, 'youtube', 'social'],
  ];
  for (const [re, source, medium] of KNOWN) {
    if (re.test(host)) return { source, medium, campaign: '' };
  }

  return { source: host.slice(0, 40), medium: 'referido', campaign: '' };
}

/** Fecha de hoy en Ecuador (UTC-5), YYYY-MM-DD. */
export function todayEC(): string {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
