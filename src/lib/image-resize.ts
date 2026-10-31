/**
 * Achica una imagen en el navegador antes de subirla.
 * Una foto de celular (3–8 MB) queda en ~150–400 KB: sube rápido con mala señal
 * y entra en el límite del servidor.
 */
export type ResizedImage = { file: File; width: number; height: number };

type Options = {
  /** Lado más largo en px. */
  maxSize: number;
  /** Recorte cuadrado centrado (para logos). */
  square?: boolean;
  quality?: number;
};

export async function resizeImage(input: File, { maxSize, square = false, quality = 0.82 }: Options): Promise<ResizedImage> {
  if (!input.type.startsWith("image/")) throw new Error("El archivo no es una imagen.");
  const bitmap = await loadBitmap(input);
  try {
    let sx = 0;
    let sy = 0;
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (square) {
      const side = Math.min(sw, sh);
      sx = Math.round((sw - side) / 2);
      sy = Math.round((sh - side) / 2);
      sw = sh = side;
    }
    const scale = Math.min(1, maxSize / Math.max(sw, sh));
    const width = Math.max(1, Math.round(sw * scale));
    const height = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tu navegador no pudo procesar la imagen.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);

    // WebP es más liviano; si el navegador no lo genera (Safari viejo), JPEG.
    let blob = await toBlob(canvas, "image/webp", quality);
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
    if (!blob) throw new Error("No se pudo comprimir la imagen.");
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const base = input.name.replace(/\.[^.]+$/, "") || "foto";
    return { file: new File([blob], `${base}.${ext}`, { type: blob.type }), width, height };
  } finally {
    if ("close" in bitmap) bitmap.close();
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      // Respeta la rotación EXIF de las fotos de celular.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* formato que createImageBitmap no soporta: probamos con <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error("No pudimos leer esa imagen. Probá con una foto JPG o PNG.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
