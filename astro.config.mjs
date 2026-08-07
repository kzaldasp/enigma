// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// Dominio público (canonical, OG, JSON-LD, sitemap). PUBLIC_SITE_URL lo puede
// sobreescribir en Vercel; el default es el dominio real de la marca.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://enigma593.com',
  // SSR: el catálogo y los textos viven en Turso y se leen por request
  // (con caché de 60 s en src/lib/db.ts).
  output: 'server',
  adapter: vercel(),
  // El check de origin de Astro bloquea los multipart detrás del proxy de
  // Vercel (sube comprobantes). Los endpoints validan sus propios datos.
  security: { checkOrigin: false },
  vite: {
    // @tailwindcss/vite depende de vite 7 y astro 5 fija vite 6: hay dos
    // copias de Vite en node_modules, así que sus tipos `Plugin` no encajan
    // aunque en runtime son compatibles. El cast silencia ese falso positivo
    // de `astro check` sin forzar versiones (un override de vite rompería
    // vitest, que también pide la 7). Se puede quitar cuando astro suba a
    // vite 7 y quede una sola copia.
    plugins: [/** @type {any} */ (tailwindcss())],
  },
});
