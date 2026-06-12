/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** URL libsql: archivo local en dev, Turso en producción. */
  readonly DATABASE_URL: string;
  readonly DATABASE_AUTH_TOKEN: string;
  /** cloudinary://KEY:SECRET@CLOUD — vacío en dev = guardado local. */
  readonly CLOUDINARY_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
