import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogOut, Plus } from "lucide-react";
import { Card, CardHeader, PageHeader } from "@/components/ui/Card";
import { PageSkeleton } from "@/components/ui/Spinner";
import { ImagesForm, LocationForm, ProfileForm, PublishCard, RulesForm } from "@/components/panel/SettingsForms";
import { SetupChecklist } from "@/components/panel/SetupChecklist";
import { getMyBusinesses, requireBusiness } from "@/server/session";
import { signOutAction } from "@/server/actions/auth";
import { selectBusinessAction } from "@/server/actions/panel";

export const metadata: Metadata = { title: "Configuración" };

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { user, business } = await requireBusiness();
  const mine = await getMyBusinesses(user.id);
  const appUrl = (process.env.APP_URL ?? "https://lavafy.com.ar").replace(/\/$/, "");
  const host = appUrl.replace(/^https?:\/\//, "");
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <SetupChecklist />
      <PageHeader title="Configuración" description={business.name} />
      <PublishCard business={business} appUrl={appUrl} />
      <RulesForm business={business} />
      <ProfileForm business={business} host={host} />
      <ImagesForm business={business} uploadsEnabled={!!process.env.BLOB_READ_WRITE_TOKEN} />
      <LocationForm business={business} />

      <Card>
        <CardHeader title="Cuenta" description={user.email ?? undefined} />
        <div className="space-y-1 px-3 py-3">
          {mine.length > 1 &&
            mine
              .filter((m) => m.business.id !== business.id)
              .map((m) => (
                <form key={m.business.id} action={selectBusinessAction.bind(null, m.business.id)}>
                  <button className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-ink-soft hover:bg-slate-50">Cambiar a {m.business.name}</button>
                </form>
              ))}
          <Link href="/panel/nuevo" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-ink-soft hover:bg-slate-50">
            <Plus className="size-4" /> Agregar otro lavadero
          </Link>
          <form action={signOutAction}>
            <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-red-600 hover:bg-red-50">
              <LogOut className="size-4" /> Cerrar sesión
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
