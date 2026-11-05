import type { Metadata } from "next";
import { CitasTable } from "@/components/citas/citas-table";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Agenda del centro" };

export default function AgendaPage() {
  return (
    <>
      <PageHeader
        title="Agenda del centro"
        description="Citas de tu centro: confírmalas, reprográmalas, ciérralas o cancélalas."
      />
      <CitasTable basePath="/centro/agenda" />
    </>
  );
}
