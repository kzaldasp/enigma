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
  /** Imagen del manifiesto de /marca subida desde el admin; vacío = asset local. */
  marcaImageUrl: string;
  /* Página /marca — todo editable desde Contenido del sitio. */
  marcaEyebrow: string;
  marcaTitleLines: string[];
  marcaParagraphs: string[];
  marcaSeoTitle: string;
  marcaSeoDescription: string;
  marcaContactNote: string;
  /** Lookbook visible en la tienda (admin → Campañas). */
  lookbookEnabled: boolean;
  /** Costo de envío plano en USD; 0 = gratis. */
  shippingCost: number;
  /** Subtotal desde el cual el envío es gratis; 0 = nunca. */
  shippingFreeFrom: number;
  legalTerms: string;
  legalPrivacy: string;
  /* SEO e identidad del negocio (admin → SEO). */
  /** Provincia y país para el schema Organization; la ciudad va en contactCity. */
  contactRegion: string;
  contactCountry: string;
  contactFacebook: string;
  contactTiktok: string;
  /** Año de fundación para `foundingDate` del schema. */
  orgFoundingYear: string;
  /** Códigos de verificación de propiedad del sitio. */
  seoVerificationGoogle: string;
  seoVerificationBing: string;
  seoVerificationMeta: string;
  /** Imagen social por defecto; vacío = /og.jpg. */
  seoDefaultOgImage: string;
  /** false = /feed.xml responde 404 (feed de Merchant Center apagado). */
  seoFeedEnabled: boolean;
};

const DEFAULTS: Record<string, string> = {
  season_line: 'NUEVA COLECCIÓN — VERANO 2026 DISPONIBLE',
  site_description: SITE_DESCRIPTION,
  manifesto_lines:
    'Lo esencial no se explica.\nSe lleva puesto.\nDiseñamos piezas que no piden\npermiso ni atención: la consiguen.',
  newsletter_title: 'No todos pueden tener piezas limitadas.',
  newsletter_text:
    'Acceso anticipado a cada serie, antes de que se agote. Nada más: sin promociones, sin ruido.',
  contact_email: 'contacto@enigma593.com',
  contact_instagram: 'https://instagram.com/enigma',
  // La marca es de Ibarra; el schema no debe declarar una ciudad que no es.
  contact_city: 'IBARRA — ECUADOR',
  contact_region: 'Imbabura',
  contact_country: 'EC',
  contact_facebook: '',
  contact_tiktok: '',
  org_founding_year: '2024',
  seo_verification_google: '',
  seo_verification_bing: '',
  seo_verification_meta: '',
  seo_default_og_image: '',
  seo_feed_enabled: '1',
  whatsapp_number: '593980324621',
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
  marca_image_url: '',
  marca_eyebrow: 'LA MARCA',
  marca_title_lines:
    'Enigma no es un logotipo.\nEs la decisión de no explicarse:\npiezas que sostienen la mirada sin devolverla.',
  marca_paragraphs:
    'ENIGMA nace en Ibarra en 2024. Cada temporada es una serie corta: pocas piezas, pocas unidades, cero reposición. Lo que se agota, se agota.\n\nTrabajamos con talleres a menos de veinte kilómetros del estudio, con materiales que mejoran con el uso y costuras pensadas para durar más que la tendencia.\n\nEl pedido se arma en la bolsa y se paga por transferencia: eliges, confirmas y validamos. Si algo no calza, escríbenos y lo resolvemos con una persona, no con un formulario.',
  marca_seo_title: 'Sobre la marca',
  marca_seo_description:
    'ENIGMA es una marca ecuatoriana de gorras. Series cortas, materiales honestos y un canal directo: hablas con quien hace las piezas.',
  marca_contact_note:
    'Respondemos de lunes a sábado, de 09h00 a 19h00. Si una pieza está agotada, escríbenos igual: a veces queda una unidad en el estudio.',
  // '0' = el lookbook desaparece del menú y /lookbook redirige al catálogo.
  lookbook_enabled: '1',
  shipping_cost: '0',
  shipping_free_from: '',
  legal_terms:
    'Las compras se concretan desde la bolsa y se pagan por transferencia bancaria: al confirmar el pedido recibes los datos de la cuenta y validamos tu comprobante antes de despachar. Los precios están en dólares estadounidenses e incluyen impuestos.\n\nCambios de talla dentro de los 15 días posteriores a la entrega, con la pieza sin uso y en su empaque original. Las series son limitadas: no garantizamos reposición.',
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
      marcaImageUrl: map.marca_image_url,
      marcaEyebrow: map.marca_eyebrow,
      marcaTitleLines: map.marca_title_lines.split('\n').filter(Boolean),
      // Doble salto = párrafo nuevo, igual que en los textos legales.
      marcaParagraphs: map.marca_paragraphs.split(/\n{2,}/).filter(Boolean),
      marcaSeoTitle: map.marca_seo_title,
      marcaSeoDescription: map.marca_seo_description,
      marcaContactNote: map.marca_contact_note,
      lookbookEnabled: map.lookbook_enabled !== '0',
      shippingCost: Number(map.shipping_cost) || 0,
      shippingFreeFrom: Number(map.shipping_free_from) || 0,
      legalTerms: map.legal_terms,
      legalPrivacy: map.legal_privacy,
      contactRegion: map.contact_region,
      contactCountry: map.contact_country,
      contactFacebook: map.contact_facebook,
      contactTiktok: map.contact_tiktok,
      orgFoundingYear: map.org_founding_year,
      seoVerificationGoogle: map.seo_verification_google,
      seoVerificationBing: map.seo_verification_bing,
      seoVerificationMeta: map.seo_verification_meta,
      seoDefaultOgImage: map.seo_default_og_image,
      seoFeedEnabled: map.seo_feed_enabled !== '0',
    } satisfies SiteContent;
  });
}
