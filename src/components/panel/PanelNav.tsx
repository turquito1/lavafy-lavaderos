"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Clock, ListChecks, Settings, Tags } from "lucide-react";
import { cn } from "@/lib/format";

export const PANEL_NAV = [
  { href: "/panel/agenda", label: "Agenda", short: "Agenda", icon: CalendarDays },
  { href: "/panel/turnos", label: "Turnos", short: "Turnos", icon: ListChecks },
  { href: "/panel/servicios", label: "Servicios y precios", short: "Servicios", icon: Tags },
  { href: "/panel/horarios", label: "Horarios", short: "Horarios", icon: Clock },
  { href: "/panel/configuracion", label: "Configuración", short: "Ajustes", icon: Settings },
];

export function SidebarNav({ pendingCount }: { pendingCount?: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-0.5 p-3">
      {PANEL_NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-all",
              active ? "bg-primary-light text-primary" : "text-ink-soft hover:bg-slate-50",
            )}
          >
            <item.icon className={cn("size-[17px]", active ? "text-primary" : "text-muted")} />
            <span className="flex-1">{item.label}</span>
            {item.href === "/panel/turnos" && !!pendingCount && (
              <span className="rounded-full bg-amber-400 px-1.5 text-[11px] leading-5 font-bold text-amber-950">{pendingCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ pendingCount }: { pendingCount?: number }) {
  const pathname = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-50 flex border-t border-line bg-white md:hidden">
      {PANEL_NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn("relative flex h-16 flex-1 flex-col items-center justify-center gap-0.5", active ? "text-primary" : "text-muted")}
          >
            <item.icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
            <span className={cn("text-[11px]", active ? "font-semibold" : "font-normal")}>{item.short}</span>
            {item.href === "/panel/turnos" && !!pendingCount && (
              <span className="absolute top-2 left-1/2 ml-2 rounded-full bg-amber-400 px-1.5 text-[10px] leading-4 font-bold text-amber-950">{pendingCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
