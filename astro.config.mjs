// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// Dominio público (canonical, OG, JSON-LD, sitemap). Cuando tengan dominio
// propio basta definir PUBLIC_SITE_URL en Vercel y redesplegar.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? 'https://enigma-1nor.vercel.app',
  // SSR: el catálogo y los textos viven en Turso y se leen por request
  // (con caché de 60 s en src/lib/db.ts).
  output: 'server',
  adapter: vercel(),
  // El check de origin de Astro bloquea los multipart detrás del proxy de
  // Vercel (sube comprobantes). Los endpoints validan sus propios datos.
  security: { checkOrigin: false },
  vite: {
    plugins: [tailwindcss()],
  },
});
