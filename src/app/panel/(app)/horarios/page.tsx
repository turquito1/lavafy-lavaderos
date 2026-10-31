import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/Card";
import { PageSkeleton } from "@/components/ui/Spinner";
import { ExceptionsManager, WeeklyHoursEditor } from "@/components/panel/HoursEditor";
import { SetupChecklist } from "@/components/panel/SetupChecklist";
import { requireBusiness } from "@/server/session";
import { getUpcomingExceptions, getWeeklyHours } from "@/server/queries";
import { todayStr } from "@/lib/time";

export const metadata: Metadata = { title: "Horarios" };

export default function HoursPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { business } = await requireBusiness();
  const [weekly, exceptions] = await Promise.all([getWeeklyHours(business.id), getUpcomingExceptions(business)]);
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <SetupChecklist />
      <PageHeader title="Horarios" description="Los turnos online solo se ofrecen dentro de estos horarios y terminan antes del cierre." />
      <WeeklyHoursEditor key={JSON.stringify(weekly)} initial={weekly} />
      <ExceptionsManager exceptions={exceptions} today={todayStr(business.timezone)} />
    </div>
  );
}
