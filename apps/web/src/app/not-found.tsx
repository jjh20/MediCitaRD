import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 text-center">
      <Logo className="mb-8" />
      <p className="text-sm font-bold tracking-widest text-brand">ERROR 404</p>
      <h1 className="mt-1 text-2xl font-bold text-brand-dark">Página no encontrada</h1>
      <p className="mt-2 text-muted-foreground">La dirección que buscas no existe.</p>
      <Button asChild className="mt-8 h-12 w-full max-w-xs rounded-xl text-base">
        <Link href="/">Ir al inicio</Link>
      </Button>
    </div>
  );
}
