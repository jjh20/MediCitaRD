import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AUTH_COOKIE } from "./session";
import type { Role } from "./roles";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  roleLabel: string;
  isActive: boolean;
  permissions: string[];
}

/**
 * Llama a la API desde el servidor reenviando la cookie de sesión.
 * Si la API responde 401 (sesión vencida, usuario desactivado o rol cambiado),
 * borra la cookie y manda al login.
 */
export async function apiServer<T>(path: string): Promise<T> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  const res = await fetch(`${API_URL}/api${path}`, {
    headers: token ? { Cookie: `${AUTH_COOKIE}=${token}` } : {},
    cache: "no-store",
  });
  if (res.status === 401) redirect("/sesion/expirada");
  if (res.status === 403) redirect(`/acceso-denegado`);
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`La API respondió ${res.status} en ${path}`);
  return (await res.json()) as T;
}

/** Usuario actual (una sola consulta por petición gracias a cache). */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const { user } = await apiServer<{ user: CurrentUser }>("/auth/me");
  return user;
});
