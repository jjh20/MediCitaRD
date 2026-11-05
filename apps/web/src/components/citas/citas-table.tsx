"use client";

import { ArrowDownUp, ChevronRight, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, ApiError } from "@/lib/api-client";
import {
  ESTADO_INFO,
  ESTADOS,
  formatDop,
  formatFecha,
  formatHora,
  TIPO_LABELS,
  type Cita,
  type Medico,
  type Page,
} from "@/lib/citas";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";
import { EstadoBadge } from "./estado-badge";

const ALL = "todos";
const PAGE_SIZE = 10;

interface Centro {
  id: string;
  fullName: string;
}

/**
 * Tabla de citas con filtros por estado, rango de fechas, responsable
 * (médico y, para el admin, centro) y texto. La API aplica el alcance del rol.
 */
export function CitasTable({ basePath, admin = false }: { basePath: string; admin?: boolean }) {
  const [estado, setEstado] = useState(ALL);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [medicoId, setMedicoId] = useState(ALL);
  const [centroId, setCentroId] = useState(ALL);
  const [texto, setTexto] = useState("");
  const [orden, setOrden] = useState<"asc" | "desc">(admin ? "desc" : "asc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<Cita> | null>(null);
  const [loading, setLoading] = useState(true);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const debouncedTexto = useDebounced(texto);
  const req = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams({ pageSize: "100" });
    if (admin && centroId !== ALL) params.set("centroId", centroId);
    api<Page<Medico>>(`/medicos?${params}`)
      .then((r) => setMedicos(r.items))
      .catch(() => setMedicos([]));
  }, [admin, centroId]);

  useEffect(() => {
    if (!admin) return;
    api<Page<Centro>>("/users?role=CENTRO_MEDICO&pageSize=100")
      .then((r) => setCentros(r.items))
      .catch(() => setCentros([]));
  }, [admin]);

  const load = useCallback(async () => {
    const id = ++req.current;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), orden });
    if (estado !== ALL) params.set("estado", estado);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (medicoId !== ALL) params.set("medicoId", medicoId);
    if (admin && centroId !== ALL) params.set("centroId", centroId);
    if (debouncedTexto) params.set("texto", debouncedTexto);
    try {
      const r = await api<Page<Cita>>(`/citas?${params}`);
      if (id === req.current) setData(r);
    } catch (err) {
      if (id === req.current) {
        toast.error(err instanceof ApiError ? err.message : "No se pudieron cargar las citas.");
      }
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [page, orden, estado, desde, hasta, medicoId, centroId, admin, debouncedTexto]);

  useEffect(() => {
    void load();
  }, [load]);

  function filtro<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const hayFiltros =
    estado !== ALL || desde || hasta || medicoId !== ALL || centroId !== ALL || texto;

  function limpiar() {
    setEstado(ALL);
    setDesde("");
    setHasta("");
    setMedicoId(ALL);
    setCentroId(ALL);
    setTexto("");
    setPage(1);
  }

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl border-none py-0 shadow-sm">
      <div className="space-y-3 border-b p-4">
        <div
          className={cn("grid gap-3 sm:grid-cols-2", admin ? "lg:grid-cols-4" : "lg:grid-cols-3")}
        >
          <FiltroSelect label="Estado" value={estado} onChange={filtro(setEstado)}>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {ESTADOS.map((e) => (
              <SelectItem key={e} value={e}>
                <span className={cn("size-2 rounded-full", ESTADO_INFO[e].dot)} />
                {ESTADO_INFO[e].label}
              </SelectItem>
            ))}
          </FiltroSelect>
          {admin && (
            <FiltroSelect
              label="Centro médico"
              value={centroId}
              onChange={(v) => {
                filtro(setCentroId)(v);
                setMedicoId(ALL);
              }}
            >
              <SelectItem value={ALL}>Todos los centros</SelectItem>
              {centros.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.fullName}
                </SelectItem>
              ))}
            </FiltroSelect>
          )}
          <FiltroSelect
            label="Médico (responsable)"
            value={medicoId}
            onChange={filtro(setMedicoId)}
          >
            <SelectItem value={ALL}>Todos los médicos</SelectItem>
            {medicos.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nombre} · {m.especialidad}
              </SelectItem>
            ))}
          </FiltroSelect>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Buscar</Label>
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={texto}
                onChange={(e) => filtro(setTexto)(e.target.value)}
                placeholder="Código, paciente o motivo"
                aria-label="Buscar por código, paciente o motivo"
                className="h-10 rounded-xl bg-background pl-9"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-desde" className="text-xs text-muted-foreground">
              Desde
            </Label>
            <Input
              id="f-desde"
              type="date"
              value={desde}
              max={hasta || undefined}
              onChange={(e) => filtro(setDesde)(e.target.value)}
              className="h-10 w-auto rounded-xl bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-hasta" className="text-xs text-muted-foreground">
              Hasta
            </Label>
            <Input
              id="f-hasta"
              type="date"
              value={hasta}
              min={desde || undefined}
              onChange={(e) => filtro(setHasta)(e.target.value)}
              className="h-10 w-auto rounded-xl bg-background"
            />
          </div>
          <Button
            variant="outline"
            className="h-10 rounded-xl"
            onClick={() => filtro(setOrden)(orden === "asc" ? "desc" : "asc")}
          >
            <ArrowDownUp className="size-4" />
            {orden === "asc" ? "Más antiguas primero" : "Más recientes primero"}
          </Button>
          {hayFiltros && (
            <Button
              variant="ghost"
              className="h-10 rounded-xl text-muted-foreground"
              onClick={limpiar}
            >
              <X className="size-4" /> Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando citas…
        </div>
      ) : data && data.items.length === 0 ? (
        <p className="p-10 text-center text-muted-foreground">
          No hay citas que coincidan con los filtros.
        </p>
      ) : (
        data && (
          <div className={cn("transition-opacity", loading && "opacity-60")}>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="pl-4">Código</TableHead>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Médico</TableHead>
                  {admin && <TableHead>Centro</TableHead>}
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="w-8 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id} className="group cursor-pointer">
                    <TableCell className="pl-4 font-mono text-xs">
                      <Link href={`${basePath}/${c.id}`} className="text-brand hover:underline">
                        {c.codigo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-brand-dark first-letter:uppercase">
                        {formatFecha(c.fechaHora)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatHora(c.fechaHora)} · {TIPO_LABELS[c.tipo]}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-brand-dark">{c.paciente.fullName}</p>
                      <p className="max-w-52 truncate text-xs text-muted-foreground">{c.motivo}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-brand-dark">{c.medico.nombre}</p>
                      <p className="text-xs text-muted-foreground">{c.medico.especialidad}</p>
                    </TableCell>
                    {admin && <TableCell className="text-sm">{c.centro.fullName}</TableCell>}
                    <TableCell>
                      <EstadoBadge estado={c.estado} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatDop(c.costo)}</TableCell>
                    <TableCell className="pr-4">
                      <Link href={`${basePath}/${c.id}`} aria-label={`Ver ${c.codigo}`}>
                        <ChevronRight className="size-4 text-muted-foreground group-hover:text-brand" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <ul className="divide-y md:hidden">
              {data.items.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`${basePath}/${c.id}`}
                    className="block space-y-2 p-4 hover:bg-muted/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{c.codigo}</p>
                        <p className="font-semibold text-brand-dark first-letter:uppercase">
                          {formatFecha(c.fechaHora)} · {formatHora(c.fechaHora)}
                        </p>
                      </div>
                      <EstadoBadge estado={c.estado} />
                    </div>
                    <p className="text-sm">
                      {c.paciente.fullName} → {c.medico.nombre}{" "}
                      <span className="text-muted-foreground">({c.medico.especialidad})</span>
                    </p>
                    {admin && <p className="text-xs text-muted-foreground">{c.centro.fullName}</p>}
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onChange={setPage}
            />
          </div>
        )
      )}
    </Card>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="!h-10 w-full rounded-xl bg-background" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}
