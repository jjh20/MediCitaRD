import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { apiServer } from "@/lib/api-server";

export const metadata: Metadata = { title: "Agenda del centro" };

export default async function AgendaCentroPage() {
  const apiCheck = await apiServer<{ modulo: string; usuario: string }>("/modules/centro");
  return (
    <ModulePlaceholder
      title="Agenda del centro"
      description="Gestiona las citas reservadas en tu centro."
      icon={CalendarClock}
      apiCheck={apiCheck}
      upcoming={[
        "Citas del día y de la semana",
        "Confirmar, reprogramar o cancelar citas",
        "Estado de pago de cada cita",
      ]}
    />
  );
}
