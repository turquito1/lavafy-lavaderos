"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

/**
 * Panel modal: en celular es una hoja que sube desde abajo; en desktop, un diálogo centrado.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // onClose suele ser una función nueva en cada render (ej. () => setForm(null)). La guardamos en un ref
  // para que el efecto de abajo corra solo al abrir/cerrar y no en cada tecla que se escribe.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Foco en la ventana al abrir, salvo que un campo ya lo haya tomado (autoFocus).
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 animate-fade-in bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative flex max-h-[92dvh] w-full animate-slide-up flex-col rounded-t-3xl bg-white shadow-pop outline-none md:max-h-[85vh] md:rounded-2xl",
          size === "sm" && "md:max-w-md",
          size === "md" && "md:max-w-lg",
          size === "lg" && "md:max-w-2xl",
        )}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" />
        <div className="flex items-start justify-between gap-4 px-5 pt-3 pb-3 md:pt-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="-mr-1 rounded-lg p-1.5 text-muted transition-colors hover:bg-slate-100 hover:text-ink" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="pb-safe border-t border-line bg-white px-5 py-3 md:rounded-b-2xl">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
