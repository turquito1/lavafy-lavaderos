"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CalendarCheck, ChevronDown, LayoutDashboard, LogOut, Shield, Store } from "lucide-react";
import { signOutAction } from "@/server/actions/auth";
import type { SessionUser } from "@/server/session";

export function UserMenu({ user, hasBusiness }: { user: SessionUser; hasBusiness: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initial = (user.name?.[0] ?? user.email?.[0] ?? "?").toUpperCase();
  const item = "flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-soft transition-colors hover:bg-slate-50";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-line hover:bg-slate-50"
        aria-expanded={open}
        aria-label="Menú de cuenta"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{initial}</span>
        )}
        <ChevronDown className={`size-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 animate-fade-in overflow-hidden rounded-xl border border-line bg-white py-1 shadow-pop">
          <div className="border-b border-line px-4 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">{user.name || "Mi cuenta"}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <Link href="/mis-turnos" className={item} onClick={() => setOpen(false)}>
            <CalendarCheck className="size-4 text-muted" /> Mis turnos
          </Link>
          {hasBusiness ? (
            <Link href="/panel" className={item} onClick={() => setOpen(false)}>
              <LayoutDashboard className="size-4 text-muted" /> Panel del lavadero
            </Link>
          ) : (
            <Link href="/panel/nuevo" className={item} onClick={() => setOpen(false)}>
              <Store className="size-4 text-muted" /> Registrar mi lavadero
            </Link>
          )}
          {user.isSuperAdmin && (
            <Link href="/admin" className={item} onClick={() => setOpen(false)}>
              <Shield className="size-4 text-muted" /> Administración
            </Link>
          )}
          <form action={signOutAction}>
            <button className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50">
              <LogOut className="size-4" /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
