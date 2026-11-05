import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { BuscarMedico } from "./buscar-medico";

export const metadata: Metadata = { title: "Buscar médico" };

export default function BuscarMedicoPage() {
  return (
    <>
      <PageHeader
        title="Buscar médico"
        description="Encuentra un especialista, elige un horario libre y agenda tu cita."
      />
      <BuscarMedico />
    </>
  );
}
