import {
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  CheckCircle2,
  Pencil,
  Repeat,
  type LucideIcon,
} from "lucide-react";
import {
  ACCION_LABELS,
  ESTADO_INFO,
  formatFechaHora,
  TIPO_LABELS,
  type AccionCita,
  type HistorialItem,
  type TipoCita,
} from "@/lib/citas";
import { cn } from "@/lib/utils";
import { EstadoBadge } from "./estado-badge";

const ICONOS: Record<AccionCita, { icon: LucideIcon; tone: string }> = {
  CREADA: { icon: CalendarPlus, tone: "bg-brand-soft text-brand" },
  ACTUALIZADA: { icon: Pencil, tone: "bg-muted text-muted-foreground" },
  REPROGRAMADA: { icon: Repeat, tone: "bg-warning/20 text-[#8a5d00]" },
  CONFIRMADA: { icon: CalendarCheck, tone: "bg-brand-soft text-brand" },
  CERRADA: { icon: CheckCircle2, tone: "bg-success/15 text-success" },
  CANCELADA: { icon: CalendarX, tone: "bg-destructive/10 text-destructive" },
};

const CAMPOS: Record<string, string> = {
  fechaHora: "Fecha y hora",
  motivo: "Motivo",
  tipo: "Tipo",
  notasCierre: "Notas de cierre",
  motivoCancelacion: "Motivo de cancelación",
};

const ROLES: Record<string, string> = {
  PACIENTE: "Paciente",
  CENTRO_MEDICO: "Centro médico",
  ADMIN: "Administrador",
};

function valor(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (campo === "fechaHora" && typeof v === "string") return formatFechaHora(v);
  if (campo === "tipo" && typeof v === "string") return TIPO_LABELS[v as TipoCita] ?? v;
  return String(v);
}

/** Historial de cambios de la cita, del más antiguo al más reciente. */
export function HistorialTimeline({ items }: { items: HistorialItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>;
  }
  return (
    <ol className="relative space-y-5">
      {items.map((h, i) => {
        const { icon: Icon, tone } = ICONOS[h.accion];
        const cambios = Object.entries(h.cambios ?? {}).filter(
          ([campo]) => campo !== "notasCierre" && campo !== "motivoCancelacion",
        );
        return (
          <li key={h.id} className="relative flex gap-3">
            {i < items.length - 1 && (
              <span
                className="absolute top-9 bottom-[-1.25rem] left-[1.05rem] w-px bg-border"
                aria-hidden
              />
            )}
            <span className={cn("z-10 grid size-9 shrink-0 place-items-center rounded-full", tone)}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="font-semibold text-brand-dark">{ACCION_LABELS[h.accion]}</p>
                {h.estadoNuevo && h.estadoAnterior !== h.estadoNuevo && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {h.estadoAnterior && (
                      <>
                        <span
                          className={
                            ESTADO_INFO[h.estadoAnterior].badge + " rounded-full px-2 py-0.5"
                          }
                        >
                          {ESTADO_INFO[h.estadoAnterior].label}
                        </span>
                        →
                      </>
                    )}
                    <EstadoBadge estado={h.estadoNuevo} className="py-0.5" />
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatFechaHora(h.createdAt)}
                {h.usuario && (
                  <>
                    {" · "}
                    {h.usuario.fullName} ({ROLES[h.usuario.role] ?? h.usuario.role})
                  </>
                )}
              </p>
              {cambios.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-sm">
                  {cambios.map(([campo, c]) => (
                    <li key={campo}>
                      <span className="text-muted-foreground">{CAMPOS[campo] ?? campo}: </span>
                      <span className="line-through decoration-muted-foreground/60">
                        {valor(campo, c.antes)}
                      </span>{" "}
                      → <span className="font-medium">{valor(campo, c.despues)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {h.comentario && (
                <p className="rounded-lg bg-muted px-3 py-2 text-sm text-brand-dark">
                  {h.comentario}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
