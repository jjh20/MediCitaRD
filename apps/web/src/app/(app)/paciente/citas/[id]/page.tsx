import type { Metadata } from "next";
import { CitaPage } from "@/components/citas/cita-page";

export const metadata: Metadata = { title: "Detalle de la cita" };

export default async function CitaPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CitaPage id={id} backHref="/paciente/citas" backLabel="Volver a mis citas" />;
}
