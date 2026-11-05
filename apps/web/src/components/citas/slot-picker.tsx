"use client";

import { CalendarDays, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api-client";
import {
  DIAS,
  diaSemana,
  formatDia,
  formatHora,
  hoyRd,
  sumarDias,
  type Disponibilidad,
  type Slot,
} from "@/lib/citas";
import { cn } from "@/lib/utils";

const DIAS_MAX = 90;

interface SlotPickerProps {
  medicoId: string;
  diasSemana: number[];
  value: Slot | null;
  onChange: (slot: Slot | null) => void;
  /** Turno actual de la cita (al reprogramar se marca como "actual") */
  actual?: string;
}

/**
 * Elegir fecha y hora: tira con los próximos días de atención del médico y un
 * selector de fecha; muestra solo como elegibles los turnos libres.
 */
export function SlotPicker({
  medicoId,
  diasSemana: dias,
  value,
  onChange,
  actual,
}: SlotPickerProps) {
  const hoy = hoyRd();
  const maximo = sumarDias(hoy, DIAS_MAX);
  const proximos = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; out.length < 10 && i < 30; i++) {
      const f = sumarDias(hoy, i);
      if (dias.includes(diaSemana(f))) out.push(f);
    }
    return out;
  }, [hoy, dias]);

  const [fecha, setFecha] = useState<string>(proximos[0] ?? hoy);
  const [data, setData] = useState<Disponibilidad | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0);

  useEffect(() => {
    const id = ++req.current;
    setLoading(true);
    setError(null);
    api<Disponibilidad>(`/medicos/${medicoId}/disponibilidad?fecha=${fecha}`)
      .then((d) => id === req.current && setData(d))
      .catch(
        (e) =>
          id === req.current &&
          setError(e instanceof ApiError ? e.message : "No se pudo cargar la disponibilidad."),
      )
      .finally(() => id === req.current && setLoading(false));
  }, [medicoId, fecha]);

  function elegirFecha(f: string) {
    setFecha(f);
    onChange(null);
  }

  const libres = data?.slots.filter((s) => s.disponible).length ?? 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-brand-dark">Fecha</Label>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {proximos.map((f) => {
            const d = new Date(`${f}T12:00:00Z`);
            const activo = f === fecha;
            return (
              <button
                key={f}
                type="button"
                onClick={() => elegirFecha(f)}
                aria-pressed={activo}
                className={cn(
                  "flex min-w-16 flex-col items-center rounded-xl border px-3 py-2 text-sm transition-colors",
                  activo
                    ? "border-brand bg-brand text-white shadow-sm"
                    : "bg-white hover:border-brand/60 hover:bg-brand-soft",
                )}
              >
                <span className={cn("text-xs", activo ? "text-white/80" : "text-muted-foreground")}>
                  {DIAS[diaSemana(f)]}
                </span>
                <span className="text-lg leading-tight font-bold">{d.getUTCDate()}</span>
                <span className={cn("text-xs", activo ? "text-white/80" : "text-muted-foreground")}>
                  {d.toLocaleDateString("es-DO", { month: "short", timeZone: "UTC" })}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-muted-foreground" />
          <Input
            type="date"
            value={fecha}
            min={hoy}
            max={maximo}
            onChange={(e) => e.target.value && elegirFecha(e.target.value)}
            className="h-10 w-auto rounded-xl bg-background"
            aria-label="Otra fecha"
          />
          <span className="text-xs text-muted-foreground">
            Hasta {DIAS_MAX} días de anticipación.
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-brand-dark">Hora · {formatDia(fecha)}</Label>
          {data?.atiende && !loading && (
            <span className="text-xs text-muted-foreground">
              {libres} {libres === 1 ? "turno libre" : "turnos libres"}
            </span>
          )}
        </div>
        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Buscando turnos…
          </p>
        ) : error ? (
          <p className="py-2 text-sm text-destructive">{error}</p>
        ) : !data?.atiende ? (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            El médico no atiende este día. Elige otra fecha.
          </p>
        ) : libres === 0 ? (
          <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            No quedan turnos libres este día. Elige otra fecha.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {data.slots.map((s) => {
              const elegido = value?.fechaHora === s.fechaHora;
              const esActual =
                actual && new Date(actual).getTime() === new Date(s.fechaHora).getTime();
              return (
                <button
                  key={s.fechaHora}
                  type="button"
                  disabled={!s.disponible}
                  onClick={() => onChange(s)}
                  aria-pressed={elegido}
                  title={
                    esActual
                      ? "Horario actual de la cita"
                      : s.disponible
                        ? undefined
                        : `No disponible (${s.motivo})`
                  }
                  className={cn(
                    "rounded-xl border px-2 py-2 text-sm font-medium transition-colors",
                    elegido
                      ? "border-brand bg-brand text-white shadow-sm"
                      : s.disponible
                        ? "bg-white hover:border-brand/60 hover:bg-brand-soft"
                        : "cursor-not-allowed border-dashed bg-muted/50 text-muted-foreground/60 line-through",
                    esActual && "border-warning no-underline",
                  )}
                >
                  {formatHora(s.fechaHora)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
