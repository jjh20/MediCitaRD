import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { MisCitas } from "./mis-citas";

export const metadata: Metadata = { title: "Mis citas" };

export default function MisCitasPage() {
  return (
    <>
      <PageHeader
        title="Mis citas"
        description="Consulta y da seguimiento a tus citas y estudios."
      />
      <MisCitas />
    </>
  );
}
