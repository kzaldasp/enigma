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

async function sendEmail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<void> {
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
        text,
        ...(html ? { html } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
  } catch {
    // Best-effort: un fallo de correo no debe tumbar el pedido.
  }
}

/** Aviso al equipo cuando llega un pedido o un comprobante (texto plano basta). */
export async function notifyOwner(subject: string, lines: string[]): Promise<void> {
  const to = env('NOTIFY_EMAIL');
  if (!to) return;
  await sendEmail(to, subject, lines.join('\n'));
}

/* ------------------------------------------------------------------
   Correo de pedido — paleta y tipografía de la marca.
   Tablas + estilos inline: es lo único que respetan Gmail y Outlook.
------------------------------------------------------------------- */
const BONE = '#f6f4ef';
const INK = '#0a0a0a';
const STONE = '#8a8780';
const LINE = '#e3e0d8';
const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS = "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Etiqueta editorial: mayúsculas pequeñas con tracking, en gris piedra. */
const label = (t: string): string =>
  `<p style="margin:0;font-family:${SANS};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${STONE};">${esc(t)}</p>`;

const money = (n: number): string => `$${n.toFixed(2)}`;

/**
 * Respaldo escrito para el cliente al crear el pedido: le queda el código,
 * los datos bancarios y el enlace para subir el comprobante aunque cierre
 * la página. El WhatsApp automático solo sale al subir el comprobante.
 */
