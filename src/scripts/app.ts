/**
 * ENIGMA — sistema de movimiento.
 *
 * Ciclo de vida con View Transitions (obligatorio):
 *   - init en `astro:page-load`
 *   - limpieza TOTAL en `astro:before-swap`:
 *       ScrollTrigger.getAll().forEach(t => t.kill()) + lenis.destroy()
 *   - nunca se re-inicializa sin destruir antes (triggers duplicados
 *     causan saltos y fugas de memoria).
 *
 * Todo es declarativo vía data-attributes:
 *   data-reveal            → fade + 24px↑ al 80% del viewport, una vez
 *   data-reveal-group      → stagger de sus [data-reveal-item]
 *   data-lines             → reveal por líneas enmascaradas ([data-line] > .line-in)
 *   data-words             → frase que se revela palabra a palabra con scrub
 *   data-parallax          → imagen grande, ±7% con scrub suave
 *   data-hero              → intro del hero (coordinada con el preloader)
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { getCart, addToCart, setQty, clearCart, cartCount, cartTotal } from './cart';
import { computeTotals, type CouponInfo } from '../lib/totals';
import { cdnImage } from '../lib/cdn';

gsap.registerPlugin(ScrollTrigger);

const PRELOADER_KEY = 'enigma:preloader';
const EASE = 'power3.out';

let lenis: Lenis | null = null;
let ctx: gsap.Context | null = null;
let abort: AbortController | null = null;
let rafTick: ((time: number) => void) | null = null;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/* ------------------------------------------------------------------
   Smooth scroll (solo desktop con puntero fino y sin reduced-motion)
------------------------------------------------------------------- */
function initLenis() {
  if (reduced() || !window.matchMedia('(pointer: fine)').matches) return;
  lenis = new Lenis({ autoRaf: false, lerp: 0.11, smoothWheel: true, anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  rafTick = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(rafTick);
  gsap.ticker.lagSmoothing(0);
}

/* ------------------------------------------------------------------
   Header: fondo al hacer scroll
------------------------------------------------------------------- */
function initHeader(signal: AbortSignal) {
  const update = () =>
    document.documentElement.classList.toggle('is-scrolled', window.scrollY > 32);
  update();
  window.addEventListener('scroll', update, { passive: true, signal });
}

/* ------------------------------------------------------------------
   Menú móvil: overlay negro a pantalla completa, links escalonados
------------------------------------------------------------------- */
function initMenu(signal: AbortSignal) {
  const button = $('#menu-toggle');
  const overlay = $('#menu-overlay');
  if (!button || !overlay) return;

  const links = $$('[data-menu-item]', overlay);
  let open = false;

  const setOpen = (next: boolean) => {
    open = next;
    button.setAttribute('aria-expanded', String(next));
    const label = button.querySelector('[data-menu-label]');
    if (label) label.textContent = next ? 'CERRAR' : 'MENÚ';

    if (next) {
      overlay.removeAttribute('hidden');
      document.documentElement.setAttribute('data-menu-open', '');
      lenis?.stop();
      if (!reduced()) {
        gsap.fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: EASE });
        gsap.fromTo(
          links,
          { yPercent: 60, autoAlpha: 0 },
          { yPercent: 0, autoAlpha: 1, duration: 0.7, ease: EASE, stagger: 0.07, delay: 0.1 },
        );
      }
      (links[0] as HTMLElement | undefined)?.focus();
    } else {
      const close = () => {
        overlay.setAttribute('hidden', '');
        document.documentElement.removeAttribute('data-menu-open');
        lenis?.start();
      };
      if (!reduced()) {
        gsap.to(overlay, { autoAlpha: 0, duration: 0.3, ease: 'power2.out', onComplete: close });
      } else {
        close();
      }
      button.focus();
    }
  };

  button.addEventListener('click', () => setOpen(!open), { signal });

  window.addEventListener(
    'keydown',
    (e) => {
      if (!open) return;
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab') {
        // Trampa de foco simple: botón de cierre + links del overlay
        const focusables = [button, ...links] as HTMLElement[];
        const idx = focusables.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && idx <= 0) {
          e.preventDefault();
          focusables[focusables.length - 1].focus();
        } else if (!e.shiftKey && idx === focusables.length - 1) {
          e.preventDefault();
          focusables[0].focus();
        }
      }
    },
    { signal },
  );
}

