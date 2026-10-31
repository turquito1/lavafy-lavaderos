import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { GoogleButton } from "@/components/site/GoogleButton";
import { devLoginEnabled } from "@/auth";
import { signInDev } from "@/server/actions/auth";
import { getSessionUser } from "@/server/session";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Ingresar" };

export default function LoginPage({ searchParams }: PageProps<"/ingresar">) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gradient-to-br from-[#F0F7FF] via-white to-bg px-4 py-10">
      <div className="pointer-events-none absolute -top-40 -right-40 size-[500px] rounded-full bg-[radial-gradient(circle,#DBEAFE_0%,transparent_70%)] opacity-60" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo size={44} textClassName="text-2xl" />
        </Link>
        <div className="rounded-2xl border border-line bg-white p-6 shadow-card">
          <h1 className="text-center text-xl font-bold">Ingresá a Lavafy</h1>
          <p className="mt-1.5 mb-6 text-center text-sm text-ink-soft">Usamos tu cuenta de Google para validar tus turnos. No hace falta crear contraseña.</p>
          <Suspense fallback={<div className="h-12 animate-pulse rounded-xl bg-slate-100" />}>
            <LoginButtons searchParams={searchParams} />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Al continuar aceptás los{" "}
          <Link href="/terminos" className="underline hover:text-primary">términos</Link> y la{" "}
          <Link href="/privacidad" className="underline hover:text-primary">política de privacidad</Link> de Lavafy.
        </p>
      </div>
    </main>
  );
}

async function LoginButtons({ searchParams }: { searchParams: PageProps<"/ingresar">["searchParams"] }) {
  const sp = await searchParams;
  const callbackUrl = typeof sp.callbackUrl === "string" && sp.callbackUrl.startsWith("/") ? sp.callbackUrl : "/";
  const user = await getSessionUser();
  if (user) redirect(callbackUrl);
  return (
    <div className="space-y-4">
      {sp.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">No pudimos iniciar sesión. Probá de nuevo.</p>}
      <GoogleButton callbackUrl={callbackUrl} />
      {devLoginEnabled && <DevLogin callbackUrl={callbackUrl} />}
    </div>
  );
}

function DevLogin({ callbackUrl }: { callbackUrl: string }) {
  return (
    <form action={signInDev} className="space-y-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-800">Login de desarrollo (solo local)</p>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <Input name="email" type="email" placeholder="email@prueba.com" required />
      <Input name="name" placeholder="Nombre (opcional)" />
      <Button type="submit" variant="secondary" className="w-full">
        Entrar sin Google
      </Button>
    </form>
  );
}
