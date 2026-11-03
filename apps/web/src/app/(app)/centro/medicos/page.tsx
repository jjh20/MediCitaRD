import { Stethoscope } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { apiServer } from "@/lib/api-server";

export const metadata: Metadata = { title: "Médicos y horarios" };

export default async function MedicosHorariosPage() {
  const apiCheck = await apiServer<{ modulo: string; usuario: string }>("/modules/centro");
  return (
    <ModulePlaceholder
      title="Médicos y horarios"
      description="Publica tus médicos, horarios y precios."
      icon={Stethoscope}
      apiCheck={apiCheck}
      upcoming={[
        "Registrar médicos y especialidades",
        "Definir horarios de atención",
        "Publicar precios de consultas y estudios",
      ]}
    />
  );
}
