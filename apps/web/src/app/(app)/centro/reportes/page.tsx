import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ReporteView } from "@/components/reportes/reporte-view";

export const metadata: Metadata = { title: "Reportes" };

export default function ReportesCentroPage() {
  return (
    <>
      <PageHeader
        title="Reportes"
        description="Totales, tasas e ingresos de las citas de tu centro."
      />
      <ReporteView admin={false} basePath="/centro/reportes" />
    </>
  );
}
