import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

const NOTICES: Record<string, string> = {
  logout: "Cerraste sesión correctamente.",
  sesion: "Tu sesión ya no es válida. Inicia sesión de nuevo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; motivo?: string }>;
}) {
  const { next, motivo } = await searchParams;
  const notice = motivo ? NOTICES[motivo] : next ? "Inicia sesión para continuar." : undefined;
  return <LoginForm next={next} notice={notice} />;
}
