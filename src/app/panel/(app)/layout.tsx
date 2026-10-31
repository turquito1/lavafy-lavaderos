import Link from "next/link";
import { Suspense } from "react";
import { and, eq, gte, sql } from "drizzle-orm";
import { ExternalLink, LogOut } from "lucide-react";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { Logo } from "@/components/ui/Logo";
import { Skeleton } from "@/components/ui/Spinner";
import { BottomNav, SidebarNav } from "@/components/panel/PanelNav";
import { BusinessSwitcher } from "@/components/panel/BusinessSwitcher";
import { getMyBusinesses, requireBusiness } from "@/server/session";
import { signOutAction } from "@/server/actions/auth";
import { LivePanel } from "@/components/panel/LivePanel";

export default function PanelLayout({ children }: LayoutProps<"/panel">) {
  return (
    <div className="flex min-h-dvh bg-bg print:block print:bg-white">
      <LivePanel />
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-64 print:hidden shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="border-b border-line p-5">
          <Link href="/" className="mb-5 inline-block">
            <Logo size={30} textClassName="text-lg" />
          </Link>
          <Suspense fallback={<Skeleton className="h-14" />}>
            <SidebarBusiness />
          </Suspense>
        </div>
        <Suspense fallback={<SidebarNav />}>
          <SidebarNavWithCount />
        </Suspense>
        <div className="border-t border-line p-3">
          <Suspense fallback={null}>
            <SidebarUser />
          </Suspense>
        </div>
      </aside>

      {/* Barra superior mobile */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-[52px] items-center justify-between border-b border-line bg-white px-4 shadow-soft md:hidden print:hidden">
        <Link href="/">
          <Logo size={26} textClassName="text-base" />
        </Link>
        <Suspense fallback={null}>
          <MobileBusinessName />
        </Suspense>
      </div>

      <main className="min-w-0 flex-1 pt-[52px] pb-[calc(64px+env(safe-area-inset-bottom))] md:pt-0 md:pb-0 print:p-0">{children}</main>

      <Suspense fallback={<BottomNav />}>
        <BottomNavWithCount />
      </Suspense>
    </div>
  );
}

async function pendingCount() {
  const { business } = await requireBusiness();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookings)
    .where(and(eq(bookings.businessId, business.id), eq(bookings.status, "pending"), gte(bookings.endsAt, new Date())));
  return count;
}

async function SidebarNavWithCount() {
  return <SidebarNav pendingCount={await pendingCount()} />;
}
async function BottomNavWithCount() {
  return <BottomNav pendingCount={await pendingCount()} />;
}

async function SidebarBusiness() {
  const { user, business } = await requireBusiness();
  const mine = await getMyBusinesses(user.id);
  return (
    <div className="space-y-2">
      <BusinessSwitcher current={{ id: business.id, name: business.name, status: business.status }} options={mine.map((m) => ({ id: m.business.id, name: m.business.name }))} />
      <Link href={`/${business.slug}`} target="_blank" className="flex items-center gap-1.5 px-1 text-xs font-medium text-primary hover:underline">
        <ExternalLink className="size-3.5" /> Ver mi página pública
      </Link>
      {business.status !== "active" && (
        <Link href="/panel/configuracion#publicacion" className="block rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {business.status === "suspended" ? "Lavadero suspendido" : "Sin publicar · los clientes todavía no te ven"}
        </Link>
      )}
    </div>
  );
}

async function MobileBusinessName() {
  const { business } = await requireBusiness();
  return (
    <Link href={`/${business.slug}`} target="_blank" className="flex max-w-[55%] items-center gap-1 truncate text-xs font-medium text-ink-soft">
      <span className="truncate">{business.name}</span>
      <ExternalLink className="size-3 shrink-0" />
    </Link>
  );
}

async function SidebarUser() {
  const { user } = await requireBusiness();
  return (
    <>
      <div className="mb-1 px-3 py-2">
        <p className="truncate text-xs font-medium text-ink">{user.name || user.email}</p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </div>
      <form action={signOutAction}>
        <button className="group flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium text-muted transition-all hover:bg-red-50 hover:text-red-600">
          <LogOut className="size-[17px]" /> Cerrar sesión
        </button>
      </form>
    </>
  );
}
