/**
 * Guardado de imágenes.
 *  - Producción (o si hay BLOB_READ_WRITE_TOKEN): Vercel Blob.
 *  - Desarrollo sin token: carpeta local public/uploads (para probar sin configurar nada).
 *
 * Las imágenes llegan ya achicadas desde el navegador (src/lib/image-resize.ts).
 */
import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);
const LOCAL_PREFIX = "/uploads/";

export class StorageError extends Error {}

export function storageMode(): "blob" | "local" | "none" {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.NODE_ENV !== "production") return "local";
  return "none";
}

/** Valida y guarda la imagen; devuelve la URL pública. `pathname` sin extensión, ej. "businesses/<id>/logo". */
export async function saveImage(pathname: string, file: File): Promise<string> {
  if (!(file instanceof File) || file.size === 0) throw new StorageError("Elegí una imagen.");
  if (!ALLOWED_TYPES.has(file.type)) throw new StorageError("Formato no soportado. Usá JPG, PNG o WebP.");
  if (file.size > MAX_IMAGE_BYTES) throw new StorageError("La imagen es demasiado pesada.");
  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];

  const mode = storageMode();
  if (mode === "blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(`${pathname}.${ext}`, file, { access: "public", addRandomSuffix: true, contentType: file.type });
    return blob.url;
  }
  if (mode === "local") {
    const name = `${pathname}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const target = path.join(process.cwd(), "public", "uploads", name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await file.arrayBuffer()));
    return `${LOCAL_PREFIX}${name}`;
  }
  throw new StorageError("La subida de imágenes no está configurada. En Vercel: Storage → Blob → conectalo al proyecto y hacé Redeploy.");
}

/** Borra una imagen guardada antes. Nunca rompe el flujo si falla (a lo sumo queda un archivo huérfano). */
export async function deleteImage(url: string | null | undefined): Promise<void> {
  if (!url) return;
  try {
    if (url.startsWith(LOCAL_PREFIX)) {
      const target = path.join(process.cwd(), "public", url);
      if (target.startsWith(path.join(process.cwd(), "public", "uploads"))) await unlink(target);
      return;
    }
    if (url.includes(".blob.vercel-storage.com") && process.env.BLOB_READ_WRITE_TOKEN) {
      const { del } = await import("@vercel/blob");
      await del(url);
    }
  } catch (err) {
    console.warn("[storage] no se pudo borrar", url, err);
  }
}
