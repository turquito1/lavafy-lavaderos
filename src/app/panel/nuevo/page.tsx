import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Spinner";
import { NewBusinessForm } from "@/components/panel/NewBusinessForm";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Registrá tu lavadero" };

export default function NewBusinessPage() {
  return (
    <main className="min-h-dvh bg-gradient-to-br from-[#F0F7FF] via-white to-bg px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/">
            <Logo size={34} />
          </Link>
          <Link href="/panel" className="flex items-center gap-1 text-sm font-medium text-ink-soft hover:text-primary">
            <ArrowLeft className="size-4" /> Panel
          </Link>
        </div>
        <h1 className="text-3xl font-extrabold">Sumá tu lavadero a Lavafy</h1>
        <p className="mt-2 mb-6 text-ink-soft">En 2 minutos tenés tu página para recibir turnos online. Después cargás servicios, precios y horarios.</p>
        <Card className="p-5 sm:p-6">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <Gate />
          </Suspense>
        </Card>
      </div>
    </main>
  );
}

async function Gate() {
  await requireUser("/panel/nuevo");
  const host = (process.env.APP_URL ?? "lavafy.com.ar").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return <NewBusinessForm host={host} />;
}
