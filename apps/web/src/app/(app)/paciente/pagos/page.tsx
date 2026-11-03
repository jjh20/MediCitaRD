import { CreditCard } from "lucide-react";
import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { apiServer } from "@/lib/api-server";

export const metadata: Metadata = { title: "Pagos" };

export default async function PagosPage() {
  const apiCheck = await apiServer<{ modulo: string; usuario: string }>("/modules/paciente");
  return (
    <ModulePlaceholder
      title="Pagos"
      description="Paga tus citas en línea y revisa tus comprobantes."
      icon={CreditCard}
      apiCheck={apiCheck}
      upcoming={["Pago en línea con tarjeta", "Comprobantes descargables", "Historial de pagos"]}
    />
  );
}
