import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, businesses } from "@/db/schema";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Card, PageHeader } from "@/components/ui/Card";
import { PageSkeleton } from "@/components/ui/Spinner";
import { AdminStatusSelect } from "@/components/panel/AdminStatusSelect";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Administración", robots: { index: false } };

export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <Suspense fallback={<PageSkeleton />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await requireUser("/admin");
  if (!user.isSuperAdmin) notFound();
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      city: businesses.city,
      status: businesses.status,
      plan: businesses.plan,
      trialEndsAt: businesses.trialEndsAt,
      createdAt: businesses.createdAt,
      owner: sql<string | null>`(select u.email from business_members m join users u on u.id = m.user_id where m.business_id = "businesses"."id" and m.role = 'owner' limit 1)`,
      bookings30d: sql<number>`(select count(*)::int from bookings bk where bk.business_id = "businesses"."id" and bk.created_at > now() - interval '30 days')`,
    })
    .from(businesses)
    .orderBy(desc(businesses.createdAt));
  const [{ totalBookings }] = await db.select({ totalBookings: sql<number>`count(*)::int` }).from(bookings).where(eq(bookings.source, "online"));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <PageHeader title="Administración" description={`${rows.length} lavaderos · ${totalBookings} turnos online en total`} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted uppercase">
            <tr>
              <th className="px-4 py-3">Lavadero</th>
              <th className="px-4 py-3">Dueño</th>
              <th className="px-4 py-3">Turnos 30d</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3">
                  <Link href={`/${b.slug}`} className="font-semibold text-ink hover:text-primary">
                    {b.name}
                  </Link>
                  <p className="text-xs text-muted">
                    /{b.slug} · {b.city}
                  </p>
                </td>
                <td className="px-4 py-3 text-ink-soft">{b.owner}</td>
                <td className="px-4 py-3 font-semibold">{b.bookings30d}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {b.plan}
                  {b.trialEndsAt && <p className="text-xs text-muted">hasta {b.trialEndsAt.toLocaleDateString("es-AR")}</p>}
                </td>
                <td className="px-4 py-3">
                  <AdminStatusSelect businessId={b.id} status={b.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
