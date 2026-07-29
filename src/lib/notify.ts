/**
 * Correos transaccionales vía Resend (gratis hasta ~3k correos/mes).
 * Se activa configurando en el entorno:
 *   RESEND_API_KEY   — API key de resend.com
 *   NOTIFY_EMAIL     — buzón interno que recibe los avisos de pedidos
 *   NOTIFY_FROM      — remitente del dominio verificado en Resend
 *                      (ej. ENIGMA <pedidos@send.enigma593.com>)
 *   NOTIFY_REPLY_TO  — opcional: buzón real donde queremos las respuestas
 *                      del cliente (ej. contacto@enigma593.com, en Zoho)
 * Sin esas variables, no hace nada. Nunca rompe el flujo del pedido.
 */
const env = (key: string): string | undefined =>
  (import.meta.env?.[key] as string | undefined) ?? process.env[key];

async function sendEmail(to: string, subject: string, lines: string[]): Promise<void> {
  const apiKey = env('RESEND_API_KEY');
  if (!apiKey || !to) return;
  const from = env('NOTIFY_FROM') ?? 'ENIGMA <onboarding@resend.dev>';
  const replyTo = env('NOTIFY_REPLY_TO');

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: lines.join('\n'),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
  } catch {
    // Best-effort: un fallo de correo no debe tumbar el pedido.
  }
}

/** Aviso al equipo cuando llega un pedido o un comprobante. */
export async function notifyOwner(subject: string, lines: string[]): Promise<void> {
  const to = env('NOTIFY_EMAIL');
  if (!to) return;
  await sendEmail(to, subject, lines);
}

/**
 * Respaldo escrito para el cliente al crear el pedido: le queda el código,
 * los datos bancarios y el enlace para subir el comprobante aunque cierre
 * la página. El WhatsApp automático solo sale al subir el comprobante.
 */
export async function sendOrderEmail(params: {
  to: string;
  name: string;
  code: string;
  items: string[];
  total: number;
  shipping: number;
  discount: number;
  address: string;
  bankDetails: string;
  trackUrl: string;
}): Promise<void> {
  const { to, name, code, items, total, shipping, discount, address, bankDetails, trackUrl } =
    params;

  await sendEmail(to, `ENIGMA — Tu pedido ${code}`, [
    `Hola ${name},`,
    '',
    `Recibimos tu pedido ${code}. Estos son los detalles:`,
    '',
    ...items.map((it) => `· ${it}`),
    ...(shipping > 0 ? [`Envío: $${shipping.toFixed(2)}`] : []),
    ...(discount > 0 ? [`Descuento: -$${discount.toFixed(2)}`] : []),
    `TOTAL A TRANSFERIR: $${total.toFixed(2)}`,
    '',
    `Entrega: ${address}`,
    '',
    '— DATOS PARA LA TRANSFERENCIA —',
    bankDetails,
    '',
    `Monto exacto: $${total.toFixed(2)}`,
    `Referencia: ${code}`,
    '',
    'Cuando hayas transferido, sube tu comprobante aquí:',
    trackUrl,
    '',
    'Apenas lo subas te confirmamos por WhatsApp. Guarda este enlace para seguir tu pedido.',
    '',
    'ENIGMA®',
  ]);
}
