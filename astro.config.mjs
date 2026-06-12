// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

// Cambiar por el dominio real antes de desplegar (afecta canonical, OG y JSON-LD).
export default defineConfig({
  site: 'https://enigma.example',
  // SSR: el catálogo y los textos viven en Turso y se leen por request
  // (con caché de 60 s en src/lib/db.ts).
  output: 'server',
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
});
