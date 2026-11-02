import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

declare module "next-auth" {
  interface Session {
    user: { id: string; isSuperAdmin: boolean } & DefaultSession["user"];
  }
}

/**
 * Login de desarrollo (sin Google): solo existe si AUTH_DEV_LOGIN=true y NO estamos en producción.
 * Sirve para probar la app en local sin configurar credenciales de Google.
 */
/** Dueño de Lavafy: siempre es super admin, además de los mails de SUPER_ADMIN_EMAILS. */
const OWNER_EMAILS = ["lopezmoraignacio@gmail.com"];

function isSuperAdminEmail(email: unknown): boolean {
  if (typeof email !== "string" || !email) return false;
  const list = [...OWNER_EMAILS, ...(process.env.SUPER_ADMIN_EMAILS ?? "").toLowerCase().split(",").map((e) => e.trim())];
  return list.includes(email.toLowerCase());
}

export const devLoginEnabled = process.env.AUTH_DEV_LOGIN === "true" && process.env.NODE_ENV !== "production";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    // El adapter espera estas tablas; las nuestras usan snake_case en la base.
    usersTable: users as never,
    accountsTable: accounts as never,
    sessionsTable: sessions as never,
    verificationTokensTable: verificationTokens as never,
  }),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 60 },
  pages: { signIn: "/ingresar" },
  trustHost: true,
  providers: [
    Google,
    ...(devLoginEnabled
      ? [
          Credentials({
            id: "dev",
            name: "Dev",
            credentials: { email: {}, name: {} },
            async authorize(credentials) {
              const email = String(credentials?.email ?? "").toLowerCase().trim();
              if (!email) return null;
              const name = String(credentials?.name ?? "") || email.split("@")[0];
              const [existing] = await db.select().from(users).where(eq(users.email, email));
              if (existing) return existing;
              const [created] = await db.insert(users).values({ email, name, emailVerified: new Date() }).returning();
              return created;
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        const [row] = await db.select({ isSuperAdmin: users.isSuperAdmin, email: users.email }).from(users).where(eq(users.id, user.id));
        token.dbSuperAdmin = Boolean(row?.isSuperAdmin);
        if (row?.email) token.email = row.email;
      }
      // Se recalcula en cada request: si cambiás SUPER_ADMIN_EMAILS no hace falta volver a iniciar sesión.
      token.isSuperAdmin = Boolean(token.dbSuperAdmin) || isSuperAdminEmail(token.email);
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
      return session;
    },
  },
});