/* ------------------------------------------------------------------
   Preloader (solo home, una vez por sesión) + intro del hero
------------------------------------------------------------------- */
function heroIntro(delay = 0) {
  const hero = $('[data-hero]');
  if (!hero || reduced()) return;
  const lines = $$('[data-line] > .line-in', hero);
  const items = $$('[data-hero-fade]', hero);
  const tl = gsap.timeline({ delay });
  if (lines.length) {
    tl.to(lines, { y: 0, duration: 1, ease: EASE, stagger: 0.12 });
  }
  if (items.length) {
    tl.to(items, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE, stagger: 0.1 }, '-=0.55');
  }
}

function initPreloader() {
  const pre = $('#preloader');
  const heroOnPage = Boolean($('[data-hero]'));

  if (!pre) {
    if (heroOnPage) heroIntro(0.15);
    return;
  }

  const seen = sessionStorage.getItem(PRELOADER_KEY);
  if (seen || reduced()) {
    pre.remove();
    document.documentElement.setAttribute('data-preloader', 'done');
    heroIntro(0.15);
    return;
  }

  sessionStorage.setItem(PRELOADER_KEY, '1');
  lenis?.stop();

  const counter = pre.querySelector('[data-counter]');
  const bar = pre.querySelector('[data-bar]');
  const mark = pre.querySelector('[data-mark]');
  const progress = { value: 0 };

  const tl = gsap.timeline({
    onComplete: () => {
      pre.remove();
      lenis?.start();
    },
  });

  if (mark) tl.fromTo(mark, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: EASE });
  tl.to(progress, {
    value: 100,
    duration: 1.4,
    ease: 'power2.inOut',
    onUpdate: () => {
      if (counter) counter.textContent = String(Math.round(progress.value)).padStart(3, '0');
      if (bar) gsap.set(bar, { scaleX: progress.value / 100 });
    },
  });
  // La cortina sube revelando el hero — 0.9s, ease-out expo
  tl.to(pre, { yPercent: -100, duration: 0.9, ease: 'expo.out' }, '+=0.15');
  tl.add(() => heroIntro(0), '<+0.25');
}

/* ------------------------------------------------------------------
   Reveals, líneas, palabras y parallax — dentro de un gsap.context
------------------------------------------------------------------- */
function initScrollAnimations() {
  if (reduced()) return;

  ctx = gsap.context(() => {
    // Patrón base: opacidad 0→1, 24px hacia arriba, una sola vez
    $$('[data-reveal]').forEach((el) => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: EASE,
          delay: Number(el.dataset.revealDelay ?? 0),
          scrollTrigger: { trigger: el, start: 'top 80%', once: true },
        },
      );
    });

    // Grupos con stagger (cards de producto, bloques de categoría…)
    $$('[data-reveal-group]').forEach((group) => {
      const items = $$('[data-reveal-item]', group);
      if (!items.length) return;
      gsap.fromTo(
        items,
        { autoAlpha: 0, y: 24 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.8,
          ease: EASE,
          stagger: 0.1,
          scrollTrigger: { trigger: group, start: 'top 80%', once: true },
        },
      );
    });

    // Titulares por líneas enmascaradas (el hero se gestiona en heroIntro)
    $$('[data-lines]:not([data-hero])').forEach((block) => {
      const lines = $$('[data-line] > .line-in', block);
      if (!lines.length) return;
      gsap.to(lines, {
        y: 0,
        duration: 1,
        ease: EASE,
        stagger: 0.12,
        scrollTrigger: { trigger: block, start: 'top 80%', once: true },
      });
    });

    // Frase editorial: palabra a palabra con scrub suave
    $$('[data-words]').forEach((block) => {
      const words = $$('[data-word]', block);
      if (!words.length) return;
      gsap.to(words, {
        opacity: 1,
        ease: 'none',
        stagger: 0.06,
        scrollTrigger: {
          trigger: block,
          start: 'top 78%',
          end: 'top 30%',
          scrub: 0.6,
        },
      });
    });

    // Parallax contenido (la imagen vive sobreescalada en su marco)
    $$('[data-parallax]').forEach((img) => {
      const frame = img.closest('.parallax-frame') ?? img.parentElement;
      gsap.fromTo(
        img,
        { yPercent: -7 },
        {
          yPercent: 7,
          ease: 'none',
          scrollTrigger: {
            trigger: frame,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.5,
          },
        },
      );
    });
  });
}

