"use client";

import { Download, Printer } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/Button";

export function PosterActions({ pngDataUrl, fileName }: { pngDataUrl: string; fileName: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button icon={<Printer className="size-4" />} onClick={() => window.print()}>
        Imprimir cartel
      </Button>
      <a href={pngDataUrl} download={fileName} className={buttonClass("secondary", "md")}>
        <Download className="size-4" /> Descargar solo el QR
      </a>
    </div>
  );
}
