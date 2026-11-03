import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getCurrentUser } from "@/lib/api-server";
import { UsersManager } from "./users-manager";

export const metadata: Metadata = { title: "Usuarios y roles" };

export default async function UsersPage() {
  const me = await getCurrentUser();
  return (
    <>
      <PageHeader
        title="Usuarios y roles"
        description="Busca usuarios, cambia su rol y activa o desactiva su acceso."
      />
      <UsersManager currentUserId={me.id} />
    </>
  );
}
