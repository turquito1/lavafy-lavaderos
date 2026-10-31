import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/Card";
import { PageSkeleton } from "@/components/ui/Spinner";
import { ServicesManager } from "@/components/panel/ServicesManager";
import { SetupChecklist } from "@/components/panel/SetupChecklist";
import { requireBusiness } from "@/server/session";
import { getCatalog } from "@/server/queries";

export const metadata: Metadata = { title: "Servicios y precios" };

export default function ServicesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { business } = await requireBusiness();
  const services = await getCatalog(business.id);
  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
      <SetupChecklist />
      <PageHeader title="Servicios y precios" description="Lo que ofrecés, cuánto sale y cuánto tarda según el vehículo." />
      <ServicesManager services={services} />
    </div>
  );
}
