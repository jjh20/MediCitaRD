"use client";

import { Building2, Clock, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { formatDop, type Medico, type Page } from "@/lib/citas";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

export function iniciales(nombre: string) {
  return nombre
    .replace(/^(Dra?\.)\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function BuscarMedico() {
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [especialidad, setEspecialidad] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [medicos, setMedicos] = useState<Medico[] | null>(null);
  const [loading, setLoading] = useState(true);
  const debounced = useDebounced(texto);
  const req = useRef(0);

  useEffect(() => {
    api<string[]>("/medicos/especialidades")
      .then(setEspecialidades)
      .catch(() => setEspecialidades([]));
  }, []);

  useEffect(() => {
    const id = ++req.current;
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "50" });
    if (especialidad) params.set("especialidad", especialidad);
    if (debounced) params.set("texto", debounced);
    api<Page<Medico>>(`/medicos?${params}`)
      .then((r) => id === req.current && setMedicos(r.items))
      .catch((e) =>
        toast.error(e instanceof ApiError ? e.message : "No se pudieron cargar los médicos."),
      )
      .finally(() => id === req.current && setLoading(false));
  }, [especialidad, debounced]);

  return (
    <div className="space-y-5">
      <Card className="gap-4 rounded-2xl border-none p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Busca por nombre del médico, especialidad o centro"
            aria-label="Buscar médico"
            className="h-12 rounded-xl bg-background pl-9 text-base md:text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Especialidades">
          {[null, ...especialidades].map((e) => (
            <button
              key={e ?? "todas"}
              type="button"
              onClick={() => setEspecialidad(e)}
              aria-pressed={especialidad === e}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                especialidad === e
                  ? "border-brand bg-brand text-white"
                  : "bg-white text-brand-dark hover:border-brand/60 hover:bg-brand-soft",
              )}
            >
              {e ?? "Todas"}
            </button>
          ))}
        </div>
      </Card>

      {loading && !medicos ? (
        <p className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Buscando médicos…
        </p>
      ) : medicos && medicos.length === 0 ? (
        <Card className="rounded-2xl border-none p-10 text-center text-muted-foreground shadow-sm">
          No encontramos médicos con esa búsqueda.
        </Card>
      ) : (
        <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", loading && "opacity-60")}>
          {medicos?.map((m) => (
            <Card
              key={m.id}
              className="gap-4 rounded-2xl border-none p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-soft text-lg font-bold text-brand">
                  {iniciales(m.nombre)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-dark">{m.nombre}</p>
                  <p className="text-sm font-medium text-brand">{m.especialidad}</p>
                </div>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Building2 className="size-4 shrink-0" /> {m.centro.fullName}
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0" />{" "}
                  <span className="first-letter:uppercase">{m.horarioTexto}</span>
                </li>
              </ul>
              <div className="mt-auto flex items-center justify-between border-t pt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Consulta</p>
                  <p className="text-lg font-bold text-brand-dark">{formatDop(m.precioConsulta)}</p>
                </div>
                <Button asChild className="rounded-xl">
                  <Link href={`/paciente/buscar-medico/${m.id}`}>Ver horarios</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
