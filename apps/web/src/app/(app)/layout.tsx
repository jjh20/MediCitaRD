import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/api-server";

/**
 * Área autenticada. El middleware ya filtró por rol; aquí se consulta a la API
 * el usuario actual (si la sesión fue invalidada, apiServer redirige al login).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return <AppShell user={user}>{children}</AppShell>;
}
