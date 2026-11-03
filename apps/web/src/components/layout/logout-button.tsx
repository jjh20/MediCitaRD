"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoutButton({ className }: { className?: string }) {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      // Navegación completa: el middleware vuelve a evaluar sin la cookie
      window.location.href = "/login?motivo=logout";
    }
  }

  return (
    <Button
      variant="ghost"
      onClick={logout}
      disabled={pending}
      className={cn("w-full justify-start gap-3", className)}
    >
      <LogOut className="size-4" />
      {pending ? "Cerrando sesión…" : "Cerrar sesión"}
    </Button>
  );
}
