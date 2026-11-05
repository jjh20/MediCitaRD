import { Badge } from "@/components/ui/badge";
import { ESTADO_INFO, type EstadoCita } from "@/lib/citas";
import { cn } from "@/lib/utils";

export function EstadoBadge({ estado, className }: { estado: EstadoCita; className?: string }) {
  const info = ESTADO_INFO[estado];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 rounded-full border-none px-2.5 py-1", info.badge, className)}
    >
      <span className={cn("size-1.5 rounded-full", info.dot)} aria-hidden />
      {info.label}
    </Badge>
  );
}
