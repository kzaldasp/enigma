/**
 * Mensajes automáticos al cliente vía WhatsApp Cloud API (Meta).
 * Se activa configurando en el entorno (mismas credenciales que el admin):
 *   WHATSAPP_TOKEN     — token permanente de la app de Meta
 *   WHATSAPP_PHONE_ID  — Phone number ID del número de WhatsApp Business
 *   WHATSAPP_API_VERSION — opcional, default v21.0
 *
 * Nota: Meta solo entrega texto libre dentro de la ventana de 24 h desde el
 * último mensaje del cliente; fuera de ella exige plantillas aprobadas.
 * Sin credenciales no hace nada. Es best-effort: nunca rompe el pedido.
 */

const env = (key: string): string | undefined =>
  (import.meta.env?.[key] as string | undefined) ?? process.env[key];

/** Normaliza números de Ecuador: 0991234567 → 593991234567. */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('593')) return digits;
  if (digits.startsWith('0')) return `593${digits.slice(1)}`;
  return digits;
}

export async function sendWhatsApp(phone: string, body: string): Promise<boolean> {
  const token = env('WHATSAPP_TOKEN');
  const phoneId = env('WHATSAPP_PHONE_ID');
  if (!token || !phoneId || !phone) return false;
  const version = env('WHATSAPP_API_VERSION') ?? 'v21.0';

  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: waNumber(phone),
        type: 'text',
        text: { body, preview_url: true },
      }),
    });
    if (!res.ok) {
      console.warn('WhatsApp Cloud API:', res.status, (await res.text()).slice(0, 200));
    }
    return res.ok;
  } catch (e) {
    console.warn('WhatsApp Cloud API:', e instanceof Error ? e.message : e);
    return false;
  }
}
