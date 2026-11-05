import type { Metadata } from "next";
import { ReporteImprimible } from "@/components/reportes/reporte-imprimible";

export const metadata: Metadata = { title: "Reporte imprimible" };

export default async function ReporteImprimibleAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReporteImprimible searchParams={await searchParams} alcance="Todos los centros" />;
}
