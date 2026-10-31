import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const LEGAL_UPDATED = "31 de octubre de 2026";
export const CONTACT_EMAIL = "lopezmoraignacio@gmail.com";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Última actualización: {LEGAL_UPDATED}</p>
        <div className="mt-8 space-y-6 rounded-2xl border border-line bg-white p-6 text-[15px] leading-relaxed text-ink-soft shadow-soft sm:p-8 [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_h2]:mt-8 [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h2:first-child]:mt-0 [&_li]:mt-1 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/privacidad" className="hover:text-primary">Política de privacidad</Link> · <Link href="/terminos" className="hover:text-primary">Términos y condiciones</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
