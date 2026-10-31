import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui/Logo";
import { UserMenu } from "./UserMenu";
import { getMyBusinesses, getSessionUser } from "@/server/session";
import { buttonClass } from "@/components/ui/Button";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/80 shadow-soft backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0" aria-label="Lavafy, inicio">
          <Logo size={34} />
        </Link>
        {children}
        <Suspense fallback={<div className="h-9 w-24" />}>
          <HeaderUser />
        </Suspense>
      </div>
    </header>
  );
}

async function HeaderUser() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/panel" className="hidden px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-primary sm:inline">
          Soy lavadero
        </Link>
        <Link href="/ingresar" className={buttonClass("primary", "sm")}>
          Ingresar
        </Link>
      </div>
    );
  }
  const businesses = await getMyBusinesses(user.id);
  return <UserMenu user={user} hasBusiness={businesses.length > 0} />;
}
