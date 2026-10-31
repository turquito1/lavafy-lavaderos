import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { businessMembers, businesses, type Business } from "@/db/schema";

export type SessionUser = { id: string; name: string | null; email: string | null; image: string | null; isSuperAdmin: boolean };

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Marca la ruta como dinámica antes de que Auth.js use crypto (requisito de Cache Components).
  await connection();
  const session = await auth();
  if (!session?.user?.id) return null;
  const { id, name, email, image, isSuperAdmin } = session.user;
  return { id, name: name ?? null, email: email ?? null, image: image ?? null, isSuperAdmin };
});

export async function requireUser(callbackUrl: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/ingresar?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return user;
}

export const BUSINESS_COOKIE = "lavafy_business";

export const getMyBusinesses = cache(async (userId: string) => {
  return db
    .select({ business: businesses, role: businessMembers.role })
    .from(businessMembers)
    .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
    .where(eq(businessMembers.userId, userId))
    .orderBy(asc(businesses.createdAt));
});

/** Lavadero activo del usuario (el elegido en la cookie, o el primero). null si no tiene ninguno. */
export async function getCurrentBusiness(userId: string): Promise<{ business: Business; role: "owner" | "staff" } | null> {
  const mine = await getMyBusinesses(userId);
  if (mine.length === 0) return null;
  const selected = (await cookies()).get(BUSINESS_COOKIE)?.value;
  const current = mine.find((m) => m.business.id === selected) ?? mine[0];
  return { business: current.business, role: current.role };
}

/** Lavadero activo del panel. Redirige al login o al alta si hace falta. */
export const requireBusiness = cache(async (): Promise<{ user: SessionUser; business: Business; role: "owner" | "staff" }> => {
  const user = await requireUser("/panel");
  const current = await getCurrentBusiness(user.id);
  if (!current) redirect("/panel/nuevo");
  return { user, ...current };
});

/** Para server actions: verifica que el usuario sea miembro del lavadero. */
export async function assertBusinessMember(userId: string, businessId: string) {
  const [m] = await db
    .select({ role: businessMembers.role })
    .from(businessMembers)
    .where(and(eq(businessMembers.userId, userId), eq(businessMembers.businessId, businessId)));
  if (!m) throw new Error("No tenés acceso a este lavadero");
  return m.role;
}
