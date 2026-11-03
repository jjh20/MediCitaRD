import { Search } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { apiServer } from "@/lib/api-server";

export const metadata: Metadata = { title: "Buscar médico" };

export default async function BuscarMedicoPage() {
  const apiCheck = await apiServer<{ modulo: string; usuario: string }>("/modules/paciente");
  return (
    <ModulePlaceholder
      title="Buscar médico"
      description="Encuentra especialistas y centros médicos."
      icon={Search}
      apiCheck={apiCheck}
      upcoming={[
        "Búsqueda por especialidad, centro o seguro",
        "Horarios disponibles y precios",
        "Agendar en pocos pasos",
      ]}
    />
  );
}
