import type { NextConfig } from "next";

// En Vercel, API_INTERNAL_URL es obligatoria: sin ella el proxy /api apuntaría
// a localhost y la web no podría hablar con la API de Render.
if (process.env.VERCEL === "1" && !process.env.API_INTERNAL_URL) {
  throw new Error(
    "Falta API_INTERNAL_URL (la URL pública de la API en Render, por ejemplo https://medicita-api.onrender.com).",
  );
}

const apiUrl = (process.env.API_INTERNAL_URL ?? "http://localhost:4000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Oculta el indicador de desarrollo de Next (estorba en la demo)
  devIndicators: false,
  // El navegador llama a /api/* en el mismo origen; Next lo reenvía a la API.
  // Así la cookie httpOnly de sesión queda en el dominio del frontend.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
