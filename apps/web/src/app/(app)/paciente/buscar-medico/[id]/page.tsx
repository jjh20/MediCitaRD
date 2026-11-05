import type { Metadata } from "next";
import { apiServer } from "@/lib/api-server";
import type { Medico } from "@/lib/citas";
import { AgendarCita } from "./agendar-cita";

export const metadata: Metadata = { title: "Agendar cita" };

export default async function PerfilMedicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const medico = await apiServer<Medico>(`/medicos/${encodeURIComponent(id)}`);
  return <AgendarCita medico={medico} />;
}
