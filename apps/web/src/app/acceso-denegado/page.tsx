import { ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ROLE_HOME, ROLE_LABELS, safeNextPath } from "@/lib/roles";
import { AUTH_COOKIE, verifySession } from "@/lib/session";

export const metadata: Metadata = { title: "Acceso denegado" };

export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ ruta?: string }>;
}) {
  const { ruta } = await searchParams;
  const session = await verifySession((await cookies()).get(AUTH_COOKIE)?.value);
  const path = safeNextPath(ruta);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Logo className="mb-8" />
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl shadow-brand/5">
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldX className="size-8" />
        </span>
        <p className="mt-6 text-sm font-bold tracking-widest text-destructive">ERROR 403</p>
        <h1 className="mt-1 text-2xl font-bold text-brand-dark">Acceso denegado</h1>
        <p className="mt-3 text-muted-foreground">
          {session ? (
            <>
              Tu perfil de <strong>{ROLE_LABELS[session.role]}</strong> no tiene permiso para entrar
              {path ? (
                <>
                  {" "}
                  a <code className="rounded bg-muted px-1.5 py-0.5 text-sm">{path}</code>
                </>
              ) : (
                " a esta sección"
              )}
              .
            </>
          ) : (
            "No tienes permiso para ver esta sección."
          )}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          El intento quedó registrado en la auditoría.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Button asChild className="h-12 w-full rounded-xl text-base">
            <Link href={session ? ROLE_HOME[session.role] : "/login"}>
              {session ? "Volver a mi panel" : "Iniciar sesión"}
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/">Ir al inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
