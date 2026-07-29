import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { uploadReceipt } from '../../lib/upload';
import { notifyOwner } from '../../lib/notify';
import { sendWhatsApp } from '../../lib/whatsapp';
import { rateLimit, clientIp } from '../../lib/ratelimit';

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  if (!rateLimit(`comprobante:${clientIp(request)}`, 10, 10 * 60 * 1000)) {
    return json({ error: 'Demasiados intentos — espera unos minutos' }, 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Formulario inválido' }, 400);
  }

  const code = String(form.get('code') ?? '').trim();
  const file = form.get('file');

  if (!code) return json({ error: 'Falta el código del pedido' }, 400);
  if (!(file instanceof File) || file.size === 0) {
    return json({ error: 'Adjunta una imagen del comprobante' }, 400);
  }
  if (file.size > MAX_BYTES) return json({ error: 'Máximo 8 MB' }, 400);
  if (!file.type.startsWith('image/')) return json({ error: 'Solo se permiten imágenes' }, 400);

  const res = await db().execute({
    sql: `SELECT id, status, customer_name, customer_phone, address, city, total
          FROM orders WHERE code = ?`,
    args: [code],
  });
  const order = res.rows[0];
  if (!order) return json({ error: 'Pedido no encontrado' }, 404);

  const status = String(order.status);
  if (status !== 'pendiente' && status !== 'comprobante_subido') {
    return json({ error: 'Este pedido ya fue procesado' }, 400);
  }

  try {
    const url = await uploadReceipt(file);
    await db().batch(
      [
        {
          sql: `UPDATE orders SET receipt_url = ?, status = 'comprobante_subido' WHERE id = ?`,
          args: [url, Number(order.id)],
        },
        {
          sql: `INSERT INTO order_events (order_id, event) VALUES (?, 'comprobante_subido')`,
          args: [Number(order.id)],
        },
      ],
      'write',
    );

    await notifyOwner(`Comprobante subido — pedido ${code}`, [
      `El cliente subió su comprobante de transferencia.`,
      `Pedido: ${code}`,
      `Revísalo y valida el pago en el admin → Pedidos web`,
    ]);

    // Único mensaje automático de todo el flujo: confirma el pedido y que el
    // comprobante ya está en revisión. El resto (aprobado, envío, etc.) son
    // botones manuales de WhatsApp Web en el panel admin.
    const items = await db().execute({
      sql: 'SELECT product_name, size, quantity FROM order_items WHERE order_id = ?',
      args: [Number(order.id)],
    });
    const itemsText = items.rows
      .map((it) => `• ${String(it.product_name)}${it.size ? ` (${String(it.size)})` : ''} ×${Number(it.quantity)}`)
      .join('\n');
    const address = [order.address, order.city].filter(Boolean).join(', ');

    await sendWhatsApp(
      String(order.customer_phone),
      `ENIGMA — Hola ${String(order.customer_name)}, hemos recibido tu pedido ${code}:\n` +
        `${itemsText}\n` +
        `Total: $${Number(order.total).toFixed(2)}\n` +
        (address ? `Entrega: ${address}\n` : '') +
        `\nTu comprobante está en proceso de confirmación de pago. Te avisaremos apenas se valide. ` +
        `Sigue tu pedido aquí: ${new URL(`/pedido/${code}`, request.url).toString()}`,
    );

    return json({ ok: true });
  } catch {
    return json({ error: 'No pudimos guardar el comprobante, intenta de nuevo' }, 500);
  }
};
