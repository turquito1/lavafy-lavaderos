"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ExternalLink, LayoutDashboard, RefreshCw } from "lucide-react";
import { adminResetDemoAction } from "@/server/actions/panel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

type DemoInfo = { bookings: number; updatedAt: Date } | null;

/** Super admin: crear o regenerar el lavadero demo para mostrarle Lavafy a los dueños. */
export function AdminDemoCard({ demo, defaultPhone }: { demo: DemoInfo; defaultPhone: string }) {
  const [phone, setPhone] = useState(defaultPhone);
  const [pending, start] = useTransition();

  const reset = () =>
    start(async () => {
      const res = await adminResetDemoAction(phone);
      if (res.ok) toast.success(`Demo lista: ${res.data.bookings} turnos, ${res.data.today} para hoy.`);
      else toast.error(res.error);
    });

  return (
    <Card className="mb-6 p-5">
      <CardHeader
        title="Lavadero demo"
        description={
          demo
            ? `lavafy.com.ar/demo · ${demo.bookings} turnos · generada el ${demo.updatedAt.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Cordoba" })}`
            : "Todavía no existe. Creala para mostrarle Lavafy a los lavaderos."
        }
      />
      <p className="mt-2 text-sm text-ink-soft">
        Arma una semana de turnos para atrás y otra para adelante, con los estados según la hora de ahora. Regenerala antes de cada visita. No aparece en el buscador y no
        manda mails.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field label="Celular de los clientes de prueba" htmlFor="demo-phone" hint="Los botones de WhatsApp de la demo le escriben a este número. Poné el tuyo." className="min-w-0">
          <Input id="demo-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="351 123 4567" />
        </Field>
        <Button onClick={reset} loading={pending} icon={<RefreshCw className="size-4" />}>
          {demo ? "Regenerar demo" : "Crear demo"}
        </Button>
      </div>
      {demo && (
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/demo" variant="secondary" size="sm" icon={<ExternalLink className="size-4" />}>
            Ver página pública
          </ButtonLink>
          <ButtonLink href="/panel/agenda" variant="secondary" size="sm" icon={<LayoutDashboard className="size-4" />}>
            Ver panel
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}
