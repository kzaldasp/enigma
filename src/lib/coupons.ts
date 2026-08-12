import { db } from './db';
import type { CouponInfo } from './totals';

/**
 * Un cupón tal como vive en la base, con sus límites de uso.
 * `maxUses` / `maxPerCustomer` en 0 significan "sin límite".
 */
export type CouponRecord = CouponInfo & {
  maxUses: number;
  maxPerCustomer: number;
  usedCount: number;
};

/** Estados de un pedido que NO consumen el cupón (se devolvió el uso). */
const RELEASED = "('cancelado', 'rechazado')";

/** Cupón activo por código (siempre se consulta fresco, sin caché). */
export async function findCoupon(code: string): Promise<CouponRecord | null> {
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
    maxUses: Number(c.max_uses ?? 0),
    maxPerCustomer: Number(c.max_per_customer ?? 0),
    usedCount: Number(c.used_count ?? 0),
  };
}

/** El código ya llegó a su límite total de usos. */
export function isExhausted(c: CouponRecord): boolean {
  return c.maxUses > 0 && c.usedCount >= c.maxUses;
}

/**
 * Cuántas veces usó ya este cupón una cédula. Los pedidos cancelados o
 * rechazados no cuentan: el cliente vuelve a tener su oportunidad.
 */
export async function customerUses(code: string, cedula: string): Promise<number> {
  const res = await db().execute({
    sql: `SELECT COUNT(*) AS n FROM orders
          WHERE coupon_code = ? AND cedula = ? AND status NOT IN ${RELEASED}`,
    args: [code, cedula],
  });
  return Number(res.rows[0]?.n ?? 0);
}

/**
 * Reserva un uso del cupón. El límite se comprueba dentro del mismo UPDATE,
 * así dos pedidos simultáneos no pueden pasarse del tope: el segundo no
 * afecta ninguna fila. Devuelve false cuando ya no quedan usos.
 */
export async function reserveCouponUse(code: string): Promise<boolean> {
  const res = await db().execute({
    sql: `UPDATE coupons SET used_count = used_count + 1
          WHERE code = ? AND active = 1 AND (max_uses = 0 OR used_count < max_uses)`,
    args: [code],
  });
  return res.rowsAffected === 1;
}

/** Devuelve un uso reservado (el pedido no llegó a crearse). */
export async function releaseCouponUse(code: string): Promise<void> {
  await db().execute({
    sql: 'UPDATE coupons SET used_count = MAX(used_count - 1, 0) WHERE code = ?',
    args: [code],
  });
}
