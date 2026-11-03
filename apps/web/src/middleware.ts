import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { findRouteRule, ROLE_HOME } from "@/lib/roles";
import { AUTH_COOKIE, verifySession, type Session } from "@/lib/session";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

/**
 * Protege las páginas por rol:
 * - sin sesión válida → /login?next=… (401)
 * - con un rol que no corresponde → /acceso-denegado (403)
 * Ambos casos se registran en la auditoría de la API (llamada interna).
 * La API vuelve a validar todo en cada petición: esto es la primera barrera.
 */
export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = await verifySession(token);

  // Con sesión iniciada, login y registro llevan directo al panel
  if (pathname === "/login" || pathname === "/registro") {
    return session
      ? NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url))
      : NextResponse.next();
  }

  const rule = findRouteRule(pathname);
  if (!rule) return NextResponse.next();

  if (!session) {
    event.waitUntil(reportDenied(req, 401, null));
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    const res = NextResponse.redirect(login);
    if (token) res.cookies.delete(AUTH_COOKIE); // token vencido o alterado
    return res;
  }

  if (!rule.roles.includes(session.role)) {
    event.waitUntil(reportDenied(req, 403, session));
    const denied = new URL("/acceso-denegado", req.url);
    denied.searchParams.set("ruta", pathname);
    return NextResponse.redirect(denied);
  }

  if (pathname === "/panel") {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], req.url));
  }
  return NextResponse.next();
}

async function reportDenied(req: NextRequest, status: 401 | 403, session: Session | null) {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return;
  try {
    await fetch(`${API_URL}/api/audit/access-denied`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": key },
      body: JSON.stringify({
        path: req.nextUrl.pathname,
        status,
        userId: session?.userId,
        role: session?.role,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // La auditoría nunca debe impedir la navegación
  }
}

export const config = {
  matcher: ["/login", "/registro", "/panel", "/paciente/:path*", "/centro/:path*", "/admin/:path*"],
};
