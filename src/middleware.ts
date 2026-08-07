import { defineMiddleware } from 'astro:middleware';
import { countRedirectHit, findRedirect } from './lib/redirects';

/**
 * Dos cosas, ambas por request y ambas baratas:
 *
 * 1. Redirecciones 301 administradas. Cuando el admin cambia el slug de un
 *    producto queda una fila en `redirects`, y aquí se atiende: la URL vieja
 *    entrega su posicionamiento a la nueva en lugar de devolver un 404. El
 *    coste es el mapa completo en memoria con caché de 60 s (getRedirects),
 *    así que en el caso normal —sin redirección— es una consulta a un Map.
 *
 * 2. Caché de CDN para las rutas públicas. Sin esto cada visita arranca la
 *    función serverless y consulta Turso: el TTFB medido en producción era de
 *    2,1 s en frío y 0,6 s templado, y ese tiempo se descuenta entero del
 *    presupuesto de LCP antes de pintar un pixel.
 *
 * Si no hay redirección ni ruta cacheable, la petición sigue su curso intacta.
 */

/**
 * Rutas que nunca tienen redirección administrada y no deben pagar ni la
 * lectura del mapa: la API, los assets del build (/_astro, /_image), y
 * cualquier ruta con extensión (favicon.svg, robots.txt, sitemap.xml,
 * /uploads/*.jpg, /products/*.svg).
 */
const SKIP = /^\/(?:api|_)|\.[a-z0-9]+$/i;

/**
 * Rutas de contenido: lo mismo para todos los visitantes, así que el CDN puede
 * servirlas. `/` entra por el caso aparte de abajo.
 */
const CACHEABLE = /^\/(?:catalogo|producto|marca|archivo|legal|lookbook)(?:\/|$)/;

/**
 * Rutas que NUNCA se cachean: llevan datos del visitante (bolsa, pedido) o
 * stock en vivo. Un HIT del CDN aquí sería una fuga de datos de un cliente a
 * otro, no una optimización.
 */
const PRIVATE = /^\/(?:carrito|checkout|pedido|api)(?:\/|$)/;

/**
 * 60 s de CDN + 300 s sirviendo en obsoleto mientras se revalida.
 *
 * No añade obsolescencia nueva al sitio: src/lib/db.ts ya cachea las consultas
 * 60 s en memoria por instancia, así que una página ya puede mostrar datos con
 * hasta un minuto de retraso. Bajarlo o quitarlo no hace el catálogo más
 * fresco, solo devuelve el TTFB de 2 s. No "arreglar" sin cambiar antes el
 * caché de la base.
 */
const CDN_CACHE = 'public, s-maxage=60, stale-while-revalidate=300';

function isCacheable(pathname: string): boolean {
  if (PRIVATE.test(pathname)) return false;
  return pathname === '/' || CACHEABLE.test(pathname);
}

/** La página manda: si ya fijó su propia política, no se pisa. */
function applyCdnCache(response: Response, pathname: string): void {
  if (!isCacheable(pathname)) return;
  if (response.headers.has('cache-control')) return;
  response.headers.set('Cache-Control', CDN_CACHE);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const method = context.request.method;
  // Solo lecturas: un 301 sobre un POST convertiría el envío en un GET y
  // perdería el cuerpo (formularios de pedido, subida de comprobantes). Y una
  // respuesta a un POST no se cachea nunca.
  if (method !== 'GET' && method !== 'HEAD') return next();

  const { pathname } = context.url;
  if (SKIP.test(pathname)) return next();

  const to = await findRedirect(pathname);
  if (to) {
    // Se espera el contador: en una función serverless el trabajo pendiente
    // después de responder se corta, y es un solo UPDATE.
    await countRedirectHit(pathname);
    const redirect = context.redirect(to, 301);
    // El 301 también se cachea, con el mismo s-maxage corto: el admin puede
    // cambiar el destino de una fila y un `max-age` largo lo dejaría clavado
    // en los navegadores, donde ya no se puede purgar.
    redirect.headers.set('Cache-Control', CDN_CACHE);
    return redirect;
  }

  const response = await next();
  // Solo las respuestas buenas: un 404 o un 500 cacheados 60 s multiplican el
  // problema en vez de resolverlo.
  if (response.status === 200) applyCdnCache(response, pathname);
  return response;
});
