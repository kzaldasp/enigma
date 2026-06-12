/**
 * Genera los placeholders del sitio: siluetas neutras en escala de grises
 * sobre fondo hueso (#F6F4EF), listas para reemplazar por fotografía real.
 *
 *   node scripts/placeholders.mjs
 *
 * Salida:
 *   src/assets/products/<slug>-01.svg  (pieza flotando)
 *   src/assets/products/<slug>-02.svg  (en modelo, para el crossfade)
 *   src/assets/categories/<cat>.svg
 *   src/assets/campaign/{hero,editorial,marca,lookbook-01..06}.svg
 *   public/og.jpg  (1200×630, vía sharp)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// Tonos placeholder (grises cálidos coherentes con el fondo hueso).
const BONE = '#F6F4EF';
const BONE2 = '#EFECE6';
const T1 = '#E8E5DD'; // relleno principal claro
const T2 = '#DBD7CD'; // relleno medio
const T3 = '#C9C5BA'; // detalle
const STONE = '#8A8780';
// Oscuro (campaña)
const D0 = '#101010';
const D1 = '#171717';
const D2 = '#1E1E1E';
const D3 = '#262626';

const cap = (text, x, y, fill = STONE, size = 21) =>
  `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" letter-spacing="4.5" fill="${fill}">${text}</text>`;

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img">${body}</svg>`;

/* ------------------------------------------------------------------
   Siluetas de prenda (viewBox 900×1200, centradas en x=450)
------------------------------------------------------------------- */
const garments = {
  hoodie: `
    <path d="M450 326c-48 0-88 27-101 67l-11 34-64 24c-27 10-44 36-44 65v310c0 23 18 41 41 41h358c23 0 41-18 41-41V516c0-29-17-55-44-65l-64-24-11-34c-13-40-53-67-101-67Z" fill="${T2}"/>
    <path d="M359 415c0-52 41-93 91-93s91 41 91 93c-27-19-57-29-91-29s-64 10-91 29Z" fill="${T3}"/>
    <rect x="436" y="468" width="9" height="64" rx="4.5" fill="${T3}"/>
    <rect x="458" y="468" width="9" height="64" rx="4.5" fill="${T3}"/>
    <path d="M363 704h174v100c0 13-11 24-24 24H387c-13 0-24-11-24-24V704Z" fill="${T3}" opacity="0.55"/>`,
  tee: `
    <path d="M450 348c-34 0-63 12-81 31l-149 56 36 95 72-23v316c0 18 15 33 33 33h178c18 0 33-15 33-33V507l72 23 36-95-149-56c-18-19-47-31-81-31Z" fill="${T2}"/>
    <path d="M396 352a54 28 0 0 0 108 0c-16-6-35-10-54-10s-38 4-54 10Z" fill="${BONE}"/>`,
  teeBoxy: `
    <path d="M450 352c-40 0-74 13-94 33l-160 52 34 92 84-24v300c0 18 15 33 33 33h206c18 0 33-15 33-33V505l84 24 34-92-160-52c-20-20-54-33-94-33Z" fill="${T2}"/>
    <path d="M394 356a56 28 0 0 0 112 0c-17-6-36-9-56-9s-39 3-56 9Z" fill="${BONE}"/>
    <rect x="386" y="560" width="128" height="128" fill="${T3}" opacity="0.5"/>`,
  shirt: `
    <path d="M450 340c-30 0-56 10-72 27l-136 51 32 86 66-21v330c0 17 14 31 31 31h158c17 0 31-14 31-31V483l66 21 32-86-136-51c-16-17-42-27-72-27Z" fill="${T2}"/>
    <path d="M404 344l46 52 46-52-23-9h-46Z" fill="${T3}"/>
    <rect x="447" y="396" width="6" height="420" fill="${T3}"/>
    <circle cx="450" cy="452" r="5" fill="${T3}"/><circle cx="450" cy="528" r="5" fill="${T3}"/>
    <circle cx="450" cy="604" r="5" fill="${T3}"/><circle cx="450" cy="680" r="5" fill="${T3}"/>`,
  jacket: `
    <path d="M450 332c-46 0-84 24-98 60l-14 36-66 25c-26 10-43 35-43 63v306c0 23 19 42 42 42h358c23 0 42-19 42-42V516c0-28-17-53-43-63l-66-25-14-36c-14-36-52-60-98-60Z" fill="${T2}"/>
    <path d="M392 350h116l-20 38h-76Z" fill="${T3}"/>
    <rect x="446" y="388" width="8" height="448" fill="${T3}"/>
    <rect x="328" y="640" width="84" height="14" rx="7" fill="${T3}" opacity="0.7"/>
    <rect x="488" y="640" width="84" height="14" rx="7" fill="${T3}" opacity="0.7"/>`,
  pants: `
    <rect x="338" y="368" width="224" height="78" fill="${T3}"/>
    <path d="M338 446h106l-16 470c-1 13-12 24-25 24h-64c-14 0-25-12-24-26l23-468Z" fill="${T2}"/>
    <path d="M562 446H456l16 470c1 13 12 24 25 24h64c14 0 25-12 24-26l-23-468Z" fill="${T2}"/>`,
  denim: `
    <rect x="338" y="368" width="224" height="78" fill="${T3}"/>
    <circle cx="450" cy="407" r="7" fill="${STONE}" opacity="0.5"/>
    <path d="M338 446h106l-16 470c-1 13-12 24-25 24h-64c-14 0-25-12-24-26l23-468Z" fill="${T2}"/>
    <path d="M562 446H456l16 470c1 13 12 24 25 24h64c14 0 25-12 24-26l-23-468Z" fill="${T2}"/>
    <path d="M352 470l-18 444" stroke="${T3}" stroke-width="3" fill="none"/>
    <path d="M548 470l18 444" stroke="${T3}" stroke-width="3" fill="none"/>`,
  shorts: `
    <rect x="338" y="400" width="224" height="72" fill="${T3}"/>
    <path d="M338 472h106l-10 270c0 13-11 24-25 24h-58c-14 0-25-12-24-26l11-268Z" fill="${T2}"/>
    <path d="M562 472H456l10 270c0 13 11 24 25 24h58c14 0 25-12 24-26l-11-268Z" fill="${T2}"/>
    <rect x="498" y="510" width="44" height="56" fill="${T3}" opacity="0.6"/>`,
  cap: `
    <path d="M312 596a138 138 0 0 1 276 0v22H312Z" fill="${T2}"/>
    <circle cx="450" cy="462" r="9" fill="${T3}"/>
    <path d="M450 470v126" stroke="${T3}" stroke-width="3"/>
    <ellipse cx="478" cy="630" rx="196" ry="26" fill="${T3}"/>
    <rect x="312" y="596" width="276" height="22" fill="${T2}"/>`,
  tote: `
    <rect x="322" y="520" width="256" height="300" fill="${T2}"/>
    <path d="M384 520v-58a66 56 0 0 1 132 0v58" stroke="${T3}" stroke-width="13" fill="none"/>
    <rect x="322" y="664" width="256" height="3" fill="${T3}" opacity="0.7"/>`,
  scarf: `
    <g transform="rotate(7 450 590)">
      <rect x="398" y="306" width="104" height="552" rx="6" fill="${T2}"/>
      <rect x="430" y="306" width="104" height="500" rx="6" fill="${T3}" opacity="0.55"/>
      <path d="M404 858v34M428 858v34M452 858v34M476 858v34" stroke="${T3}" stroke-width="5"/>
    </g>`,
  belt: `
    <circle cx="450" cy="612" r="168" stroke="${T2}" stroke-width="54" fill="none"/>
    <rect x="586" y="566" width="74" height="92" rx="8" stroke="${T3}" stroke-width="11" fill="none"/>
    <rect x="612" y="600" width="64" height="24" rx="4" fill="${T2}"/>`,
};

