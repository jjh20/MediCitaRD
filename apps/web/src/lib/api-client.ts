"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/**
 * fetch del navegador a /api/* (mismo origen; Next lo reenvía a la API).
 * Convierte los errores de NestJS en un ApiError con mensaje legible.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const body = (await res.json().catch(() => null)) as (T & { message?: string | string[] }) | null;

  if (!res.ok) {
    // Sesión vencida o invalidada desde otro lugar: limpiar y volver al login
    if (res.status === 401 && !path.startsWith("/auth/")) {
      window.location.href = "/sesion/expirada";
    }
    const message = Array.isArray(body?.message)
      ? body.message.join(" ")
      : (body?.message ?? "Ocurrió un error inesperado. Intenta de nuevo.");
    throw new ApiError(message, res.status);
  }
  return body as T;
}
