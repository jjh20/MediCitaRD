"use client";

import { Download, Loader2, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ErrorBox } from "@/components/citas/error-box";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api-client";
import { hoyRd, sumarDias, type Medico, type Page, type Reporte } from "@/lib/citas";
import { cn } from "@/lib/utils";
import { ReporteContenido } from "./reporte-contenido";

const ALL = "todos";

/** Reporte de operaciones con filtros, descarga CSV y enlace a la vista imprimible. */
export function ReporteView({ admin, basePath }: { admin: boolean; basePath: string }) {
  const hoy = hoyRd();
  const [desde, setDesde] = useState(sumarDias(hoy, -14));
  const [hasta, setHasta] = useState(sumarDias(hoy, 14));
  const [centroId, setCentroId] = useState(ALL);
  const [medicoId, setMedicoId] = useState(ALL);
  const [centros, setCentros] = useState<{ id: string; fullName: string }[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0);

  useEffect(() => {
    if (!admin) return;
    api<Page<{ id: string; fullName: string }>>("/users?role=CENTRO_MEDICO&pageSize=100")
      .then((r) => setCentros(r.items))
      .catch(() => setCentros([]));
  }, [admin]);

  useEffect(() => {
    const p = new URLSearchParams({ pageSize: "100" });
    if (admin && centroId !== ALL) p.set("centroId", centroId);
    api<Page<Medico>>(`/medicos?${p}`)
      .then((r) => setMedicos(r.items))
      .catch(() => setMedicos([]));
  }, [admin, centroId]);

  const params = new URLSearchParams();
  if (desde) params.set("desde", desde);
  if (hasta) params.set("hasta", hasta);
  if (admin && centroId !== ALL) params.set("centroId", centroId);
  if (medicoId !== ALL) params.set("medicoId", medicoId);
  const qs = params.toString();

  useEffect(() => {
    const id = ++req.current;
    setLoading(true);
    setError(null);
    api<Reporte>(`/reportes/citas?${qs}`)
      .then((r) => id === req.current && setReporte(r))
      .catch(
        (e) =>
          id === req.current &&
          setError(e instanceof ApiError ? e.message : "No se pudo generar el reporte."),
      )
      .finally(() => id === req.current && setLoading(false));
  }, [qs]);

  return (
    <div className="space-y-6">
      <Card className="gap-0 rounded-2xl border-none p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <Fecha id="r-desde" label="Desde" value={desde} onChange={setDesde} max={hasta} />
          <Fecha id="r-hasta" label="Hasta" value={hasta} onChange={setHasta} min={desde} />
          {admin && (
            <Filtro
              label="Centro médico"
              value={centroId}
              onChange={(v) => {
                setCentroId(v);
                setMedicoId(ALL);
              }}
            >
              <SelectItem value={ALL}>Todos los centros</SelectItem>
              {centros.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.fullName}
                </SelectItem>
              ))}
            </Filtro>
          )}
          <Filtro label="Médico" value={medicoId} onChange={setMedicoId}>
            <SelectItem value={ALL}>Todos los médicos</SelectItem>
            {medicos.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nombre}
              </SelectItem>
            ))}
          </Filtro>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-10 rounded-xl">
              <Link href={`${basePath}/imprimir?${qs}`} target="_blank">
                <Printer className="size-4" /> Vista imprimible
              </Link>
            </Button>
            <Button asChild className="h-10 rounded-xl">
              <a href={`/api/reportes/citas.csv?${qs}`} download>
                <Download className="size-4" /> Descargar CSV
              </a>
            </Button>
          </div>
        </div>
      </Card>

      <ErrorBox message={error} />
      {loading && !reporte ? (
        <p className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Generando reporte…
        </p>
      ) : (
        reporte && (
          <div className={cn("transition-opacity", loading && "opacity-60")}>
            <ReporteContenido reporte={reporte} />
          </div>
        )
      )}
    </div>
  );
}

function Fecha({
  id,
  label,
  value,
  onChange,
  min,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-auto rounded-xl bg-background"
      />
    </div>
  );
}

function Filtro({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-48 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="!h-10 w-full rounded-xl bg-background" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
