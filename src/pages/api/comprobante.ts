import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { uploadReceipt } from '../../lib/upload';

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
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
    sql: 'SELECT id, status FROM orders WHERE code = ?',
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
    await db().execute({
      sql: `UPDATE orders SET receipt_url = ?, status = 'comprobante_subido' WHERE id = ?`,
      args: [url, Number(order.id)],
    });
    return json({ ok: true });
  } catch {
    return json({ error: 'No pudimos guardar el comprobante, intenta de nuevo' }, 500);
  }
};
