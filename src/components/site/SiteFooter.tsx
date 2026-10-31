import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-8">
        <div className="max-w-xs">
          <Logo size={30} />
          <p className="mt-3 text-sm text-ink-soft">Turnos online para lavaderos de autos. Hecho en Córdoba.</p>
        </div>
        <div className="flex gap-12 text-sm">
          <div className="space-y-2">
            <p className="font-semibold text-ink">Clientes</p>
            <Link href="/#lavaderos" className="block text-ink-soft hover:text-primary">Buscar lavaderos</Link>
            <Link href="/mis-turnos" className="block text-ink-soft hover:text-primary">Mis turnos</Link>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-ink">Lavaderos</p>
            <Link href="/panel/nuevo" className="block text-ink-soft hover:text-primary">Registrar mi lavadero</Link>
            <Link href="/panel" className="block text-ink-soft hover:text-primary">Ingresar al panel</Link>
          </div>
        </div>
      </div>
      <p className="border-t border-line py-4 text-center text-xs text-muted">© Lavafy · lavafy.com.ar</p>
    </footer>
  );
}
