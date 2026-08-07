import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { db, invalidateCache } from '../../lib/db';
import { getSiteContent } from '../../lib/content';
import { computeTotals } from '../../lib/totals';
import { findCoupon } from '../../lib/coupons';
import { sendNewOrderAdminEmail, sendOrderEmail } from '../../lib/notify';
import { rateLimit, clientIp } from '../../lib/ratelimit';
import { PROVINCES, siteUrl, adminUrl } from '../../lib/site';
import { readGeo } from '../../lib/geo';

export const prerender = false;

type IncomingItem = { slug: string; size: string | null; qty: number };

/** Código público secuencial a partir del id autoincremental: EN-000001. */
function orderCode(id: number): string {
  return `EN-${String(id).padStart(6, '0')}`;
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
    attribution?: { source?: string; medium?: string; campaign?: string } | null;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  const customer = body.customer ?? {};
  const name = String(customer.name ?? '').trim();
  const phone = String(customer.phone ?? '').trim();
  const email = String(customer.email ?? '').trim();
  const cedula = String(customer.cedula ?? '').trim();
  const province = String(customer.province ?? '').trim();
  const address = String(customer.address ?? '').trim();
  const city = String(customer.city ?? '').trim();
  const addressReference = String(customer.addressReference ?? '').trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!name || !phone) return json({ error: 'Nombre y teléfono son obligatorios' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Ingresa un correo válido' }, 400);
  }
  if (!/^\d{10}$/.test(cedula)) return json({ error: 'La cédula debe tener 10 dígitos' }, 400);
  if (!PROVINCES.includes(province as (typeof PROVINCES)[number])) {
    return json({ error: 'Selecciona una provincia válida' }, 400);
  }
  if (!address) return json({ error: 'La dirección exacta es obligatoria' }, 400);
  if (!city) return json({ error: 'La ciudad es obligatoria' }, 400);
  if (!addressReference) return json({ error: 'La referencia de ubicación es obligatoria' }, 400);
  if (items.length === 0) return json({ error: 'La bolsa está vacía' }, 400);
  if (items.length > 30) return json({ error: 'Demasiados items' }, 400);

  // Valida contra la DB (precio y stock frescos, nunca los del cliente).
  // Dos consultas en total (productos + tallas), no dos por item.
  const slugs = [...new Set(items.map((it) => String(it.slug)))];
  const pres = await db().execute({
    sql: `SELECT id, slug, name, price, badge FROM products
          WHERE slug IN (${slugs.map(() => '?').join(',')}) AND active = 1`,
    args: slugs,
  });
  const bySlug = new Map(pres.rows.map((p) => [String(p.slug), p]));

  const productIds = pres.rows.map((p) => Number(p.id));
  const sizesByProduct = new Map<number, Map<string, number | null>>();
  if (productIds.length > 0) {
    const sres = await db().execute({
      sql: `SELECT product_id, size, stock FROM product_sizes
            WHERE product_id IN (${productIds.map(() => '?').join(',')})`,
      args: productIds,
    });
    for (const row of sres.rows) {
      const pid = Number(row.product_id);
      if (!sizesByProduct.has(pid)) sizesByProduct.set(pid, new Map());
      sizesByProduct.get(pid)!.set(String(row.size), row.stock === null ? null : Number(row.stock));
    }
  }

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
    const product = bySlug.get(String(it.slug));
    if (!product) return json({ error: `Producto no disponible: ${it.slug}` }, 400);
    if (String(product.badge ?? '') === 'AGOTADO') {
      return json({ error: `${String(product.name)} está agotado` }, 400);
    }

    const size = it.size ? String(it.size) : null;
    if (size) {
      const sizes = sizesByProduct.get(Number(product.id));
      if (!sizes || !sizes.has(size)) {
        return json({ error: `Talla ${size} no existe para ${String(product.name)}` }, 400);
      }
      const stock = sizes.get(size)!;
      if (stock !== null && stock < qty) {
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
  // Código definitivo (EN-000001) se arma después del insert, a partir del id.
  // Se usa un placeholder único mientras tanto para no chocar con el UNIQUE NOT NULL.
  const tempCode = `TMP-${randomUUID()}`;

  // Atribución de marketing: de dónde venía el cliente la primera vez.
  const attr = body.attribution ?? null;
  const clean = (v: unknown, max = 60) => String(v ?? '').trim().toLowerCase().slice(0, max) || null;
  const geo = readGeo(request);

  const orderRes = await db().batch(
    [
      {
        sql: `INSERT INTO orders (code, customer_name, customer_phone, customer_email, cedula, province, address, city, address_reference, notes, total, shipping, coupon_code, discount, source, medium, campaign, province_geo)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          tempCode,
          name,
          phone,
          email,
          cedula,
          province,
          address,
          city,
          addressReference,
          String(customer.notes ?? '').trim() || null,
          totals.total,
          totals.shipping,
          coupon && totals.discount > 0 ? coupon.code : null,
          totals.discount,
          clean(attr?.source, 40),
          clean(attr?.medium, 40),
          clean(attr?.campaign),
          geo.province || null,
        ],
      },
    ],
    'write',
  );
  const orderId = Number(orderRes[0].lastInsertRowid);
  const code = orderCode(orderId);

  await db().batch(
    [
      { sql: `UPDATE orders SET code = ? WHERE id = ?`, args: [code, orderId] },
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

  // Aviso interno: el pedido completo y el botón que lo abre en el admin.
  await sendNewOrderAdminEmail({
    code,
    total: totals.total,
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    discount: totals.discount,
    couponCode: coupon && totals.discount > 0 ? coupon.code : null,
    items: validated.map((it) => ({
      name: `${it.product_name}${it.size ? ` (${it.size})` : ''}`,
      qty: it.quantity,
      amount: it.unit_price * it.quantity,
    })),
    customer: { name, phone, email, cedula },
    delivery: { address, reference: addressReference, city, province },
    notes: String(customer.notes ?? '').trim(),
    adminUrl: adminUrl(`/pedidos/${orderId}`),
    trackUrl: siteUrl(`/pedido/${code}`),
  });

  // Respaldo escrito con datos bancarios y enlace, por si cierra la página.
  // El único WhatsApp automático del flujo sale al subir el comprobante (ver comprobante.ts).
  await sendOrderEmail({
    to: email,
    name,
    code,
    items: validated.map((it) => ({
      name: `${it.product_name}${it.size ? ` (${it.size})` : ''}`,
      qty: it.quantity,
      amount: it.unit_price * it.quantity,
    })),
    subtotal: totals.subtotal,
    total: totals.total,
    shipping: totals.shipping,
    discount: totals.discount,
    address: `${address}, ${city}, ${province} (${addressReference})`,
    bankDetails: site.bankDetails,
    trackUrl: siteUrl(`/pedido/${code}`),
  });

  return json({ code });
};