/* ------------------------------------------------------------------
   Catálogo: filtro por categoría (texto subrayado, sin dropdowns)
------------------------------------------------------------------- */
function initCatalog(signal: AbortSignal) {
  const root = $('[data-catalog]');
  if (!root) return;

  const buttons = $$('button[data-filter]', root);
  const cards = $$('[data-category]', root);
  const counter = $('[data-count]', root);

  const apply = (category: string) => {
    let visible = 0;
    cards.forEach((card) => {
      const show = category === 'todo' || card.dataset.category === category;
      card.toggleAttribute('hidden', !show);
      if (show) visible++;
    });
    buttons.forEach((b) => {
      const active = b.dataset.filter === category;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    if (counter) counter.textContent = `${visible} ${visible === 1 ? 'PIEZA' : 'PIEZAS'}`;
    ScrollTrigger.refresh();
  };

  buttons.forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        const category = button.dataset.filter ?? 'todo';
        const url = new URL(window.location.href);
        if (category === 'todo') url.searchParams.delete('categoria');
        else url.searchParams.set('categoria', category);
        history.replaceState(null, '', url);
        apply(category);
      },
      { signal },
    );
  });

  const param = new URLSearchParams(window.location.search).get('categoria');
  if (param && buttons.some((b) => b.dataset.filter === param)) apply(param);
}

/* ------------------------------------------------------------------
   Producto: talle elegido → mensaje de WhatsApp precargado
------------------------------------------------------------------- */
function initProduct(signal: AbortSignal) {
  const cta = $<HTMLAnchorElement>('a[data-wa-product]');
  if (!cta) return;

  const radios = $$<HTMLInputElement>('input[name="talle"]');
  const hint = $('[data-size-hint]');
  const number = cta.dataset.waNumber ?? '';
  const title = cta.dataset.waProduct ?? '';
  const soldOut = 'waSoldout' in cta.dataset;

  const compose = (size?: string) => {
    const message = soldOut
      ? `Hola, ENIGMA. Avísenme cuando vuelva: ${title}${size ? ` — Talle ${size}` : ''}.`
      : `Hola, ENIGMA. Me interesa: ${title}${size ? ` — Talle ${size}` : ''}.`;
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
  };

  const selected = () => radios.find((r) => r.checked)?.value;

  // Talle único: queda seleccionado de fábrica
  if (radios.length === 1) radios[0].checked = true;

  radios.forEach((radio) =>
    radio.addEventListener(
      'change',
      () => {
        cta.href = compose(selected());
        hint?.setAttribute('hidden', '');
      },
      { signal },
    ),
  );

  cta.href = compose(selected());

  cta.addEventListener(
    'click',
    (e) => {
      if (radios.length && !selected()) {
        e.preventDefault();
        hint?.removeAttribute('hidden');
        radios[0]?.focus();
      }
    },
    { signal },
  );
}

/* ------------------------------------------------------------------
   Bolsa: badge del header + botón "agregar" en producto
------------------------------------------------------------------- */
function refreshCartBadge() {
  const badge = $('[data-cart-count]');
  if (!badge) return;
  const n = cartCount();
  badge.textContent = n > 9 ? '9+' : String(n);
  badge.toggleAttribute('hidden', n === 0);
}

function initCartBadge(signal: AbortSignal) {
  refreshCartBadge();
  document.addEventListener('cart:change', refreshCartBadge, { signal });
}

function initAddToCart(signal: AbortSignal) {
  const button = $('[data-add-to-cart]');
  const box = $('[data-product]');
  if (!button || !box) return;

  const radios = $$<HTMLInputElement>('input[name="talle"]');
  const hint = $('[data-size-hint]');
  const done = $('[data-cart-added]');

  button.addEventListener(
    'click',
    () => {
      const size = radios.find((r) => r.checked)?.value ?? null;
      if (radios.length && !size) {
        hint?.removeAttribute('hidden');
        radios.find((r) => !r.disabled)?.focus();
        return;
      }
      hint?.setAttribute('hidden', '');
      addToCart({
        slug: box.dataset.productSlug ?? '',
        title: box.dataset.productTitle ?? '',
        price: Number(box.dataset.productPrice ?? 0),
        size,
        image: box.dataset.productImage ?? '',
      });
      done?.removeAttribute('hidden');
    },
    { signal },
  );
}

