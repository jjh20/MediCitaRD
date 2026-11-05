import { Logo } from "@/components/brand/logo";
import { apiServer } from "@/lib/api-server";
import { formatDia, formatFechaHora, type Reporte } from "@/lib/citas";
import { PrintButton } from "./print-button";
import { ReporteContenido } from "./reporte-contenido";

/** Vista imprimible del reporte (los filtros llegan por la URL). */
export async function ReporteImprimible({
  searchParams,
  alcance,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  alcance: string;
}) {
  const params = new URLSearchParams();
  for (const k of ["desde", "hasta", "centroId", "medicoId"]) {
    const v = searchParams[k];
    if (typeof v === "string" && v) params.set(k, v);
  }
  const reporte = await apiServer<Reporte>(`/reportes/citas?${params}`);
  const { desde, hasta } = reporte.filtros;
  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none">
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div className="space-y-2">
          <Logo size="sm" />
          <h1 className="text-2xl font-bold text-brand-dark">Reporte de operaciones (citas)</h1>
          <p className="text-sm text-muted-foreground first-letter:uppercase">
            {alcance} · {desde ? formatDia(desde) : "desde el inicio"} al{" "}
            {hasta ? formatDia(hasta) : "hoy en adelante"}
          </p>
          <p className="text-xs text-muted-foreground">
            Generado el {formatFechaHora(reporte.generadoEn)} (hora de RD)
          </p>
        </div>
        <PrintButton />
      </div>
      <ReporteContenido reporte={reporte} />
    </div>
  );
}
