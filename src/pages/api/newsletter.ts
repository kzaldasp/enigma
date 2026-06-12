import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { rateLimit, clientIp } from '../../lib/ratelimit';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  if (!rateLimit(`newsletter:${clientIp(request)}`, 5, 10 * 60 * 1000)) {
    return json({ error: 'Demasiados intentos' }, 429);
  }

  let email = '';
  try {
    const body = await request.json();
    email = String(body.email ?? '')
      .trim()
      .toLowerCase();
  } catch {
    return json({ error: 'Cuerpo inválido' }, 400);
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
    return json({ error: 'Correo inválido' }, 400);
  }

  await db().execute({
    sql: 'INSERT INTO newsletter_subscribers (email) VALUES (?) ON CONFLICT(email) DO NOTHING',
    args: [email],
  });
  return json({ ok: true });
};
