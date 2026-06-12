import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Sube el comprobante de transferencia y devuelve su URL.
 *  - Con CLOUDINARY_URL: sube firmado a Cloudinary.
 *  - Sin Cloudinary (solo desarrollo): guarda en public/uploads/comprobantes.
 */
export async function uploadReceipt(file: File): Promise<string> {
  const cloudinaryUrl = import.meta.env.CLOUDINARY_URL ?? process.env.CLOUDINARY_URL;
  if (cloudinaryUrl) return uploadToCloudinary(file, cloudinaryUrl);
  return saveLocal(file);
}

async function uploadToCloudinary(file: File, envUrl: string): Promise<string> {
  const parsed = new URL(envUrl); // cloudinary://API_KEY:API_SECRET@CLOUD_NAME
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'enigma/comprobantes';
  const toSign = `folder=${folder}&timestamp=${timestamp}${parsed.password}`;
  const signature = createHash('sha1').update(toSign).digest('hex');

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', parsed.username);
  body.append('timestamp', String(timestamp));
  body.append('folder', folder);
  body.append('signature', signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${parsed.hostname}/image/upload`, {
    method: 'POST',
    body,
  });
  if (!res.ok) throw new Error(`Cloudinary respondió ${res.status}`);
  const json = (await res.json()) as { secure_url: string };
  return json.secure_url;
}

async function saveLocal(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const name = `${Date.now()}-${randomBytes(4).toString('hex')}.${ext || 'jpg'}`;
  const dir = join(process.cwd(), 'public', 'uploads', 'comprobantes');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/comprobantes/${name}`;
}
