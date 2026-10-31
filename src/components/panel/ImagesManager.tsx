"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ImagePlus, Images, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { deletePhotoAction, movePhotoAction, removeImageAction, uploadImageAction, uploadPhotoAction } from "@/server/actions/panel";
import { resizeImage } from "@/lib/image-resize";
import { MAX_PHOTOS } from "@/lib/constants";
import { cn } from "@/lib/format";

type Photo = { id: string; url: string; width: number | null; height: number | null };

export function ImagesManager({
  logoUrl,
  coverUrl,
  photos,
  uploadsEnabled,
}: {
  logoUrl: string | null;
  coverUrl: string | null;
  photos: Photo[];
  uploadsEnabled: boolean;
}) {
  return (
    <Card id="imagenes" className="scroll-mt-20">
      <CardHeader title="Imágenes" description="Lo primero que ven tus clientes. Subilas directo desde el celu: las achicamos solas." />
      {!uploadsEnabled && (
        <p className="mx-5 mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          La subida de imágenes no está configurada. En Vercel: <strong>Storage → Blob</strong> → conectalo al proyecto y hacé Redeploy.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-[150px_1fr]">
        <SingleImage kind="logo" label="Logo" hint="Cuadrado" url={logoUrl} enabled={uploadsEnabled} className="aspect-square w-36 sm:w-full" />
        <SingleImage kind="cover" label="Portada" hint="Horizontal, se ve arriba de tu página" url={coverUrl} enabled={uploadsEnabled} className="aspect-[3/1] sm:aspect-auto sm:h-[150px]" />
      </div>
      <div className="border-t border-line px-5 py-4">
        <Gallery photos={photos} enabled={uploadsEnabled} />
      </div>
    </Card>
  );
}

// ─── Logo y portada ───────────────────────────────────────────────────────────

function SingleImage({
  kind,
  label,
  hint,
  url,
  enabled,
  className,
}: {
  kind: "logo" | "cover";
  label: string;
  hint: string;
  url: string | null;
  enabled: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);

  const upload = (original: File) =>
    start(async () => {
      try {
        const { file } = await resizeImage(original, kind === "logo" ? { maxSize: 512, square: true } : { maxSize: 1920 });
        setPreview(URL.createObjectURL(file));
        const fd = new FormData();
        fd.set("kind", kind);
        fd.set("file", file);
        const res = await uploadImageAction(fd);
        if (res.ok) toast.success(`${label} actualizado`);
        else toast.error(res.error);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo subir la imagen");
      } finally {
        setPreview(null);
      }
    });

  const shown = preview ?? url;

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-sm font-medium text-ink-soft">
        {label} <span className="font-normal text-muted">· {hint}</span>
      </p>
      <div className={cn("group relative overflow-hidden rounded-xl border-2 border-dashed border-line bg-slate-50", shown && "border-solid", className)}>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt={label} className="size-full object-cover" />
        ) : (
          <button
            type="button"
            disabled={!enabled || pending}
            onClick={() => input.current?.click()}
            className="flex size-full min-h-24 flex-col items-center justify-center gap-1 text-sm font-medium text-muted transition-colors hover:bg-slate-100 hover:text-primary disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <ImagePlus className="size-6" /> Subir {label.toLowerCase()}
          </button>
        )}
        {pending && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Spinner />
          </div>
        )}
        {url && enabled && !pending && (
          <div className="absolute right-2 bottom-2 flex gap-1">
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
              Cambiar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              aria-label={`Quitar ${label.toLowerCase()}`}
              icon={<Trash2 className="size-4" />}
              onClick={() => start(async () => void (await removeImageAction(kind)))}
            />
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
    </div>
  );
}

// ─── Galería ──────────────────────────────────────────────────────────────────

