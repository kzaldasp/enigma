import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { db, invalidateCache } from '../../lib/db';
import { getSiteContent } from '../../lib/content';
import { computeTotals } from '../../lib/totals';
import { findCoupon } from '../../lib/coupons';
import { notifyOwner } from '../../lib/notify';
import { rateLimit, clientIp } from '../../lib/ratelimit';

export const prerender = false;

type IncomingItem = { slug: string; size: string | null; qty: number };

function orderCode(): string {
  // Sin caracteres ambiguos (0/O, 1/I) para dictarlo por teléfono.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(5);
  let code = '';
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return `ENG-${code}`;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  if (!rateLimit(`orders:${clientIp(request)}`, 8, 10 * 60 * 1000)) {
    return json({ error: 'Demasiados intentos — espera unos minutos' }, 429);
  }

  let body: {
    customer?: Record<string, unknown>;
    items?: IncomingItem[];
    coupon?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const customer = body.customer ?? {};
  const name = String(customer.name ?? '').trim();
  const phone = String(customer.phone ?? '').trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!name || !phone) return json({ error: 'Nombre y teléfono son obligatorios' }, 400);
  if (items.length === 0) return json({ error: 'La bolsa está vacía' }, 400);
  if (items.length > 30) return json({ error: 'Demasiados items' }, 400);

  // Valida contra la DB (precio y stock frescos, nunca los del cliente).
  const validated: {
    product_id: number;
    product_name: string;
    size: string | null;
    quantity: number;
    unit_price: number;
  }[] = [];

  for (const it of items) {
    const qty = Math.floor(Number(it.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) {
      return json({ error: 'Cantidad inválida' }, 400);
    }
    const res = await db().execute({
      sql: 'SELECT id, name, price, badge FROM products WHERE slug = ? AND active = 1',
      args: [String(it.slug)],
    });
    const product = res.rows[0];
    if (!product) return json({ error: `Producto no disponible: ${it.slug}` }, 400);
    if (String(product.badge ?? '') === 'AGOTADO') {
      return json({ error: `${String(product.name)} está agotado` }, 400);
    }

    const size = it.size ? String(it.size) : null;
    if (size) {
      const sres = await db().execute({
        sql: 'SELECT stock FROM product_sizes WHERE product_id = ? AND size = ?',
        args: [Number(product.id), size],
      });
      const row = sres.rows[0];
      if (!row) return json({ error: `Talla ${size} no existe para ${String(product.name)}` }, 400);
      if (row.stock !== null && Number(row.stock) < qty) {
        return json(
          { error: `Stock insuficiente de ${String(product.name)} talla ${size}` },
          400,
        );
      }
    }

    validated.push({
      product_id: Number(product.id),
      product_name: String(product.name),
      size,
      quantity: qty,
      unit_price: Number(product.price),
    });
  }

  const site = await getSiteContent();
  const coupon = await findCoupon(String(body.coupon ?? ''));
  const subtotal = validated.reduce((s, it) => s + it.unit_price * it.quantity, 0);
  const totals = computeTotals({
    subtotal,
    shippingCost: site.shippingCost,
    freeShippingFrom: site.shippingFreeFrom,
    coupon,
  });
  const code = orderCode();

  // Pedido + items + evento en una sola transacción.
  const statements = [
    {
      sql: `INSERT INTO orders (code, customer_name, customer_phone, customer_email, address, city, notes, total, shipping, coupon_code, discount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        code,
        name,
        phone,
        String(customer.email ?? '').trim() || null,
        String(customer.address ?? '').trim() || null,
        String(customer.city ?? '').trim() || null,
        String(customer.notes ?? '').trim() || null,
        totals.total,
        totals.shipping,
        coupon && totals.discount > 0 ? coupon.code : null,
        totals.discount,
      ],
    },
  ];
  const orderRes = await db().batch(statements, 'write');
  const orderId = Number(orderRes[0].lastInsertRowid);

  await db().batch(
    [
      ...validated.map((it) => ({
        sql: `INSERT INTO order_items (order_id, product_id, product_name, size, quantity, unit_price)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [orderId, it.product_id, it.product_name, it.size, it.quantity, it.unit_price],
      })),
      {
        sql: `INSERT INTO order_events (order_id, event) VALUES (?, 'creado')`,
        args: [orderId],
      },
    ],
    'write',
  );

  invalidateCache();

  await notifyOwner(`Nuevo pedido ${code} — $${totals.total.toFixed(2)}`, [
    `Pedido: ${code}`,
    `Cliente: ${name} · ${phone}`,
    `Total: $${totals.total.toFixed(2)} (envío $${totals.shipping.toFixed(2)}${totals.discount ? `, descuento -$${totals.discount.toFixed(2)}` : ''})`,
    '',
    ...validated.map((it) => `· ${it.product_name}${it.size ? ` (${it.size})` : ''} ×${it.quantity}`),
    '',
    `Revísalo en el admin → Pedidos web`,
  ]);

  return json({ code });
};
