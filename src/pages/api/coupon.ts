import type { APIRoute } from 'astro';
import { findCoupon, isExhausted } from '../../lib/coupons';
import { rateLimit, clientIp } from '../../lib/ratelimit';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** Valida un cupón para mostrar el descuento en el checkout. */
export const GET: APIRoute = async ({ request, url }) => {
  if (!rateLimit(`coupon:${clientIp(request)}`, 20, 10 * 60 * 1000)) {
    return json({ error: 'Demasiados intentos' }, 429);
  }
  const coupon = await findCoupon(url.searchParams.get('code') ?? '');
  if (!coupon) return json({ error: 'Cupón no válido' }, 404);
  // El límite por cliente no se puede comprobar aquí (todavía no hay cédula);
  // se verifica al crear el pedido, en /api/orders.
  if (isExhausted(coupon)) return json({ error: 'Este cupón ya no está disponible' }, 409);
  return json({
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minTotal: coupon.minTotal,
  });
};
