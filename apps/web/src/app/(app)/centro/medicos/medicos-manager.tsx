"use client";

import { Loader2, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorBox } from "@/components/citas/error-box";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { DIAS, formatDop, type Medico, type Page } from "@/lib/citas";
import { cn } from "@/lib/utils";

interface FormState {
  nombre: string;
  especialidad: string;
  precioConsulta: string;
  duracionMin: string;
  diasSemana: number[];
  horaInicio: string;
  horaFin: string;
}

const VACIO: FormState = {
  nombre: "",
  especialidad: "",
  precioConsulta: "",
  duracionMin: "30",
  diasSemana: [1, 2, 3, 4, 5],
  horaInicio: "08:00",
  horaFin: "17:00",
};

const SUGERENCIAS = [
  "Medicina General",
  "Cardiología",
  "Pediatría",
  "Ginecología",
  "Dermatología",
  "Ortopedia",
  "Oftalmología",
  "Laboratorio clínico",
  "Imágenes (Rayos X)",
];

export function MedicosManager() {
  const [medicos, setMedicos] = useState<Medico[] | null>(null);
  const [editando, setEditando] = useState<Medico | "nuevo" | null>(null);
  const [form, setForm] = useState<FormState>(VACIO);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cambioEstado, setCambioEstado] = useState<Medico | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<Page<Medico>>("/medicos?pageSize=100");
      setMedicos(r.items);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudieron cargar los médicos.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function abrir(m: Medico | "nuevo") {
    setError(null);
    setEditando(m);
    setForm(
      m === "nuevo"
        ? VACIO
        : {
            nombre: m.nombre,
            especialidad: m.especialidad,
            precioConsulta: String(m.precioConsulta),
            duracionMin: String(m.duracionMin),
            diasSemana: m.diasSemana,
            horaInicio: m.horaInicio,
            horaFin: m.horaFin,
          },
    );
  }

  async function guardar() {
    if (!editando) return;
    setSaving(true);
    setError(null);
    const body = {
      nombre: form.nombre,
      especialidad: form.especialidad,
      precioConsulta: Number(form.precioConsulta),
      duracionMin: Number(form.duracionMin),
      diasSemana: form.diasSemana,
      horaInicio: form.horaInicio,
      horaFin: form.horaFin,
    };
    try {
      if (editando === "nuevo") {
        await api("/medicos", { method: "POST", body: JSON.stringify(body) });
        toast.success(`${form.nombre} fue agregado.`);
      } else {
        await api(`/medicos/${editando.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success(`Datos de ${form.nombre} actualizados.`);
      }
      setEditando(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmarEstado() {
    if (!cambioEstado) return;
    setSaving(true);
    try {
      await api(`/medicos/${cambioEstado.id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ activo: !cambioEstado.activo }),
      });
      toast.success(`${cambioEstado.nombre} ${cambioEstado.activo ? "desactivado" : "activado"}.`);
      setCambioEstado(null);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo cambiar el estado.");
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => abrir("nuevo")} className="h-11 rounded-xl">
          <Plus className="size-4" /> Agregar médico
        </Button>
      </div>

      <Card className="gap-0 overflow-hidden rounded-2xl border-none py-0 shadow-sm">
        {!medicos ? (
          <p className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando médicos…
          </p>
        ) : medicos.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">
            Aún no tienes médicos. Agrega el primero para que los pacientes puedan agendar.
          </p>
        ) : (
          <>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="pl-4">Médico</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Turno</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="pr-4 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicos.map((m) => (
                  <TableRow key={m.id} className={cn(!m.activo && "opacity-70")}>
                    <TableCell className="pl-4">
                      <p className="font-medium text-brand-dark">{m.nombre}</p>
                      <p className="text-sm text-brand">{m.especialidad}</p>
                    </TableCell>
                    <TableCell>
                      <DiasChips dias={m.diasSemana} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {m.horaInicio} a {m.horaFin}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">{m.duracionMin} min</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatDop(m.precioConsulta)}
                    </TableCell>
                    <TableCell>
                      <ActivoBadge activo={m.activo} />
                    </TableCell>
                    <TableCell className="pr-4">
                      <Acciones
                        m={m}
                        onEditar={() => abrir(m)}
                        onEstado={() => setCambioEstado(m)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ul className="divide-y md:hidden">
              {medicos.map((m) => (
                <li key={m.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-brand-dark">{m.nombre}</p>
                      <p className="text-sm text-brand">{m.especialidad}</p>
                    </div>
                    <ActivoBadge activo={m.activo} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {m.horarioTexto} · {m.duracionMin} min · {formatDop(m.precioConsulta)}
                  </p>
                  <Acciones m={m} onEditar={() => abrir(m)} onEstado={() => setCambioEstado(m)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Dialog open={editando !== null} onOpenChange={(o) => !o && !saving && setEditando(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-brand-dark">
              {editando === "nuevo" ? "Agregar médico" : "Editar médico"}
            </DialogTitle>
            <DialogDescription>
              Los horarios se interpretan en hora de República Dominicana.
            </DialogDescription>
          </DialogHeader>
          <form
            id="medico-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
          >
            <Campo id="m-nombre" label="Nombre completo">
              <Input
                id="m-nombre"
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                placeholder="Dra. Ana Gómez"
                required
                className="h-11 rounded-xl"
              />
            </Campo>
            <Campo id="m-esp" label="Especialidad">
              <Input
                id="m-esp"
                list="especialidades"
                value={form.especialidad}
                onChange={(e) => set("especialidad", e.target.value)}
                placeholder="Medicina General"
                required
                className="h-11 rounded-xl"
              />
              <datalist id="especialidades">
                {SUGERENCIAS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo id="m-precio" label="Precio de la consulta (DOP)">
                <Input
                  id="m-precio"
                  type="number"
                  min={0}
                  step="50"
                  value={form.precioConsulta}
                  onChange={(e) => set("precioConsulta", e.target.value)}
                  placeholder="1500"
                  required
                  className="h-11 rounded-xl"
                />
              </Campo>
              <Campo id="m-dur" label="Duración del turno">
                <Select value={form.duracionMin} onValueChange={(v) => set("duracionMin", v)}>
                  <SelectTrigger id="m-dur" className="!h-11 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 20, 30, 45, 60].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} minutos
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
            </div>
            <div className="space-y-2">
              <Label className="text-brand-dark">Días de atención</Label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                  const on = form.diasSemana.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          "diasSemana",
                          on
                            ? form.diasSemana.filter((x) => x !== d)
                            : [...form.diasSemana, d].sort(),
                        )
                      }
                      className={cn(
                        "size-11 rounded-xl border text-sm font-medium",
                        on ? "border-brand bg-brand text-white" : "bg-white hover:bg-muted",
                      )}
                    >
                      {DIAS[d]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo id="m-ini" label="Hora de inicio">
                <Input
                  id="m-ini"
                  type="time"
                  value={form.horaInicio}
                  onChange={(e) => set("horaInicio", e.target.value)}
                  required
                  className="h-11 rounded-xl"
                />
              </Campo>
              <Campo id="m-fin" label="Hora de fin">
                <Input
                  id="m-fin"
                  type="time"
                  value={form.horaFin}
                  onChange={(e) => set("horaFin", e.target.value)}
                  required
                  className="h-11 rounded-xl"
                />
              </Campo>
            </div>
            <ErrorBox message={error} />
          </form>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setEditando(null)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button type="submit" form="medico-form" disabled={saving} className="rounded-xl">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editando === "nuevo" ? "Agregar médico" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={cambioEstado !== null}
        onOpenChange={(o) => !o && !saving && setCambioEstado(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          {cambioEstado && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {cambioEstado.activo ? "¿Desactivar al médico?" : "¿Activar al médico?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {cambioEstado.activo ? (
                    <>
                      <strong>{cambioEstado.nombre}</strong> dejará de aparecer en la búsqueda y no
                      se podrán agendar nuevas citas con él. Las citas ya agendadas se mantienen.
                    </>
                  ) : (
                    <>
                      <strong>{cambioEstado.nombre}</strong> volverá a estar disponible para que los
                      pacientes agenden.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={saving}>Volver</AlertDialogCancel>
                <AlertDialogAction
                  disabled={saving}
                  onClick={(e) => {
                    e.preventDefault();
                    void confirmarEstado();
                  }}
                  className={cn(cambioEstado.activo && "bg-destructive hover:bg-destructive/90")}
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {cambioEstado.activo ? "Sí, desactivar" : "Sí, activar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Campo({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-brand-dark">
        {label}
      </Label>
      {children}
    </div>
  );
}

function DiasChips({ dias }: { dias: number[] }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
        <span
          key={d}
          className={cn(
            "grid size-6 place-items-center rounded-md text-[0.65rem] font-semibold",
            dias.includes(d) ? "bg-brand-soft text-brand" : "bg-muted text-muted-foreground/50",
          )}
        >
          {DIAS[d][0]}
        </span>
      ))}
    </div>
  );
}

function ActivoBadge({ activo }: { activo: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border-none",
        activo ? "bg-success/15 text-success" : "bg-slate-200 text-slate-700",
      )}
    >
      {activo ? "Activo" : "Inactivo"}
    </Badge>
  );
}

function Acciones({
  m,
  onEditar,
  onEstado,
}: {
  m: Medico;
  onEditar: () => void;
  onEstado: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" className="rounded-xl" onClick={onEditar}>
        <Pencil className="size-4" /> Editar
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onEstado}
        className={cn(
          "rounded-xl",
          m.activo
            ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
            : "text-success hover:bg-success/10 hover:text-success",
        )}
      >
        {m.activo ? <PowerOff className="size-4" /> : <Power className="size-4" />}
        {m.activo ? "Desactivar" : "Activar"}
      </Button>
    </div>
  );
}
