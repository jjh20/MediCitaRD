"use client";

import { AlertCircle, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/forms/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api-client";
import { ROLE_HOME, safeNextPath, type Role } from "@/lib/roles";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const { user } = await api<{ user: { role: Role } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      // Navegación completa para que el middleware lea la nueva cookie
      window.location.href = safeNextPath(next) ?? ROLE_HOME[user.role];
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.");
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-brand-dark">Iniciar sesión</h1>
      <p className="mt-1 text-muted-foreground">Accede para gestionar tus citas.</p>

      {notice && !error && (
        <Alert className="mt-6 border-brand/20 bg-brand-soft text-brand-dark">
          <Info className="size-4" />
          <AlertDescription className="text-brand-dark">{notice}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mt-6" role="alert">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
        <Field
          id="email"
          name="email"
          type="email"
          label="Correo electrónico"
          placeholder="tucorreo@ejemplo.com"
          autoComplete="email"
          required
        />
        <Field
          id="password"
          name="password"
          type="password"
          label="Contraseña"
          placeholder="••••••••••"
          autoComplete="current-password"
          required
        />
        <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-base">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Ingresando…" : "Iniciar sesión"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-brand hover:underline">
          Crear cuenta
        </Link>
      </p>
    </>
  );
}
