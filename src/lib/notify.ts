/**
 * Aviso al dueño cuando llega un pedido o un comprobante.
 * Se activa configurando en el entorno:
 *   RESEND_API_KEY  — API key de resend.com (gratis hasta 3k correos/mes)
 *   NOTIFY_EMAIL    — correo que recibe los avisos
 *   NOTIFY_FROM     — remitente verificado (default: onboarding@resend.dev)
 * Sin esas variables, no hace nada. Nunca rompe el flujo del pedido.
 */
export async function notifyOwner(subject: string, lines: string[]): Promise<void> {
  const apiKey = import.meta.env.RESEND_API_KEY ?? process.env.RESEND_API_KEY;
  const to = import.meta.env.NOTIFY_EMAIL ?? process.env.NOTIFY_EMAIL;
  if (!apiKey || !to) return;
  const from =
    import.meta.env.NOTIFY_FROM ?? process.env.NOTIFY_FROM ?? 'ENIGMA <onboarding@resend.dev>';

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
      }),
    });
  } catch {
    // El aviso es best-effort: un fallo aquí no debe tumbar el pedido.
  }
}
