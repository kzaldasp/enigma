/**
 * Cálculo de totales del pedido — función pura, compartida entre el
 * checkout (cliente) y el API (servidor) y cubierta por tests.
 */
export type CouponInfo = {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minTotal: number;
};

export type OrderTotals = {
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeTotals(opts: {
  subtotal: number;
  shippingCost: number;
  /** Subtotal desde el cual el envío es gratis (0 o NaN = nunca). */
  freeShippingFrom: number;
  coupon: CouponInfo | null;
}): OrderTotals {
  const subtotal = round2(Math.max(0, opts.subtotal));

  const freeFrom = opts.freeShippingFrom;
  const shippingApplies = !(Number.isFinite(freeFrom) && freeFrom > 0 && subtotal >= freeFrom);
  const shipping = subtotal === 0 ? 0 : shippingApplies ? round2(Math.max(0, opts.shippingCost)) : 0;

  let discount = 0;
  const c = opts.coupon;
  if (c && subtotal >= c.minTotal && c.value > 0) {
    discount =
      c.type === 'percent'
        ? round2((subtotal * Math.min(c.value, 100)) / 100)
        : round2(Math.min(c.value, subtotal));
  }

  return {
    subtotal,
    shipping,
    discount,
    total: round2(Math.max(0, subtotal + shipping - discount)),
  };
}
