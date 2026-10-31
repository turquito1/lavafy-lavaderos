"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { adminSetBusinessStatusAction } from "@/server/actions/panel";

export function AdminStatusSelect({ businessId, status }: { businessId: string; status: "active" | "draft" | "suspended" }) {
  const [pending, start] = useTransition();
  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) =>
        start(async () => {
          const res = await adminSetBusinessStatusAction(businessId, e.target.value as typeof status);
          if (res.ok) toast.success("Estado actualizado");
          else toast.error(res.error);
        })
      }
      className="h-9 rounded-lg border border-line bg-white px-2 text-sm"
    >
      <option value="active">Publicado</option>
      <option value="draft">Borrador</option>
      <option value="suspended">Suspendido</option>
    </select>
  );
}
