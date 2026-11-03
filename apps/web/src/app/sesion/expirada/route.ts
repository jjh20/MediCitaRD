import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/session";

/**
 * La API rechazó la sesión (vencida, usuario desactivado o rol cambiado):
 * se borra la cookie y se vuelve al login con un aviso.
 */
export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login?motivo=sesion", req.url));
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
