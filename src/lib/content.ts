import { db, cached } from './db';
import { SITE_DESCRIPTION } from './site';

/**
 * Textos editables desde el admin (tabla site_content), con defaults
 * para que la landing nunca se rompa si falta una clave.
 */
export type SiteContent = {
  seasonLine: string;
  siteDescription: string;
  manifestoLines: string[];
  newsletterTitle: string;
  newsletterText: string;
  contactEmail: string;
  contactInstagram: string;
  contactCity: string;
  whatsappNumber: string;
  shippingText: string;
  returnsText: string;
  bankDetails: string;
  /** Tipografías (Contenido → Tipografía). Vacío en fontHero = heredar. */
  fontDisplay: string;
  fontBody: string;
  fontHero: string;
  /** URL css2 de Google Fonts pegada en el admin (fuentes fuera del catálogo). */
  fontCustomUrl: string;
  /** Imagen del hero subida desde el admin; vacío = asset local. */
  heroImageUrl: string;
  /** Costo de envío plano en USD; 0 = gratis. */
  shippingCost: number;
  /** Subtotal desde el cual el envío es gratis; 0 = nunca. */
  shippingFreeFrom: number;
  legalTerms: string;
  legalPrivacy: string;
};

const DEFAULTS: Record<string, string> = {
  season_line: 'NUEVA COLECCIÓN — VERANO 2026 DISPONIBLE',
  site_description: SITE_DESCRIPTION,
  manifesto_lines:
    'Lo esencial no se explica.\nSe lleva puesto.\nDiseñamos piezas que no piden\npermiso ni atención: la consiguen.',
  newsletter_title: 'No todos pueden tener piezas limitadas.',
  newsletter_text:
    'Acceso anticipado a cada serie, antes de que se agote. Nada más: sin promociones, sin ruido.',
  contact_email: 'hola@enigma.example',
  contact_instagram: 'https://instagram.com/enigma',
  contact_city: 'QUITO — ECUADOR',
  whatsapp_number: '',
  shipping_text:
    'Despacho en 24–48 h dentro de Ecuador. Quito y Guayaquil: 1–2 días hábiles; resto del país: 2–4. Envío internacional bajo cotización por WhatsApp.',
  returns_text:
    'Tienes 15 días desde la entrega para cambios de talla, con la pieza sin uso y en su empaque. Las piezas agotadas no se reservan.',
  bank_details: '',
  font_display: 'Cormorant Garamond',
  font_body: 'Inter',
  font_hero: '',
  font_custom_url: '',
  hero_image_url: '',
  shipping_cost: '0',
  shipping_free_from: '',
  legal_terms:
    'Las compras se concretan por transferencia bancaria o WhatsApp: confirmamos disponibilidad, talla y dirección antes del pago. Los precios están en dólares estadounidenses e incluyen impuestos.\n\nCambios de talla dentro de los 15 días posteriores a la entrega, con la pieza sin uso y en su empaque original. Las series son limitadas: no garantizamos reposición.',
  legal_privacy:
    'Usamos tu correo únicamente para avisarte de nuevas series si te suscribes, y tu número solo para gestionar tu pedido. No compartimos datos con terceros ni usamos rastreadores de publicidad.\n\nPuedes pedir la eliminación de tus datos en cualquier momento escribiendo al correo del estudio.',
};

export async function getSiteContent(): Promise<SiteContent> {
  return cached('site_content', async () => {
    const map = { ...DEFAULTS };
    try {
      const { rows } = await db().execute('SELECT key, value FROM site_content');
      for (const r of rows) {
        const value = String(r.value ?? '');
        if (value) map[String(r.key)] = value;
      }
    } catch {
      // DB no disponible: la landing sigue funcionando con defaults.
    }
    return {
      seasonLine: map.season_line,
      siteDescription: map.site_description,
      manifestoLines: map.manifesto_lines.split('\n').filter(Boolean),
      newsletterTitle: map.newsletter_title,
      newsletterText: map.newsletter_text,
      contactEmail: map.contact_email,
      contactInstagram: map.contact_instagram,
      contactCity: map.contact_city,
      whatsappNumber: map.whatsapp_number,
      shippingText: map.shipping_text,
      returnsText: map.returns_text,
      bankDetails: map.bank_details,
      fontDisplay: map.font_display,
      fontBody: map.font_body,
      fontHero: map.font_hero,
      fontCustomUrl: map.font_custom_url,
      heroImageUrl: map.hero_image_url,
      shippingCost: Number(map.shipping_cost) || 0,
      shippingFreeFrom: Number(map.shipping_free_from) || 0,
      legalTerms: map.legal_terms,
      legalPrivacy: map.legal_privacy,
    } satisfies SiteContent;
  });
}
