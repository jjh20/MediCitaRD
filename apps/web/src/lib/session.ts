import { jwtVerify } from "jose";
import { isRole, type Role } from "./roles";

export const AUTH_COOKIE = "medicita_token";

export interface Session {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

/**
 * Verifica la firma y expiración del JWT emitido por la API (mismo JWT_SECRET).
 * Funciona en el runtime edge del middleware y en el servidor.
 */
export async function verifySession(token: string | undefined): Promise<Session | null> {
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || !isRole(payload.role)) return null;
    return {
      userId: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role,
    };
  } catch {
    return null;
  }
}
