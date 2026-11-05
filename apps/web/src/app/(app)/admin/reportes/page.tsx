import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ReporteView } from "@/components/reportes/reporte-view";

export const metadata: Metadata = { title: "Reportes" };

export default function ReportesAdminPage() {
  return (
    <>
      <PageHeader
        title="Reportes"
        description="Totales, tasas e ingresos de todas las citas de la plataforma."
      />
      <ReporteView admin basePath="/admin/reportes" />
    </>
  );
}
