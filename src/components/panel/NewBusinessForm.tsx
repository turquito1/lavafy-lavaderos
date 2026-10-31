"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { checkSlugAction, createBusinessAction, suggestSlugAction } from "@/server/actions/panel";
import { slugify } from "@/lib/format";

export function NewBusinessForm({ host }: { host: string }) {
  const [state, action, pending] = useActionState(createBusinessAction, null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [checked, setChecked] = useState<{ slug: string; available: boolean; error?: string } | null>(null);
  const slugStatus: { checking: boolean; available?: boolean; error?: string } =
    !slug ? { checking: false } : checked?.slug === slug ? { checking: false, available: checked.available, error: checked.error } : { checking: true };
  const [capacity, setCapacity] = useState(2);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sugerir link a partir del nombre (hasta que lo edite a mano).
  useEffect(() => {
    if (slugTouched || name.trim().length < 2) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => setSlug(await suggestSlugAction(name)), 350);
    return () => clearTimeout(timer.current);
  }, [name, slugTouched]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await checkSlugAction(slug);
      if (!cancelled) setChecked({ slug, ...res });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [slug]);

  return (
    <form action={action} className="space-y-5">
      <Field label="Nombre del lavadero" htmlFor="name">
        <Input id="name" name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Lavadero El Turco" autoFocus />
      </Field>

      <Field
        label="Tu link para compartir"
        htmlFor="slug"
        error={slugStatus.error}
        hint={slugStatus.available ? <span className="font-medium text-emerald-600">¡Disponible!</span> : "Lo vas a mandar por WhatsApp e Instagram para que te saquen turno."}
      >
        <div className="flex h-12 items-center overflow-hidden rounded-[10px] border border-line bg-white focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15 md:h-11">
          <span className="shrink-0 border-r border-line bg-slate-50 px-3 text-sm text-muted">{host}/</span>
          <input
            id="slug"
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value.replace(/\s/g, "-")) + (e.target.value.endsWith("-") ? "-" : ""));
            }}
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-ink focus:outline-none"
            placeholder="mi-lavadero"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <span className="pr-3">
            {slugStatus.checking ? <Spinner className="size-4 text-muted" /> : slugStatus.available ? <Check className="size-4 text-success" /> : slug ? <X className="size-4 text-red-500" /> : null}
          </span>
        </div>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Dirección" htmlFor="address">
          <Input id="address" name="address" required placeholder="Av. Colón 1234" autoComplete="street-address" />
        </Field>
        <Field label="Ciudad" htmlFor="city">
          <Input id="city" name="city" required placeholder="Córdoba" defaultValue="Córdoba" />
        </Field>
      </div>
      <input type="hidden" name="province" value="Córdoba" />

      <Field label="Teléfono / WhatsApp del lavadero" htmlFor="phone" hint="Opcional. Se muestra en tu página para que te escriban.">
        <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="351 123 4567" />
      </Field>

      <Field label="¿Cuántos autos podés lavar al mismo tiempo?" hint="Es la capacidad: Lavafy nunca da más turnos simultáneos que esto. Lo podés cambiar cuando quieras.">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setCapacity((c) => Math.max(1, c - 1))} className="flex size-12 items-center justify-center rounded-xl border border-line bg-white text-ink-soft hover:bg-slate-50" aria-label="Menos">
            <Minus className="size-5" />
          </button>
          <span className="w-16 text-center font-display text-3xl font-extrabold text-ink">{capacity}</span>
          <button type="button" onClick={() => setCapacity((c) => Math.min(50, c + 1))} className="flex size-12 items-center justify-center rounded-xl border border-line bg-white text-ink-soft hover:bg-slate-50" aria-label="Más">
            <Plus className="size-5" />
          </button>
          <span className="text-sm text-muted">{capacity === 1 ? "auto a la vez" : "autos a la vez"}</span>
        </div>
        <input type="hidden" name="capacity" value={capacity} />
      </Field>

      {state && !state.ok && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}

      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={slugStatus.available === false}>
        Crear mi lavadero
      </Button>
      <p className="text-center text-xs text-muted">30 días gratis. Después elegís un plan. Sin tarjeta.</p>
    </form>
  );
}
