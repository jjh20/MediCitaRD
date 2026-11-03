import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AuditLogTable } from "./audit-log-table";

export const metadata: Metadata = { title: "Auditoría" };

export default function AuditPage() {
  return (
    <>
      <PageHeader title="Auditoría" description="Registro de accesos y cambios en la plataforma." />
      <AuditLogTable />
    </>
  );
}
