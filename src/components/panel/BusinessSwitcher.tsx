"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { selectBusinessAction } from "@/server/actions/panel";

export function BusinessSwitcher({ current, options }: { current: { id: string; name: string; status: string }; options: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-left transition-colors hover:bg-slate-100">
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold tracking-widest text-muted uppercase">Lavadero</span>
          <span className="block truncate font-display text-sm font-semibold text-ink">{current.name}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" />
      </button>
      {open && (
        <div className="absolute inset-x-0 z-50 mt-1 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-pop">
          {options.map((o) => (
            <form key={o.id} action={selectBusinessAction.bind(null, o.id)}>
              <button className={`w-full truncate px-3 py-2 text-left text-sm hover:bg-slate-50 ${o.id === current.id ? "font-semibold text-primary" : "text-ink-soft"}`}>{o.name}</button>
            </form>
          ))}
          <Link href="/panel/nuevo" className="flex items-center gap-2 border-t border-line px-3 py-2 text-sm text-ink-soft hover:bg-slate-50">
            <Plus className="size-4" /> Agregar otro lavadero
          </Link>
        </div>
      )}
    </div>
  );
}