export async function sendOrderEmail(params: {
  to: string;
  name: string;
  code: string;
  items: { name: string; qty: number; amount: number }[];
  subtotal: number;
  total: number;
  shipping: number;
  discount: number;
  address: string;
  bankDetails: string;
  trackUrl: string;
}): Promise<void> {
  const {
    to, name, code, items, subtotal, total, shipping, discount, address, bankDetails, trackUrl,
  } = params;

  // ── Texto plano (fallback y lectores sin HTML) ──────────────────
  const text = [
    `Hola ${name},`,
    '',
    `Recibimos tu pedido ${code}. Estos son los detalles:`,
    '',
    ...items.map((it) => `· ${it.name} x${it.qty} — ${money(it.amount)}`),
    `Subtotal: ${money(subtotal)}`,
    ...(shipping > 0 ? [`Envío: ${money(shipping)}`] : ['Envío: gratis']),
    ...(discount > 0 ? [`Descuento: -${money(discount)}`] : []),
    `TOTAL A TRANSFERIR: ${money(total)}`,
    '',
    `Entrega: ${address}`,
    '',
    '— DATOS PARA LA TRANSFERENCIA —',
    bankDetails,
    '',
    `Monto exacto: ${money(total)}`,
    `Referencia: ${code}`,
    '',
    'Cuando hayas transferido, sube tu comprobante aquí:',
    trackUrl,
    '',
    'Apenas lo subas te confirmamos por WhatsApp. Guarda este enlace para seguir tu pedido.',
    '',
    'ENIGMA®',
  ].join('\n');

  // ── Fila de producto ────────────────────────────────────────────
  const itemRows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:13px;color:${INK};">
          ${esc(it.name)}<span style="color:${STONE};"> &times;${it.qty}</span>
        </td>
        <td align="right" style="padding:14px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:13px;color:${INK};white-space:nowrap;">
          ${money(it.amount)}
        </td>
      </tr>`,
    )
    .join('');

  const totalRow = (t: string, v: string, strong = false) => `
      <tr>
        <td style="padding:6px 0;font-family:${SANS};font-size:${strong ? '13px' : '12px'};letter-spacing:.1em;text-transform:uppercase;color:${strong ? INK : STONE};">${esc(t)}</td>
        <td align="right" style="padding:6px 0;font-family:${SANS};font-size:${strong ? '15px' : '12px'};color:${strong ? INK : STONE};white-space:nowrap;">${esc(v)}</td>
      </tr>`;

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pedido ${esc(code)}</title></head>
<body style="margin:0;padding:0;background:${BONE};">
  <!-- preheader oculto -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Tu pedido ${esc(code)} — datos para la transferencia y enlace para subir tu comprobante.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BONE};">
    <tr><td align="center" style="padding:32px 16px;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Cabecera -->
        <tr>
          <td style="background:${INK};padding:28px 32px;text-align:center;">
            <p style="margin:0;font-family:${SANS};font-size:15px;letter-spacing:.42em;text-transform:uppercase;color:${BONE};">ENIGMA</p>
          </td>
        </tr>

        <!-- Saludo -->
        <tr>
          <td style="padding:36px 32px 0;">
            ${label(`Pedido ${code}`)}
            <h1 style="margin:12px 0 0;font-family:${SERIF};font-size:32px;line-height:1.15;font-weight:400;color:${INK};">
              Gracias, ${esc(name.split(' ')[0])}.
            </h1>
            <p style="margin:14px 0 0;font-family:${SANS};font-size:14px;line-height:1.7;color:${STONE};">
              Reservamos tus piezas. Para confirmar la compra, realiza la transferencia
              y sube tu comprobante.
            </p>
          </td>
        </tr>

        <!-- Detalle -->
        <tr>
          <td style="padding:32px 32px 0;">
            ${label('Tu pedido')}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-top:1px solid ${LINE};">
              ${itemRows}
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
              ${totalRow('Subtotal', money(subtotal))}
              ${totalRow('Envío', shipping > 0 ? money(shipping) : 'Gratis')}
              ${discount > 0 ? totalRow('Descuento', `-${money(discount)}`) : ''}
              <tr><td colspan="2" style="padding-top:10px;border-top:1px solid ${LINE};"></td></tr>
              ${totalRow('Total a transferir', money(total), true)}
            </table>
          </td>
        </tr>

        <!-- Datos bancarios -->
        <tr>
          <td style="padding:32px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};">
              <tr><td style="padding:28px 28px 24px;">
                <p style="margin:0;font-family:${SANS};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${STONE};">Datos para la transferencia</p>
                <p style="margin:14px 0 0;font-family:${SANS};font-size:14px;line-height:1.8;color:${BONE};white-space:pre-line;">${esc(bankDetails)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #2a2a2a;">
                  <tr>
                    <td style="padding-top:16px;font-family:${SANS};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${STONE};">Monto exacto</td>
                    <td align="right" style="padding-top:16px;font-family:${SANS};font-size:15px;color:${BONE};">${money(total)}</td>
                  </tr>
                  <tr>
                    <td style="padding-top:8px;font-family:${SANS};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${STONE};">Referencia</td>
                    <td align="right" style="padding-top:8px;font-family:${SANS};font-size:15px;color:${BONE};">${esc(code)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- Botón -->
        <tr>
          <td style="padding:28px 32px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center" style="border:1px solid ${INK};">
                <a href="${esc(trackUrl)}" style="display:block;padding:16px 24px;font-family:${SANS};font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:${INK};text-decoration:none;">
                  Subir mi comprobante
                </a>
              </td></tr>
            </table>
            <p style="margin:14px 0 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${STONE};text-align:center;">
              Apenas lo subas te confirmamos por WhatsApp.<br>Guarda este correo para seguir tu pedido.
            </p>
          </td>
        </tr>

        <!-- Entrega -->
        <tr>
          <td style="padding:32px 32px 0;">
            ${label('Dirección de entrega')}
            <p style="margin:10px 0 0;font-family:${SANS};font-size:13px;line-height:1.7;color:${INK};">${esc(address)}</p>
          </td>
        </tr>

        <!-- Pie -->
        <tr>
          <td style="padding:36px 32px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};">
              <tr><td style="padding-top:24px;text-align:center;">
                <p style="margin:0;font-family:${SERIF};font-size:18px;letter-spacing:.28em;text-transform:uppercase;color:${INK};">ENIGMA</p>
                <p style="margin:10px 0 0;font-family:${SANS};font-size:11px;line-height:1.8;letter-spacing:.06em;color:${STONE};">
                  Piezas limitadas · Ecuador<br>
                  ¿Dudas? Responde a este correo.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail(to, `ENIGMA — Tu pedido ${code}`, text, html);
}

/* ------------------------------------------------------------------
   Aviso interno de pedido nuevo.
   Mismo lenguaje visual que el correo del cliente, pero pensado para
   despachar: lo primero que se ve es el total y el botón que abre el
   pedido en el admin; debajo, todo lo que hace falta para preparar el
   envío sin abrir nada más.
------------------------------------------------------------------- */
export type AdminOrderEmail = {
  code: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  couponCode: string | null;
  items: { name: string; qty: number; amount: number }[];
  customer: { name: string; phone: string; email: string; cedula: string };
  delivery: { address: string; reference: string; city: string; province: string };
  notes: string;
  /** Vacío si no hay ADMIN_URL configurada: entonces no se pinta el botón. */
  adminUrl: string;
  trackUrl: string;
};

export async function sendNewOrderAdminEmail(order: AdminOrderEmail): Promise<void> {
  const to = env('NOTIFY_EMAIL');
  if (!to) return;

  const {
    code, total, subtotal, shipping, discount, couponCode, items,
    customer, delivery, notes, adminUrl, trackUrl,
  } = order;

  const fullAddress = `${delivery.address} · ${delivery.reference} — ${delivery.city}, ${delivery.province}`;
  const units = items.reduce((n, it) => n + it.qty, 0);

  // ── Texto plano (fallback y notificaciones del móvil) ───────────
  const text = [
    `NUEVO PEDIDO ${code} — ${money(total)}`,
    '',
    ...items.map((it) => `· ${it.name} x${it.qty} — ${money(it.amount)}`),
    '',
    `Subtotal: ${money(subtotal)}`,
    `Envío: ${shipping > 0 ? money(shipping) : 'gratis'}`,
    ...(discount > 0 ? [`Descuento${couponCode ? ` (${couponCode})` : ''}: -${money(discount)}`] : []),
    `TOTAL: ${money(total)}`,
    '',
    '— CLIENTE —',
    customer.name,
    `WhatsApp: ${customer.phone}`,
    `Correo: ${customer.email}`,
    `Cédula: ${customer.cedula}`,
    '',
    '— ENTREGA —',
    fullAddress,
    ...(notes ? ['', `Nota del cliente: ${notes}`] : []),
    '',
    'Estado: pendiente de comprobante.',
    ...(adminUrl ? ['', `Abrir en el admin: ${adminUrl}`] : ['', 'Revísalo en el admin → Pedidos web']),
    `Página del cliente: ${trackUrl}`,
  ].join('\n');

  // ── HTML ────────────────────────────────────────────────────────
  const itemRows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:13px;color:${INK};">
          ${esc(it.name)}<span style="color:${STONE};"> &times;${it.qty}</span>
        </td>
        <td align="right" style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:13px;color:${INK};white-space:nowrap;">
          ${money(it.amount)}
        </td>
      </tr>`,
    )
    .join('');

  const totalRow = (t: string, v: string, strong = false) => `
      <tr>
        <td style="padding:6px 0;font-family:${SANS};font-size:${strong ? '13px' : '12px'};letter-spacing:.1em;text-transform:uppercase;color:${strong ? INK : STONE};">${esc(t)}</td>
        <td align="right" style="padding:6px 0;font-family:${SANS};font-size:${strong ? '15px' : '12px'};color:${strong ? INK : STONE};white-space:nowrap;">${esc(v)}</td>
      </tr>`;

  /** Fila etiqueta / valor de las fichas de cliente y entrega. */
  const dataRow = (t: string, valueHtml: string) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${STONE};white-space:nowrap;vertical-align:top;">${esc(t)}</td>
        <td align="right" style="padding:9px 0 9px 16px;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:13px;line-height:1.6;color:${INK};">${valueHtml}</td>
      </tr>`;

  const waHref = `https://wa.me/${customer.phone.replace(/\D/g, '')}`;
  const linkStyle = `color:${INK};text-decoration:underline;`;

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nuevo pedido ${esc(code)}</title></head>
<body style="margin:0;padding:0;background:${BONE};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${esc(customer.name)} · ${units} ${units === 1 ? 'pieza' : 'piezas'} · ${money(total)} — pendiente de comprobante.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BONE};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Cabecera: queda claro que es un aviso interno -->
        <tr>
          <td style="background:${INK};padding:22px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family:${SANS};font-size:13px;letter-spacing:.36em;text-transform:uppercase;color:${BONE};">ENIGMA</td>
                <td align="right" style="font-family:${SANS};font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${STONE};">Aviso interno</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Titular: pedido y total, lo que se lee de un vistazo -->
        <tr>
          <td style="padding:34px 32px 0;">
            ${label(`Pedido ${code} · ${units} ${units === 1 ? 'pieza' : 'piezas'}`)}
            <h1 style="margin:12px 0 0;font-family:${SERIF};font-size:34px;line-height:1.1;font-weight:400;color:${INK};">
              Nuevo pedido — ${money(total)}
            </h1>
            <p style="margin:12px 0 0;font-family:${SANS};font-size:13px;line-height:1.7;color:${STONE};">
              De ${esc(customer.name)}. Queda pendiente de comprobante: cuando el cliente lo suba
              llega otro aviso para validar el pago.
            </p>
          </td>
        </tr>

        <!-- Botón al admin, arriba: es la acción de este correo -->
        ${
          adminUrl
            ? `<tr>
          <td style="padding:26px 32px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center" style="background:${INK};">
                <a href="${esc(adminUrl)}" style="display:block;padding:16px 24px;font-family:${SANS};font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:${BONE};text-decoration:none;">
                  Ver el pedido ${esc(code)} en el admin
                </a>
              </td></tr>
            </table>
          </td>
        </tr>`
            : `<tr>
          <td style="padding:26px 32px 0;">
            <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.7;color:${STONE};">
              Revísalo en el admin &rarr; Pedidos web.
            </p>
          </td>
        </tr>`
        }

        <!-- Piezas y totales -->
        <tr>
          <td style="padding:32px 32px 0;">
            ${label('Piezas')}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-top:1px solid ${LINE};">
              ${itemRows}
            </table>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
              ${totalRow('Subtotal', money(subtotal))}
              ${totalRow('Envío', shipping > 0 ? money(shipping) : 'Gratis')}
              ${discount > 0 ? totalRow(couponCode ? `Descuento (${couponCode})` : 'Descuento', `-${money(discount)}`) : ''}
              <tr><td colspan="2" style="padding-top:10px;border-top:1px solid ${LINE};"></td></tr>
              ${totalRow('Total del pedido', money(total), true)}
            </table>
          </td>
        </tr>

        <!-- Cliente -->
        <tr>
          <td style="padding:32px 32px 0;">
            ${label('Cliente')}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-top:1px solid ${LINE};">
              ${dataRow('Nombre', esc(customer.name))}
              ${dataRow('WhatsApp', `<a href="${esc(waHref)}" style="${linkStyle}">${esc(customer.phone)}</a>`)}
              ${dataRow('Correo', `<a href="mailto:${esc(customer.email)}" style="${linkStyle}">${esc(customer.email)}</a>`)}
              ${dataRow('Cédula', esc(customer.cedula))}
            </table>
          </td>
        </tr>

        <!-- Entrega -->
        <tr>
          <td style="padding:32px 32px 0;">
            ${label('Entrega')}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-top:1px solid ${LINE};">
              ${dataRow('Dirección', esc(delivery.address))}
              ${dataRow('Referencia', esc(delivery.reference))}
              ${dataRow('Ciudad', esc(delivery.city))}
              ${dataRow('Provincia', esc(delivery.province))}
              ${notes ? dataRow('Nota', esc(notes)) : ''}
            </table>
          </td>
        </tr>

        <!-- Pie: enlace secundario a la página del cliente -->
        <tr>
          <td style="padding:32px 32px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};">
              <tr><td style="padding-top:22px;text-align:center;">
                <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.9;letter-spacing:.06em;color:${STONE};">
                  Página que ve el cliente:<br>
                  <a href="${esc(trackUrl)}" style="color:${STONE};text-decoration:underline;">${esc(trackUrl)}</a>
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail(to, `Nuevo pedido ${code} — ${money(total)} · ${customer.name}`, text, html);
}

