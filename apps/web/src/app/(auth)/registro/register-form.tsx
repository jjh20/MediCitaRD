"use client";

import { AlertCircle, Building2, Check, Circle, HeartPulse, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Field } from "@/components/forms/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api, ApiError } from "@/lib/api-client";
import { isStrongPassword, PASSWORD_RULES } from "@/lib/password-policy";
import { ROLE_HOME, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

/** Solo estos perfiles se pueden elegir; Administrador no aparece. */
const ACCOUNT_TYPES = [
  {
    value: "PACIENTE",
    title: "Paciente",
    text: "Busca médicos, agenda y paga tus citas.",
    icon: HeartPulse,
  },
  {
    value: "CENTRO_MEDICO",
    title: "Centro médico",
    text: "Publica médicos, horarios y precios.",
    icon: Building2,
  },
] as const;

type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];
type Errors = Partial<Record<"fullName" | "email" | "password" | "confirm", string>>;

export function RegisterForm() {
  const [role, setRole] = useState<AccountType>("PACIENTE");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function validate(form: FormData): Errors {
    const next: Errors = {};
    const fullName = String(form.get("fullName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    if (fullName.length < 2) next.fullName = "Ingresa un nombre de al menos 2 caracteres.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Ingresa un correo electrónico válido.";
    if (!isStrongPassword(password)) next.password = "La contraseña no cumple los requisitos.";
    if (form.get("confirm") !== password) next.confirm = "Las contraseñas no coinciden.";
    return next;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const found = validate(form);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length) return;

    setPending(true);
    try {
      const { user } = await api<{ user: { role: Role } }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.get("fullName"),
          email: form.get("email"),
          password,
          role,
        }),
      });
      window.location.href = ROLE_HOME[user.role];
    } catch (err) {
      setServerError(
        err instanceof ApiError ? err.message : "No se pudo conectar con el servidor.",
      );
      setPending(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-brand-dark">Crear cuenta</h1>
      <p className="mt-1 text-muted-foreground">Elige tu tipo de cuenta y completa tus datos.</p>

      {serverError && (
        <Alert variant="destructive" className="mt-6" role="alert">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-brand-dark">Tipo de cuenta</legend>
          <RadioGroup
            value={role}
            onValueChange={(value) => setRole(value as AccountType)}
            className="grid grid-cols-2 gap-3"
          >
            {ACCOUNT_TYPES.map(({ value, title, text, icon: Icon }) => (
              <Label
                key={value}
                htmlFor={`role-${value}`}
                className={cn(
                  "flex cursor-pointer flex-col items-start gap-2 rounded-2xl border-2 p-4 transition-colors",
                  role === value
                    ? "border-brand bg-brand-soft"
                    : "border-border hover:border-brand/40",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <Icon
                    className={cn(
                      "size-6",
                      role === value ? "text-brand" : "text-muted-foreground",
                    )}
                  />
                  <RadioGroupItem id={`role-${value}`} value={value} />
                </div>
                <span className="font-semibold text-brand-dark">{title}</span>
                <span className="text-xs leading-snug font-normal text-muted-foreground">
                  {text}
                </span>
              </Label>
            ))}
          </RadioGroup>
        </fieldset>

        <Field
          id="fullName"
          name="fullName"
          label={role === "CENTRO_MEDICO" ? "Nombre del centro médico" : "Nombre completo"}
          placeholder={role === "CENTRO_MEDICO" ? "Centro Médico Esperanza" : "María Pérez"}
          autoComplete={role === "CENTRO_MEDICO" ? "organization" : "name"}
          error={errors.fullName}
        />
        <Field
          id="email"
          name="email"
          type="email"
          label="Correo electrónico"
          placeholder="tucorreo@ejemplo.com"
          autoComplete="email"
          error={errors.email}
        />
        <div className="space-y-3">
          <Field
            id="password"
            name="password"
            type="password"
            label="Contraseña"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
          <ul
            className="grid gap-1.5 text-sm sm:grid-cols-2"
            aria-label="Requisitos de la contraseña"
          >
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(password);
              return (
                <li
                  key={rule.id}
                  className={cn(
                    "flex items-center gap-2",
                    ok ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {ok ? <Check className="size-4" /> : <Circle className="size-3.5" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        </div>
        <Field
          id="confirm"
          name="confirm"
          type="password"
          label="Confirmar contraseña"
          autoComplete="new-password"
          error={errors.confirm}
        />

        <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-base">
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Creando cuenta…" : "Crear cuenta"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </>
  );
}