/* slug → [silueta, nº de figura para el caption] */
const PRODUCTS = [
  ['hoodie-umbral', 'hoodie', 'superior'],
  ['camiseta-velo', 'tee', 'superior'],
  ['camiseta-cifra', 'teeBoxy', 'superior'],
  ['chaqueta-reverso', 'jacket', 'superior'],
  ['camisa-mutismo', 'shirt', 'superior'],
  ['pantalon-margen', 'pants', 'inferior'],
  ['denim-sombra', 'denim', 'inferior'],
  ['short-pausa', 'shorts', 'inferior'],
  ['gorra-clave', 'cap', 'accesorios'],
  ['tote-archivo', 'tote', 'accesorios'],
  ['bufanda-niebla', 'scarf', 'accesorios'],
  ['cinturon-trazo', 'belt', 'accesorios'],
];

/** Vista 01 — la pieza flotando sobre el fondo hueso de la página. */
const productFront = (silhouette, index) =>
  svg(900, 1200, [
    `<rect width="900" height="1200" fill="${BONE}"/>`,
    garments[silhouette],
    cap(`ENIGMA — FIG. ${String(index + 1).padStart(2, '0')}`, 48, 1150),
  ].join(''));

/** Vista 02 — silueta de figura humana con la prenda puesta. */
function productModel(category, index) {
  const overlays = {
    superior: `<rect x="362" y="332" width="176" height="262" rx="26" fill="${T3}"/>`,
    inferior: `
      <rect x="376" y="560" width="148" height="56" fill="${T3}"/>
      <rect x="396" y="616" width="46" height="330" rx="23" fill="${T3}"/>
      <rect x="458" y="616" width="46" height="330" rx="23" fill="${T3}"/>`,
    accesorios: `
      <path d="M398 232a52 52 0 0 1 104 0v12H398Z" fill="${T3}"/>
      <rect x="540" y="560" width="118" height="146" fill="${T3}"/>
      <path d="M560 560l-62-220" stroke="${T3}" stroke-width="9" fill="none"/>`,
  };
  return svg(900, 1200, [
    `<rect width="900" height="1200" fill="${BONE2}"/>`,
    `<rect x="0" y="1014" width="900" height="2" fill="${T2}"/>`,
    `<circle cx="450" cy="252" r="36" fill="${T2}"/>`,
    `<rect x="372" y="304" width="156" height="420" rx="78" fill="${T2}"/>`,
    `<rect x="396" y="616" width="46" height="356" rx="23" fill="${T2}"/>`,
    `<rect x="458" y="616" width="46" height="356" rx="23" fill="${T2}"/>`,
    overlays[category],
    cap(`ENIGMA — FIG. ${String(index + 1).padStart(2, '0')} / MODELO`, 48, 1150),
  ].join(''));
}

