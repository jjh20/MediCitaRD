import Link from "next/link";
import { Logo } from "@/components/brand/logo";

/** Pantallas de acceso: tarjeta blanca centrada sobre el fondo de marca. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-8 sm:justify-center sm:py-12">
      <Link href="/" className="mb-8" aria-label="Ir al inicio">
        <Logo showTagline size="lg" />
      </Link>
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl shadow-brand/5 sm:p-8">
        {children}
      </div>
    </div>
  );
}
