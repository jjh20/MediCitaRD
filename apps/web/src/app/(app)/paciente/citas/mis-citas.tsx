"use client";

import { CalendarPlus, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EstadoBadge } from "@/components/citas/estado-badge";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api-client";
import {
  ESTADO_INFO,
  formatDop,
  formatHora,
  RD_TZ,
  TIPO_LABELS,
  type Cita,
  type Page,
} from "@/lib/citas";
import { cn } from "@/lib/utils";

type Vista = "proximas" | "historial";

const VISTAS: Record<Vista, { estado: string; orden: "asc" | "desc"; vacio: string }> = {
  proximas: {
    estado: "PENDIENTE,CONFIRMADA",
    orden: "asc",
    vacio: "No tienes citas próximas.",
  },
  historial: {
    estado: "ATENDIDA,NO_ASISTIO,CANCELADA",
    orden: "desc",
    vacio: "Todavía no tienes citas en tu historial.",
  },
};

const fmtDia = new Intl.DateTimeFormat("es-DO", { timeZone: RD_TZ, day: "numeric" });
const fmtMes = new Intl.DateTimeFormat("es-DO", { timeZone: RD_TZ, month: "short" });
const fmtSemana = new Intl.DateTimeFormat("es-DO", { timeZone: RD_TZ, weekday: "long" });

export function MisCitas() {
  const [vista, setVista] = useState<Vista>("proximas");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<Cita> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vigente = true;
    setLoading(true);
    const { estado, orden } = VISTAS[vista];
    api<Page<Cita>>(`/citas?estado=${estado}&orden=${orden}&page=${page}&pageSize=8`)
      .then((r) => vigente && setData(r))
      .catch((e) =>
        toast.error(e instanceof ApiError ? e.message : "No se pudieron cargar tus citas."),
      )
      .finally(() => vigente && setLoading(false));
    return () => {
      vigente = false;
    };
  }, [vista, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={vista}
          onValueChange={(v) => {
            setVista(v as Vista);
            setPage(1);
            setData(null);
          }}
        >
          <TabsList className="h-11 rounded-xl bg-white p-1 shadow-sm">
            <TabsTrigger
              value="proximas"
              className="rounded-lg px-4 data-[state=active]:bg-brand data-[state=active]:text-white"
            >
              Próximas
            </TabsTrigger>
            <TabsTrigger
              value="historial"
              className="rounded-lg px-4 data-[state=active]:bg-brand data-[state=active]:text-white"
            >
              Historial
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button asChild className="h-11 rounded-xl">
          <Link href="/paciente/buscar-medico">
            <CalendarPlus className="size-4" /> Agendar cita
          </Link>
        </Button>
      </div>

      {loading && !data ? (
        <Card className="flex-row items-center justify-center gap-2 rounded-2xl border-none p-10 text-muted-foreground shadow-sm">
          <Loader2 className="size-4 animate-spin" /> Cargando tus citas…
        </Card>
      ) : data && data.items.length === 0 ? (
        <Card className="items-center gap-3 rounded-2xl border-none p-10 text-center shadow-sm">
          <p className="text-muted-foreground">{VISTAS[vista].vacio}</p>
          {vista === "proximas" && (
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/paciente/buscar-medico">Buscar un médico</Link>
            </Button>
          )}
        </Card>
      ) : (
        data && (
          <div className={cn("space-y-3 transition-opacity", loading && "opacity-60")}>
            {data.items.map((c) => (
              <Link key={c.id} href={`/paciente/citas/${c.id}`} className="group block">
                <Card className="flex-row items-center gap-4 rounded-2xl border-none p-4 shadow-sm transition-shadow group-hover:shadow-md">
                  <div
                    className={cn(
                      "flex w-16 shrink-0 flex-col items-center rounded-xl border-l-4 bg-muted py-2",
                      {
                        PENDIENTE: "border-warning",
                        CONFIRMADA: "border-brand",
                        ATENDIDA: "border-success",
                        NO_ASISTIO: "border-slate-400",
                        CANCELADA: "border-destructive",
                      }[c.estado],
                    )}
                  >
                    <span className="text-2xl leading-none font-bold text-brand-dark">
                      {fmtDia.format(new Date(c.fechaHora))}
                    </span>
                    <span className="text-xs text-muted-foreground uppercase">
                      {fmtMes.format(new Date(c.fechaHora))}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-brand-dark">{c.medico.nombre}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.medico.especialidad} · {TIPO_LABELS[c.tipo]}
                    </p>
                    <p className="text-sm text-muted-foreground first-letter:uppercase">
                      {fmtSemana.format(new Date(c.fechaHora))}, {formatHora(c.fechaHora)} ·{" "}
                      {c.centro.fullName}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <EstadoBadge estado={c.estado} />
                    <span className="text-sm font-medium text-brand-dark tabular-nums">
                      {formatDop(c.costo)}
                    </span>
                  </div>
                  <ChevronRight className="hidden size-5 text-muted-foreground group-hover:text-brand sm:block" />
                </Card>
              </Link>
            ))}
            {data.total > data.pageSize && (
              <Card className="gap-0 rounded-2xl border-none py-0 shadow-sm">
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  total={data.total}
                  onChange={setPage}
                />
              </Card>
            )}
          </div>
        )
      )}
      <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.values(ESTADO_INFO).map((e) => (
          <span key={e.label} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", e.dot)} /> {e.label}
          </span>
        ))}
      </p>
    </div>
  );
}
