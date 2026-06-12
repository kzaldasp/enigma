import type { APIRoute } from 'astro';
import { findCoupon } from '../../lib/coupons';
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
  return json({
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minTotal: coupon.minTotal,
  });
};
