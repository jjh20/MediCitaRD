import type { NextConfig } from "next";

const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // El navegador llama a /api/* en el mismo origen; Next lo reenvía a la API.
  // Así la cookie httpOnly de sesión queda en el dominio del frontend.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
