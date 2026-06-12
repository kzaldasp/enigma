import { db } from './db';
import type { CouponInfo } from './totals';

/** Cupón activo por código (siempre se consulta fresco, sin caché). */
export async function findCoupon(code: string): Promise<CouponInfo | null> {
  if (!code) return null;
  const res = await db().execute({
    sql: 'SELECT * FROM coupons WHERE code = ? AND active = 1',
    args: [code.trim().toUpperCase()],
  });
  const c = res.rows[0];
  if (!c) return null;
  return {
    code: String(c.code),
    type: String(c.type) === 'fixed' ? 'fixed' : 'percent',
    value: Number(c.value),
    minTotal: Number(c.min_total),
  };
}