/* ------------------------------------------------------------------
   Campaña (oscuras): composiciones tonales con figura
------------------------------------------------------------------- */
function darkScene(w, h, label, variant = 0) {
  const cx = [w * 0.68, w * 0.32, w * 0.5, w * 0.74, w * 0.26, w * 0.6, w * 0.42][variant % 7];
  const fh = h * 0.62; // alto de la figura
  const fy = h * 0.86 - fh;
  const fw = fh * 0.3;
  return svg(w, h, [
    `<rect width="${w}" height="${h}" fill="${D0}"/>`,
    `<rect x="${w * 0.05}" y="${h * 0.07}" width="${w * 0.9}" height="${h * 0.86}" fill="${D1}"/>`,
    `<ellipse cx="${cx}" cy="${h * 0.88}" rx="${fw * 2.2}" ry="${h * 0.025}" fill="${D0}"/>`,
    `<circle cx="${cx}" cy="${fy - fh * 0.09}" r="${fh * 0.062}" fill="${D3}"/>`,
    `<rect x="${cx - fw / 2}" y="${fy}" width="${fw}" height="${fh * 0.55}" rx="${fw / 2}" fill="${D3}"/>`,
    `<rect x="${cx - fw * 0.32}" y="${fy + fh * 0.52}" width="${fw * 0.26}" height="${fh * 0.48}" rx="${fw * 0.13}" fill="${D2}"/>`,
    `<rect x="${cx + fw * 0.06}" y="${fy + fh * 0.52}" width="${fw * 0.26}" height="${fh * 0.48}" rx="${fw * 0.13}" fill="${D2}"/>`,
    `<rect x="${w * 0.05}" y="${h * 0.62}" width="${w * 0.9}" height="1.5" fill="${D2}"/>`,
    cap(label, w * 0.05 + 36, h * 0.93 - 18, STONE, Math.max(18, w * 0.011)),
  ].join(''));
}

