import { describe, it, expect } from 'vitest';
import { isExhausted, type CouponRecord } from './coupons';

const coupon = (over: Partial<CouponRecord> = {}): CouponRecord => ({
  code: 'ENIGMA10',
  type: 'percent',
  value: 10,
  minTotal: 0,
  maxUses: 0,
  maxPerCustomer: 0,
  usedCount: 0,
  ...over,
});

describe('isExhausted', () => {
  it('sin límite nunca se agota', () => {
    expect(isExhausted(coupon({ maxUses: 0, usedCount: 999 }))).toBe(false);
  });

  it('quedan usos por debajo del tope', () => {
    expect(isExhausted(coupon({ maxUses: 10, usedCount: 9 }))).toBe(false);
  });

  it('se agota al llegar al tope', () => {
    expect(isExhausted(coupon({ maxUses: 10, usedCount: 10 }))).toBe(true);
  });

  it('código de un solo uso: se agota tras el primero', () => {
    expect(isExhausted(coupon({ maxUses: 1, usedCount: 0 }))).toBe(false);
    expect(isExhausted(coupon({ maxUses: 1, usedCount: 1 }))).toBe(true);
  });

  it('bajar el tope por debajo de los usos lo deja agotado', () => {
    expect(isExhausted(coupon({ maxUses: 5, usedCount: 12 }))).toBe(true);
  });
});
