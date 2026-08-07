# ENIGMA® — sitio de marca

Tienda de la marca de ropa contemporánea **ENIGMA**. Astro 5 (SSR) + Tailwind CSS 4 +
GSAP/ScrollTrigger + Lenis, con View Transitions.

El catálogo y los textos viven en **Turso** y se administran desde el proyecto
hermano **`../enigma-admin`** (Next.js). La compra es por transferencia bancaria:
el cliente arma su bolsa, confirma el pedido, recibe los datos bancarios y sube
su comprobante; el equipo lo valida desde el admin. Es el único camino de compra:
WhatsApp queda solo como canal de contacto y para el aviso «avísenme cuando vuelva»
de las piezas agotadas.

## Arranque

```bash
# 1. Primero prepara la base en ../enigma-admin:
#    cd ../enigma-admin && npm install && npm run migrate && npm run seed

npm install
Copy-Item .env.example .env   # apunta a ../enigma-admin/local.db por defecto
npm run dev                   # http://localhost:4321
```

El admin corre en `http://localhost:3001` (`npm run dev` en `../enigma-admin`).
Ambos comparten la misma base; los cambios del admin se ven en máx. 60 s (caché).

## Configurar antes de publicar

| Qué | Dónde |
| --- | --- |
| WhatsApp, contacto, textos, banco, imágenes del hero y de la marca | Admin → **Contenido del sitio** |
| Catálogo (productos, precios, fotos, stock) | Admin → **Productos** |
| Mostrar u ocultar el lookbook completo | Admin → **Campañas** → «Lookbook en la tienda» |
| Dominio real | `astro.config.mjs` → `site` y `public/robots.txt` |
| Variables de producción | Vercel → `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `CLOUDINARY_URL`, `ADMIN_URL` |

## Estructura

```
src/
  lib/db.ts              Cliente libsql + caché 60 s
  lib/products.ts        Catálogo desde la DB (tipos, novedades, relacionados)
  lib/content.ts         Textos editables (site_content) con defaults
  lib/site.ts            Constantes estructurales: categorías, nav, precios
  lib/upload.ts          Subida de comprobantes (Cloudinary / local en dev)
  lib/images.ts          Imágenes de campaña/categorías (assets locales)
  layouts/Base.astro     SEO, fuentes, View Transitions, header/footer
  components/            Hero, Novedades, Editorial, Categorías, Manifiesto…
  pages/                 /, /catalogo, /producto/[slug], /carrito, /checkout,
                         /pedido/[code], /lookbook, /marca, /legal, 404
  pages/api/orders.ts    POST: crea pedidos (valida precio y stock en DB)
  pages/api/comprobante.ts  POST: sube el comprobante de transferencia
  scripts/app.ts         Movimiento (GSAP + Lenis) y lógica de UI
  scripts/cart.ts        Bolsa en localStorage
public/products/         Imágenes seed del catálogo (las nuevas van a Cloudinary)
```

## Despliegue en Vercel

1. Importa el repo; el adapter `@astrojs/vercel` ya está configurado.
2. Variables: `DATABASE_URL` (libsql://…turso.io), `DATABASE_AUTH_TOKEN`,
   `CLOUDINARY_URL`.
3. El admin se despliega aparte (ver `../enigma-admin/README.md`).
