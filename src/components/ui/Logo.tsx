import Image from "next/image";
import { cn } from "@/lib/format";

export function Logo({ size = 32, withText = true, className, textClassName }: { size?: number; withText?: boolean; className?: string; textClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src="/logo-128.webp" alt="Lavafy" width={size} height={size} priority className="block object-contain" />
      {withText && <span className={cn("font-display text-xl leading-none font-bold text-ink", textClassName)}>Lavafy</span>}
    </span>
  );
}
