import { apiServer, getCurrentUser } from "@/lib/api-server";
import type { Cita, HistorialItem } from "@/lib/citas";
import { CitaDetalle } from "./cita-detalle";

/**
 * Página de detalle de una cita (servidor). La API valida el acceso: si la
 * cita es ajena responde 403 (auditado) y apiServer lleva a "Acceso denegado".
 */
export async function CitaPage({
  id,
  backHref,
  backLabel,
}: {
  id: string;
  backHref: string;
  backLabel: string;
}) {
  const me = await getCurrentUser();
  const cita = await apiServer<Cita>(`/citas/${encodeURIComponent(id)}`);
  const historial = await apiServer<HistorialItem[]>(`/citas/${encodeURIComponent(id)}/historial`);
  return (
    <CitaDetalle
      role={me.role}
      initialCita={cita}
      initialHistorial={historial}
      backHref={backHref}
      backLabel={backLabel}
    />
  );
}
