import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { db, invalidateCache } from '../../lib/db';

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
  let body: { customer?: Record<string, unknown>; items?: IncomingItem[] };
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

  const total = validated.reduce((s, it) => s + it.unit_price * it.quantity, 0);
  const code = orderCode();

  const orderRes = await db().execute({
    sql: `INSERT INTO orders (code, customer_name, customer_phone, customer_email, address, city, notes, total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      code,
      name,
      phone,
      String(customer.email ?? '').trim() || null,
      String(customer.address ?? '').trim() || null,
      String(customer.city ?? '').trim() || null,
      String(customer.notes ?? '').trim() || null,
      total,
    ],
  });
  const orderId = Number(orderRes.lastInsertRowid);

  for (const it of validated) {
    await db().execute({
      sql: `INSERT INTO order_items (order_id, product_id, product_name, size, quantity, unit_price)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [orderId, it.product_id, it.product_name, it.size, it.quantity, it.unit_price],
    });
  }

  invalidateCache();
  return json({ code });
};
