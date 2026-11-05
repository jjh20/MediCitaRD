import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { MedicosManager } from "./medicos-manager";

export const metadata: Metadata = { title: "Médicos y horarios" };

export default function MedicosPage() {
  return (
    <>
      <PageHeader
        title="Médicos y horarios"
        description="Publica los médicos de tu centro, sus horarios de atención y precios."
      />
      <MedicosManager />
    </>
  );
}
