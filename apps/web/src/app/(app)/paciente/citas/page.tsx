import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { apiServer } from "@/lib/api-server";

export const metadata: Metadata = { title: "Mis citas" };

export default async function MisCitasPage() {
  const apiCheck = await apiServer<{ modulo: string; usuario: string }>("/modules/paciente");
  return (
    <ModulePlaceholder
      title="Mis citas"
      description="Consulta y da seguimiento a tus citas y estudios."
      icon={CalendarDays}
      apiCheck={apiCheck}
      upcoming={[
        "Próximas citas y estudios agendados",
        "Reprogramar o cancelar una cita",
        "Historial de consultas",
      ]}
    />
  );
}
