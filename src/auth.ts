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
        const adminEmails = (process.env.SUPER_ADMIN_EMAILS ?? "").toLowerCase().split(",").map((e) => e.trim());
        token.isSuperAdmin = Boolean(row?.isSuperAdmin || (row?.email && adminEmails.includes(row.email.toLowerCase())));
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.isSuperAdmin = Boolean(token.isSuperAdmin);
      return session;
    },
  },
});