/* ------------------------------------------------------------------
   Categorías (claras, prenda grande)
------------------------------------------------------------------- */
const categoryTile = (silhouette, label) =>
  svg(900, 1125, [
    `<rect width="900" height="1125" fill="${BONE2}"/>`,
    `<g transform="translate(0 -40)">${garments[silhouette]}</g>`,
    cap(`ENIGMA — ${label}`, 48, 1072),
  ].join(''));

/* ------------------------------------------------------------------
   OG image (PNG/JPG vía sharp)
------------------------------------------------------------------- */
const ogSvg = svg(1200, 630, [
  `<rect width="1200" height="630" fill="#0A0A0A"/>`,
  `<rect x="24" y="24" width="1152" height="582" fill="none" stroke="#2A2A2A" stroke-width="1"/>`,
  `<text x="600" y="330" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="150" letter-spacing="2" fill="${BONE}">ENIGMA<tspan font-size="44" dy="-72">®</tspan></text>`,
  `<text x="600" y="420" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="8" fill="${STONE}">NUEVA COLECCIÓN — VERANO 2026</text>`,
].join(''));

/* ------------------------------------------------------------------ */
async function main() {
  const dirs = {
    products: path.join(ROOT, 'src/assets/products'),
    categories: path.join(ROOT, 'src/assets/categories'),
    campaign: path.join(ROOT, 'src/assets/campaign'),
    public: path.join(ROOT, 'public'),
  };
  await Promise.all(Object.values(dirs).map((d) => mkdir(d, { recursive: true })));

  const jobs = [];

  PRODUCTS.forEach(([slug, silhouette, category], i) => {
    jobs.push(writeFile(path.join(dirs.products, `${slug}-01.svg`), productFront(silhouette, i)));
    jobs.push(writeFile(path.join(dirs.products, `${slug}-02.svg`), productModel(category, i)));
  });

  jobs.push(writeFile(path.join(dirs.categories, 'superior.svg'), categoryTile('hoodie', 'PARTE SUPERIOR')));
  jobs.push(writeFile(path.join(dirs.categories, 'inferior.svg'), categoryTile('pants', 'PARTE INFERIOR')));
  jobs.push(writeFile(path.join(dirs.categories, 'accesorios.svg'), categoryTile('tote', 'ACCESORIOS')));

  jobs.push(writeFile(path.join(dirs.campaign, 'hero.svg'), darkScene(2400, 1500, 'ENIGMA — CAMPAÑA VERANO 2026', 0)));
  jobs.push(writeFile(path.join(dirs.campaign, 'editorial.svg'), darkScene(2000, 1250, 'ENIGMA — EDITORIAL 002', 1)));
  jobs.push(writeFile(path.join(dirs.campaign, 'marca.svg'), darkScene(2000, 1250, 'ENIGMA — ATELIER', 4)));
  for (let i = 1; i <= 6; i++) {
    const wide = i % 3 === 0;
    jobs.push(
      writeFile(
        path.join(dirs.campaign, `lookbook-0${i}.svg`),
        darkScene(wide ? 1800 : 1100, wide ? 1200 : 1466, `ENIGMA — LOOK 0${i}`, i),
      ),
    );
  }

  await Promise.all(jobs);

  // OG en JPG real (los scrapers de OG no leen SVG).
  const { default: sharp } = await import('sharp');
  await sharp(Buffer.from(ogSvg)).jpeg({ quality: 86 }).toFile(path.join(dirs.public, 'og.jpg'));

  console.log(`OK — ${PRODUCTS.length * 2} imágenes de producto, 3 categorías, 9 de campaña y og.jpg generados.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