/**
 * Acuse inmediato al subir el comprobante. La página ya se lo confirma en
 * pantalla, pero esto es lo que le queda si cierra la pestaña: constancia
 * escrita de que su transferencia entró y de por cuánto.
 */
export async function sendReceiptEmail(params: {
  to: string;
  name: string;
  code: string;
  total: number;
  trackUrl: string;
}): Promise<void> {
  const { to, name, code, total, trackUrl } = params;

  const text = [
    `Hola ${name},`,
    '',
    `Recibimos tu comprobante del pedido ${code}.`,
    '',
    `Monto del pedido: ${money(total)}`,
    '',
    'Lo estamos verificando y te confirmamos por WhatsApp apenas quede validado.',
    '',
    'Sigue el estado de tu pedido aquí:',
    trackUrl,
    '',
    'ENIGMA®',
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Comprobante recibido ${esc(code)}</title></head>
<body style="margin:0;padding:0;background:${BONE};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Recibimos tu comprobante del pedido ${esc(code)} — lo estamos verificando.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BONE};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <tr>
          <td style="background:${INK};padding:28px 32px;text-align:center;">
            <p style="margin:0;font-family:${SANS};font-size:15px;letter-spacing:.42em;text-transform:uppercase;color:${BONE};">ENIGMA</p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 32px 0;">
            ${label(`Pedido ${code}`)}
            <h1 style="margin:12px 0 0;font-family:${SERIF};font-size:32px;line-height:1.15;font-weight:400;color:${INK};">
              Comprobante recibido.
            </h1>
            <p style="margin:14px 0 0;font-family:${SANS};font-size:14px;line-height:1.7;color:${STONE};">
              Gracias, ${esc(name.split(' ')[0])}. Ya tenemos tu comprobante y lo estamos
              verificando. Te confirmamos por WhatsApp apenas quede validado.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};">
              <tr><td style="padding:20px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-family:${SANS};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${STONE};">Pedido</td>
                    <td align="right" style="font-family:${SANS};font-size:14px;color:${INK};">${esc(code)}</td>
                  </tr>
                  <tr>
                    <td style="padding-top:10px;font-family:${SANS};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${STONE};">Monto</td>
                    <td align="right" style="padding-top:10px;font-family:${SANS};font-size:15px;color:${INK};">${money(total)}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr><td align="center" style="border:1px solid ${INK};">
                <a href="${esc(trackUrl)}" style="display:block;padding:16px 24px;font-family:${SANS};font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:${INK};text-decoration:none;">
                  Seguir mi pedido
                </a>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 32px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};">
              <tr><td style="padding-top:24px;text-align:center;">
                <p style="margin:0;font-family:${SERIF};font-size:18px;letter-spacing:.28em;text-transform:uppercase;color:${INK};">ENIGMA</p>
                <p style="margin:10px 0 0;font-family:${SANS};font-size:11px;line-height:1.8;letter-spacing:.06em;color:${STONE};">
                  Piezas limitadas · Ecuador<br>
                  ¿Dudas? Responde a este correo.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail(to, `ENIGMA — Recibimos tu comprobante · ${code}`, text, html);
}