/* ------------------------------------------------------------------
   Página /carrito: render desde localStorage
------------------------------------------------------------------- */
const fmt = (n: number) => `$${n.toFixed(2)} USD`;

function renderCartPage() {
  const root = $('[data-cart-page]');
  if (!root) return;

  const list = $('[data-cart-items]', root);
  const empty = $('[data-cart-empty]', root);
  const summary = $('[data-cart-summary]', root);
  const totalEl = $('[data-cart-total]', root);
  if (!list || !empty || !summary) return;

  const items = getCart();
  list.innerHTML = '';
  empty.toggleAttribute('hidden', items.length > 0);
  summary.toggleAttribute('hidden', items.length === 0);

  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-5 border-b border-line py-6';
    row.innerHTML = `
      <a href="/producto/${item.slug}" class="block w-20 shrink-0">
        <img src="${cdnImage(item.image, 200)}" alt="" class="aspect-[3/4] w-full object-cover" />
      </a>
      <div class="min-w-0 flex-1">
        <a href="/producto/${item.slug}" class="caps u-link">${item.title}</a>
        ${item.size ? `<p class="caps mt-1 text-stone">TALLE ${item.size}</p>` : ''}
        <p class="caps mt-1 text-stone">${fmt(item.price)}</p>
      </div>
      <div class="flex items-center gap-3">
        <button type="button" data-qty-minus class="caps flex h-9 w-9 items-center justify-center border border-line hover:border-ink" aria-label="Restar uno">−</button>
        <span class="caps w-5 text-center">${item.qty}</span>
        <button type="button" data-qty-plus class="caps flex h-9 w-9 items-center justify-center border border-line hover:border-ink" aria-label="Sumar uno">+</button>
      </div>
      <p class="caps w-24 text-right">${fmt(item.price * item.qty)}</p>
      <button type="button" data-remove class="caps text-stone hover:text-ink" aria-label="Quitar ${item.title}">✕</button>
    `;
    row.querySelector('[data-qty-minus]')?.addEventListener('click', () => {
      setQty(item.slug, item.size, item.qty - 1);
      renderCartPage();
    });
    row.querySelector('[data-qty-plus]')?.addEventListener('click', () => {
      setQty(item.slug, item.size, item.qty + 1);
      renderCartPage();
    });
    row.querySelector('[data-remove]')?.addEventListener('click', () => {
      setQty(item.slug, item.size, 0);
      renderCartPage();
    });
    list.appendChild(row);
  }

  if (totalEl) totalEl.textContent = fmt(cartTotal());
}