function Gallery({ photos, enabled }: { photos: Photo[]; enabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ key: string; preview: string }[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();
  const remaining = MAX_PHOTOS - photos.length;

  const uploadMany = async (files: File[]) => {
    if (files.length === 0) return;
    if (remaining <= 0) return toast.error(`Ya tenés ${MAX_PHOTOS} fotos. Borrá alguna para subir otra.`);
    const batch = files.slice(0, remaining);
    if (files.length > batch.length) toast.info(`Subimos ${batch.length} de ${files.length}: el máximo es ${MAX_PHOTOS} fotos.`);
    setProgress({ done: 0, total: batch.length });
    let ok = 0;
    // Una por una: funciona mejor con conexiones lentas del celu.
    for (const [i, original] of batch.entries()) {
      const key = `${Date.now()}-${i}`;
      try {
        const { file, width, height } = await resizeImage(original, { maxSize: 1600 });
        setUploading((u) => [...u, { key, preview: URL.createObjectURL(file) }]);
        const fd = new FormData();
        fd.set("file", file);
        fd.set("width", String(width));
        fd.set("height", String(height));
        const res = await uploadPhotoAction(fd);
        if (res.ok) ok++;
        else toast.error(res.error);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo subir una foto");
      } finally {
        setUploading((u) => u.filter((x) => x.key !== key));
        setProgress({ done: i + 1, total: batch.length });
      }
    }
    setProgress(null);
    if (ok > 0) toast.success(ok === 1 ? "Foto agregada" : `${ok} fotos agregadas`);
  };

  const remove = (id: string) => {
    setBusyId(id);
    start(async () => {
      const res = await deletePhotoAction(id);
      if (!res.ok) toast.error(res.error);
      setBusyId(null);
    });
  };

  const move = (id: string, dir: -1 | 1) => {
    setBusyId(id);
    start(async () => {
      await movePhotoAction(id, dir);
      setBusyId(null);
    });
  };

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <Images className="size-4 text-primary" /> Fotos del lavadero
          </p>
          <p className="text-sm text-muted">El lugar, la fachada, autos que dejaste impecables. Aparecen en tu página.</p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => (
          <div key={p.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`Foto ${i + 1}`} className="size-full object-cover" loading="lazy" />
            {busyId === p.id ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                <Spinner className="size-4" />
              </div>
            ) : (
              enabled && (
                <div className="absolute inset-x-1 bottom-1 flex justify-between">
                  <div className="flex gap-1">
                    <PhotoBtn label="Mover a la izquierda" disabled={i === 0} onClick={() => move(p.id, -1)}>
                      <ChevronLeft className="size-4" />
                    </PhotoBtn>
                    <PhotoBtn label="Mover a la derecha" disabled={i === photos.length - 1} onClick={() => move(p.id, 1)}>
                      <ChevronRight className="size-4" />
                    </PhotoBtn>
                  </div>
                  <PhotoBtn label="Borrar foto" danger onClick={() => remove(p.id)}>
                    <Trash2 className="size-4" />
                  </PhotoBtn>
                </div>
              )
            )}
          </div>
        ))}

        {uploading.map((u) => (
          <div key={u.key} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u.preview} alt="" className="size-full object-cover opacity-50" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner className="size-5 text-primary" />
            </div>
          </div>
        ))}

        {remaining > uploading.length && (
          <button
            type="button"
            disabled={!enabled || !!progress}
            onClick={() => input.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-slate-50 text-xs font-semibold text-muted transition-colors hover:border-primary-border hover:bg-primary-light hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {progress ? (
              <>
                <Spinner className="size-5" /> {progress.done}/{progress.total}
              </>
            ) : (
              <>
                <ImagePlus className="size-6" /> Agregar fotos
              </>
            )}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Podés elegir varias a la vez. Usá las flechas para elegir el orden: la primera es la que más se ve.</p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void uploadMany(files);
        }}
      />
    </div>
  );
}

function PhotoBtn({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg bg-white/90 text-ink-soft shadow-soft backdrop-blur transition-colors disabled:opacity-30 sm:size-7",
        danger ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-white hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
