import type { Metadata } from "next";
import { CitasTable } from "@/components/citas/citas-table";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Operaciones" };

export default function OperacionesPage() {
  return (
    <>
      <PageHeader
        title="Operaciones"
        description="Todas las citas de la plataforma, con filtros por estado, fecha, centro y médico."
      />
      <CitasTable basePath="/admin/operaciones" admin />
    </>
  );
}