/* ------------------------------------------------------------------
   Página /checkout: resumen + creación del pedido
------------------------------------------------------------------- */
function initCheckout(signal: AbortSignal) {
  const form = $<HTMLFormElement>('#checkout-form');
  if (!form) return;

  const items = getCart();
  if (items.length === 0) {
    window.location.replace('/carrito');
    return;
  }

  // Resumen
  const list = $('[data-checkout-items]');
  if (list) {
    list.innerHTML = items
      .map(
        (i) => `
        <li class="flex justify-between gap-4 border-b border-line py-3">
          <span class="caps">${i.title}${i.size ? ` — ${i.size}` : ''} ×${i.qty}</span>
          <span class="caps text-stone">${fmt(i.price * i.qty)}</span>
        </li>`,
      )
      .join('');
  }

  // Totales: envío configurable + cupón — misma lógica que el servidor.
  const config = $('#checkout-config');
  const shippingCost = Number(config?.dataset.shippingCost ?? 0);
  const freeFrom = Number(config?.dataset.freeFrom ?? 0);
  let coupon: CouponInfo | null = null;

  const renderTotals = () => {
    const totals = computeTotals({
      subtotal: cartTotal(),
      shippingCost,
      freeShippingFrom: freeFrom,
      coupon,
    });
    const set = (sel: string, value: string) => {
      const el = $(sel);
      if (el) el.textContent = value;
    };
    set('[data-checkout-subtotal]', fmt(totals.subtotal));
    set('[data-checkout-shipping]', totals.shipping === 0 ? 'GRATIS' : fmt(totals.shipping));
    set('[data-checkout-discount]', `−${fmt(totals.discount)}`);
    set('[data-checkout-total]', fmt(totals.total));
    $('[data-checkout-discount-row]')?.toggleAttribute('hidden', totals.discount === 0);
  };
  renderTotals();

  // Cupón
  const couponInput = $<HTMLInputElement>('[data-coupon-input]');
  const couponMsg = $('[data-coupon-msg]');
  $('[data-coupon-apply]')?.addEventListener(
    'click',
    async () => {
      const code = couponInput?.value.trim().toUpperCase();
      if (!code) return;
      couponMsg?.setAttribute('hidden', '');
      try {
        const res = await fetch(`/api/coupon?code=${encodeURIComponent(code)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Cupón no válido');
        coupon = { code: json.code, type: json.type, value: json.value, minTotal: json.minTotal };
        if (couponMsg) {
          const applies = cartTotal() >= coupon.minTotal;
          couponMsg.textContent = applies
            ? `✓ CUPÓN ${coupon.code} APLICADO`
            : `EL CUPÓN REQUIERE UNA COMPRA MÍNIMA DE ${fmt(coupon.minTotal)}`;
          couponMsg.removeAttribute('hidden');
        }
      } catch (err) {
        coupon = null;
        if (couponMsg) {
          couponMsg.textContent = (err instanceof Error ? err.message : 'CUPÓN NO VÁLIDO').toUpperCase();
          couponMsg.removeAttribute('hidden');
        }
      }
      renderTotals();
    },
    { signal },
  );

  const errorEl = $('[data-checkout-error]');
  const submit = $<HTMLButtonElement>('button[type="submit"]', form);

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      errorEl?.setAttribute('hidden', '');
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'ENVIANDO…';
      }
      const data = new FormData(form);
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer: {
              name: data.get('name'),
              phone: data.get('phone'),
              email: data.get('email'),
              cedula: data.get('cedula'),
              province: data.get('province'),
              address: data.get('address'),
              addressReference: data.get('addressReference'),
              city: data.get('city'),
              notes: data.get('notes'),
            },
            items: getCart().map((i) => ({ slug: i.slug, size: i.size, qty: i.qty })),
            coupon: coupon?.code ?? '',
            // De dónde vino el cliente la primera vez (para atribuir la venta).
            attribution: storedAttribution(),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'No pudimos crear tu pedido.');
        clearCart();
        window.location.href = `/pedido/${json.code}`;
      } catch (err) {
        if (errorEl) {
          errorEl.textContent =
            err instanceof Error ? err.message.toUpperCase() : 'ERROR — INTENTA DE NUEVO';
          errorEl.removeAttribute('hidden');
        }
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'CONFIRMAR PEDIDO';
        }
      }
    },
    { signal },
  );
}

/* ------------------------------------------------------------------
   Página /pedido/[code]: subir comprobante de transferencia
------------------------------------------------------------------- */
function initReceiptUpload(signal: AbortSignal) {
  const form = $<HTMLFormElement>('#receipt-form');
  if (!form) return;

  const errorEl = $('[data-receipt-error]');
  const submit = $<HTMLButtonElement>('button[type="submit"]', form);

  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      errorEl?.setAttribute('hidden', '');
      if (submit) {
        submit.disabled = true;
        submit.textContent = 'SUBIENDO…';
      }
      try {
        const res = await fetch('/api/comprobante', { method: 'POST', body: new FormData(form) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'No pudimos subir el comprobante.');
        window.location.reload();
      } catch (err) {
        if (errorEl) {
          errorEl.textContent =
            err instanceof Error ? err.message.toUpperCase() : 'ERROR — INTENTA DE NUEVO';
          errorEl.removeAttribute('hidden');
        }
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'ENVIAR COMPROBANTE';
        }
      }
    },
    { signal },
  );
}

/* ------------------------------------------------------------------
   Newsletter: confirmación inline, sin backend
------------------------------------------------------------------- */
function initNewsletter(signal: AbortSignal) {
  const form = $<HTMLFormElement>('#newsletter-form');
  if (!form) return;
  form.addEventListener(
    'submit',
    async (e) => {
      e.preventDefault();
      const email = (form.elements.namedItem('email') as HTMLInputElement | null)?.value;
      try {
        await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
      } catch {
        /* la confirmación visual no depende del backend */
      }
      const done = $('[data-newsletter-done]');
      form.setAttribute('hidden', '');
      done?.removeAttribute('hidden');
    },
    { signal },
  );
}

/* ------------------------------------------------------------------
   Accesibilidad: con reduced-motion, los clips no se reproducen solos
------------------------------------------------------------------- */
function initReducedMotionVideos() {
  if (!reduced()) return;
  $$<HTMLVideoElement>('video[autoplay]').forEach((v) => {
    v.removeAttribute('autoplay');
    v.pause();
    v.setAttribute('controls', '');
  });
}

/* ------------------------------------------------------------------
   Ciclo de vida
------------------------------------------------------------------- */
/* ------------------------------------------------------------------
   Analítica propia — sin cookies, solo agregados en el servidor.
   Además guarda el origen de la PRIMERA visita (first-touch) para poder
   atribuir después el pedido a la campaña que realmente lo trajo.
------------------------------------------------------------------- */
const ATTR_KEY = 'enigma:attr';
const SESSION_KEY = 'enigma:session';

type Attr = { source: string; medium: string; campaign: string };

/** Origen guardado de la primera visita, si lo hay. */
export function storedAttribution(): Attr | null {
  try {
    const raw = localStorage.getItem(ATTR_KEY);
    return raw ? (JSON.parse(raw) as Attr) : null;
  } catch {
    return null;
  }
}

function captureAttribution() {
  try {
    // No se pisa: el primer origen es el que trajo al cliente.
    if (localStorage.getItem(ATTR_KEY)) return;

    const p = new URLSearchParams(location.search);
    const utm = p.get('utm_source');
    let attr: Attr;

    if (utm) {
      attr = {
        source: utm.toLowerCase(),
        medium: (p.get('utm_medium') ?? 'cpc').toLowerCase(),
        campaign: (p.get('utm_campaign') ?? '').toLowerCase(),
      };
    } else if (document.referrer && !document.referrer.includes(location.hostname)) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, '');
      attr = { source: host.toLowerCase(), medium: 'referido', campaign: '' };
    } else {
      attr = { source: 'directo', medium: 'directo', campaign: '' };
    }

    localStorage.setItem(ATTR_KEY, JSON.stringify(attr));
  } catch {
    /* sin localStorage: se pierde la atribución, nada más */
  }
}

function trackPageview() {
  let isSession = false;
  try {
    isSession = !sessionStorage.getItem(SESSION_KEY);
    if (isSession) sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* sessionStorage no disponible */
  }

  const payload = JSON.stringify({
    path: location.pathname,
    q: location.search.replace(/^\?/, ''),
    ref: document.referrer || '',
    s: isSession,
  });

  try {
    // sendBeacon no bloquea la navegación ni retrasa el render.
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/hit', new Blob([payload], { type: 'application/json' }));
    } else {
      void fetch('/api/hit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    /* la analítica jamás debe romper la página */
  }
}

function initPage() {
  abort = new AbortController();
  captureAttribution();
  trackPageview();
  initLenis();
  initHeader(abort.signal);
  initMenu(abort.signal);
  initPreloader();
  initScrollAnimations();
  initCatalog(abort.signal);
  initProduct(abort.signal);
  initCartBadge(abort.signal);
  initAddToCart(abort.signal);
  renderCartPage();
  initCheckout(abort.signal);
  initReceiptUpload(abort.signal);
  initNewsletter(abort.signal);
  initReducedMotionVideos();
  // Recalcular posiciones cuando las fuentes terminan de cargar
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

function cleanup() {
  abort?.abort();
  abort = null;
  ScrollTrigger.getAll().forEach((t) => t.kill());
  ctx?.revert();
  ctx = null;
  if (rafTick) {
    gsap.ticker.remove(rafTick);
    rafTick = null;
  }
  lenis?.destroy();
  lenis = null;
  document.documentElement.removeAttribute('data-menu-open');
}

// `astro:after-swap` corre antes del primer paint del documento nuevo:
// aquí se restauran las clases de estado para que el CSS de animación
// (html.js …) aplique sin flash.
document.addEventListener('astro:after-swap', () => {
  document.documentElement.classList.add('js');
  document.documentElement.classList.remove('is-scrolled');
  try {
    if (sessionStorage.getItem(PRELOADER_KEY)) {
      document.documentElement.setAttribute('data-preloader', 'done');
    }
  } catch {
    /* sessionStorage no disponible */
  }
});
document.addEventListener('astro:page-load', initPage);
document.addEventListener('astro:before-swap', cleanup);
