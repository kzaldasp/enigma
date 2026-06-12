import { describe, it, expect } from 'vitest';
import { computeTotals } from './totals';

const base = { shippingCost: 5, freeShippingFrom: 0, coupon: null };

describe('computeTotals', () => {
  it('suma subtotal + envío sin cupón', () => {
    expect(computeTotals({ ...base, subtotal: 98 })).toEqual({
      subtotal: 98,
      shipping: 5,
      discount: 0,
      total: 103,
    });
  });

  it('envío gratis desde el umbral', () => {
    const t = computeTotals({ ...base, subtotal: 150, freeShippingFrom: 100 });
    expect(t.shipping).toBe(0);
    expect(t.total).toBe(150);
  });

  it('cobra envío por debajo del umbral', () => {
    const t = computeTotals({ ...base, subtotal: 99.99, freeShippingFrom: 100 });
    expect(t.shipping).toBe(5);
  });

  it('sin envío cuando la bolsa está vacía', () => {
    expect(computeTotals({ ...base, subtotal: 0 }).total).toBe(0);
  });

  it('cupón porcentual sobre el subtotal (no sobre el envío)', () => {
    const t = computeTotals({
      ...base,
      subtotal: 100,
      coupon: { code: 'ENIGMA10', type: 'percent', value: 10, minTotal: 0 },
    });
    expect(t.discount).toBe(10);
    expect(t.total).toBe(95); // 100 + 5 − 10
  });

  it('cupón fijo no descuenta más que el subtotal', () => {
    const t = computeTotals({
      ...base,
      subtotal: 20,
      coupon: { code: 'MENOS50', type: 'fixed', value: 50, minTotal: 0 },
    });
    expect(t.discount).toBe(20);
    expect(t.total).toBe(5); // solo queda el envío
  });

  it('cupón porcentual se limita al 100%', () => {
    const t = computeTotals({
      ...base,
      subtotal: 80,
      coupon: { code: 'ROTO', type: 'percent', value: 150, minTotal: 0 },
    });
    expect(t.discount).toBe(80);
  });

  it('cupón no aplica bajo el mínimo de compra', () => {
    const t = computeTotals({
      ...base,
      subtotal: 40,
      coupon: { code: 'ENIGMA10', type: 'percent', value: 10, minTotal: 50 },
    });
    expect(t.discount).toBe(0);
    expect(t.total).toBe(45);
  });

  it('redondea a 2 decimales', () => {
    const t = computeTotals({
      ...base,
      subtotal: 33.33,
      coupon: { code: 'X', type: 'percent', value: 33, minTotal: 0 },
    });
    expect(t.discount).toBe(11);
    expect(t.total).toBe(27.33);
  });
});
