"use client";

import {
  ArrowLeft,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  Pencil,
  Repeat,
  Stethoscope,
  User,
  Building2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api-client";
import {
  esCerrada,
  formatDop,
  formatFechaHora,
  formatFechaLarga,
  formatHora,
  horasParaCita,
  TIPO_LABELS,
  type Cita,
  type HistorialItem,
  type Slot,
  type TipoCita,
} from "@/lib/citas";
import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { ErrorBox } from "./error-box";
import { EstadoBadge } from "./estado-badge";
import { HistorialTimeline } from "./historial-timeline";
import { SlotPicker } from "./slot-picker";

type Accion = "confirmar" | "reprogramar" | "cerrar" | "cancelar" | "editar";

interface CitaDetalleProps {
  role: Role;
  initialCita: Cita;
  initialHistorial: HistorialItem[];
  backHref: string;
  backLabel: string;
}

/** Detalle de una cita: datos, acciones según rol y estado, e historial. */
export function CitaDetalle({
  role,
  initialCita,
  initialHistorial,
  backHref,
  backLabel,
}: CitaDetalleProps) {
  const [cita, setCita] = useState(initialCita);
  const [historial, setHistorial] = useState(initialHistorial);
  const [accion, setAccion] = useState<Accion | null>(null);

  async function recargar() {
    const [c, h] = await Promise.all([
      api<Cita>(`/citas/${cita.id}`),
      api<HistorialItem[]>(`/citas/${cita.id}/historial`),
    ]);
    setCita(c);
    setHistorial(h);
  }

  const cerrada = esCerrada(cita.estado);
  const esCentro = role === "CENTRO_MEDICO";
  const esPaciente = role === "PACIENTE";
  const puedeGestionar = (esCentro || esPaciente) && !cerrada;
  const yaPaso = horasParaCita(cita.fechaHora) <= 0;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href={backHref}>
          <ArrowLeft className="size-4" /> {backLabel}
        </Link>
      </Button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{cita.codigo}</p>
          <h1 className="text-2xl font-bold tracking-tight text-brand-dark sm:text-3xl">
            {TIPO_LABELS[cita.tipo]} con {cita.medico.nombre}
          </h1>
          <p className="mt-1 text-muted-foreground first-letter:uppercase">
            {formatFechaLarga(cita.fechaHora)} · {formatHora(cita.fechaHora)}
          </p>
        </div>
        <EstadoBadge estado={cita.estado} className="text-sm" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card className="gap-0 rounded-2xl border-none p-0 shadow-sm">
            <dl className="grid gap-px overflow-hidden rounded-2xl bg-border sm:grid-cols-2">
              <Dato
                icon={Stethoscope}
                label="Médico"
                value={`${cita.medico.nombre} · ${cita.medico.especialidad}`}
              />
              <Dato icon={Building2} label="Centro médico" value={cita.centro.fullName} />
              <Dato
                icon={User}
                label="Paciente"
                value={`${cita.paciente.fullName}`}
                sub={cita.paciente.email}
              />
              <Dato icon={Wallet} label="Costo" value={formatDop(cita.costo)} />
              <Dato
                icon={Clock}
                label="Fecha y hora"
                value={formatFechaHora(cita.fechaHora)}
                sub={`Duración: ${cita.medico.duracionMin} min`}
              />
              <Dato icon={CalendarCheck} label="Tipo" value={TIPO_LABELS[cita.tipo]} />
            </dl>
            <div className="space-y-3 border-t p-5">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Motivo
                </p>
                <p className="mt-1 text-brand-dark">{cita.motivo}</p>
              </div>
              {cita.notasCierre && (
                <div className="rounded-xl bg-success/10 p-3">
                  <p className="text-xs font-semibold tracking-wide text-success uppercase">
                    Notas de cierre
                  </p>
                  <p className="mt-1 text-brand-dark">{cita.notasCierre}</p>
                </div>
              )}
              {cita.motivoCancelacion && (
                <div className="rounded-xl bg-destructive/5 p-3">
                  <p className="text-xs font-semibold tracking-wide text-destructive uppercase">
                    Motivo de cancelación
                  </p>
                  <p className="mt-1 text-brand-dark">{cita.motivoCancelacion}</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="gap-4 rounded-2xl border-none p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold text-brand-dark">
              <History className="size-5 text-brand" /> Historial de cambios
            </h2>
            <HistorialTimeline items={historial} />
          </Card>
        </div>

        <Card className="h-fit gap-3 rounded-2xl border-none p-5 shadow-sm">
          <h2 className="font-semibold text-brand-dark">Acciones</h2>
          {role === "ADMIN" ? (
            <p className="text-sm text-muted-foreground">
              Vista de consulta. Las acciones las realizan el paciente y el centro médico.
            </p>
          ) : !puedeGestionar ? (
            <p className="text-sm text-muted-foreground">
              Esta cita está cerrada y ya no se puede modificar.
            </p>
          ) : (
            <div className="grid gap-2">
              {esCentro && cita.estado === "PENDIENTE" && (
                <Button
                  onClick={() => setAccion("confirmar")}
                  className="h-11 justify-start rounded-xl"
                >
                  <CalendarCheck className="size-4" /> Confirmar cita
                </Button>
              )}
              {esCentro && cita.estado === "CONFIRMADA" && (
                <Button
                  onClick={() => setAccion("cerrar")}
                  className="h-11 justify-start rounded-xl bg-success hover:bg-success/90"
                >
                  <CheckCircle2 className="size-4" /> Cerrar cita
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setAccion("reprogramar")}
                className="h-11 justify-start rounded-xl"
              >
                <Repeat className="size-4" /> Reprogramar
              </Button>
              <Button
                variant="outline"
                onClick={() => setAccion("editar")}
                className="h-11 justify-start rounded-xl"
              >
                <Pencil className="size-4" /> Editar motivo o tipo
              </Button>
              <Button
                variant="outline"
                onClick={() => setAccion("cancelar")}
                className="h-11 justify-start rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <CalendarX className="size-4" /> Cancelar cita
              </Button>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {esCentro && cita.estado === "CONFIRMADA" && !yaPaso && (
                  <li>• La cita se puede cerrar después de su hora.</li>
                )}
                {esCentro && cita.estado === "PENDIENTE" && (
                  <li>• Para cerrarla primero hay que confirmarla.</li>
                )}
                {esPaciente && <li>• Puedes cancelar hasta 2 horas antes de la cita.</li>}
                <li>• Al reprogramar, la cita vuelve a quedar Pendiente.</li>
              </ul>
            </div>
          )}
        </Card>
      </div>

      <AccionDialog
        accion={accion}
        cita={cita}
        role={role}
        onClose={() => setAccion(null)}
        onDone={async (mensaje) => {
          toast.success(mensaje);
          setAccion(null);
          await recargar();
        }}
      />
    </div>
  );
}

function Dato({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof User;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex gap-3 bg-white p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate font-medium text-brand-dark">{value}</dd>
        {sub && <dd className="truncate text-xs text-muted-foreground">{sub}</dd>}
      </div>
    </div>
  );
}

const TITULOS: Record<Accion, string> = {
  confirmar: "¿Confirmar la cita?",
  reprogramar: "Reprogramar la cita",
  cerrar: "Cerrar la cita",
  cancelar: "¿Cancelar la cita?",
  editar: "Editar motivo o tipo",
};

/** Diálogo de confirmación de cada acción; muestra los errores de reglas de negocio. */
function AccionDialog({
  accion,
  cita,
  role,
  onClose,
  onDone,
}: {
  accion: Accion | null;
  cita: Cita;
  role: Role;
  onClose: () => void;
  onDone: (mensaje: string) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<"ATENDIDA" | "NO_ASISTIO">("ATENDIDA");
  const [motivo, setMotivo] = useState(cita.motivo);
  const [tipo, setTipo] = useState<TipoCita>(cita.tipo);

  function reset() {
    setError(null);
    setSlot(null);
    setTexto("");
    setResultado("ATENDIDA");
    setMotivo(cita.motivo);
    setTipo(cita.tipo);
  }

  async function ejecutar() {
    if (!accion) return;
    setSaving(true);
    setError(null);
    try {
      const post = (ruta: string, body: unknown) =>
        api<Cita>(`/citas/${cita.id}/${ruta}`, { method: "POST", body: JSON.stringify(body) });
      let mensaje = "";
      if (accion === "confirmar") {
        await post("confirmar", texto ? { comentario: texto } : {});
        mensaje = `Cita ${cita.codigo} confirmada.`;
      } else if (accion === "reprogramar") {
        if (!slot) throw new ApiError("Elige la nueva fecha y hora.", 400);
        await post("reprogramar", {
          fechaHora: slot.fechaHora,
          ...(texto ? { comentario: texto } : {}),
        });
        mensaje = `Cita ${cita.codigo} reprogramada para el ${formatFechaHora(slot.fechaHora)}.`;
      } else if (accion === "cerrar") {
        await post("cerrar", { resultado, ...(texto ? { notas: texto } : {}) });
        mensaje = `Cita ${cita.codigo} cerrada como ${resultado === "ATENDIDA" ? "Atendida" : "No asistió"}.`;
      } else if (accion === "cancelar") {
        await post("cancelar", { motivo: texto });
        mensaje = `Cita ${cita.codigo} cancelada.`;
      } else {
        await api<Cita>(`/citas/${cita.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...(motivo.trim() !== cita.motivo ? { motivo: motivo.trim() } : {}),
            ...(tipo !== cita.tipo ? { tipo } : {}),
          }),
        });
        mensaje = `Cita ${cita.codigo} actualizada.`;
      }
      await onDone(mensaje);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo completar la acción.");
    } finally {
      setSaving(false);
    }
  }

  const peligro = accion === "cancelar";

  return (
    <Dialog
      open={accion !== null}
      onOpenChange={(open) => {
        if (!open && !saving) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent
        className={cn(
          "max-h-[92dvh] overflow-y-auto rounded-2xl",
          accion === "reprogramar" && "sm:max-w-2xl",
        )}
      >
        {accion && (
          <>
            <DialogHeader>
              <DialogTitle className="text-brand-dark">{TITULOS[accion]}</DialogTitle>
              <DialogDescription>
                {cita.codigo} · {cita.medico.nombre} · {formatFechaHora(cita.fechaHora)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {accion === "confirmar" && (
                <>
                  <p className="text-sm">
                    La cita de <strong>{cita.paciente.fullName}</strong> pasará a{" "}
                    <strong>Confirmada</strong>.
                  </p>
                  <Comentario value={texto} onChange={setTexto} label="Comentario (opcional)" />
                </>
              )}

              {accion === "reprogramar" && (
                <>
                  <SlotPicker
                    medicoId={cita.medico.id}
                    diasSemana={cita.medico.diasSemana}
                    value={slot}
                    onChange={setSlot}
                    actual={cita.fechaHora}
                  />
                  {slot && (
                    <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-dark">
                      <strong>{formatFechaHora(cita.fechaHora)}</strong> →{" "}
                      <strong>{formatFechaHora(slot.fechaHora)}</strong>. La cita quedará{" "}
                      <strong>Pendiente</strong> de confirmar.
                    </p>
                  )}
                  <Comentario
                    value={texto}
                    onChange={setTexto}
                    label="Motivo del cambio (opcional)"
                  />
                </>
              )}

              {accion === "cerrar" && (
                <>
                  <RadioGroup
                    value={resultado}
                    onValueChange={(v) => setResultado(v as "ATENDIDA" | "NO_ASISTIO")}
                    className="grid grid-cols-2 gap-2"
                  >
                    {(
                      [
                        ["ATENDIDA", "Atendida", "El paciente asistió."],
                        ["NO_ASISTIO", "No asistió", "El paciente no se presentó."],
                      ] as const
                    ).map(([v, label, desc]) => (
                      <Label
                        key={v}
                        htmlFor={`res-${v}`}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                          resultado === v && "border-brand bg-brand-soft",
                        )}
                      >
                        <RadioGroupItem id={`res-${v}`} value={v} className="mt-0.5" />
                        <span>
                          <span className="block font-semibold text-brand-dark">{label}</span>
                          <span className="block text-xs font-normal text-muted-foreground">
                            {desc}
                          </span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                  <Comentario
                    value={texto}
                    onChange={setTexto}
                    label={
                      resultado === "ATENDIDA"
                        ? "Notas de cierre (obligatorias)"
                        : "Notas (opcional)"
                    }
                    placeholder="Diagnóstico, indicaciones o comentarios de la consulta"
                  />
                </>
              )}

              {accion === "cancelar" && (
                <>
                  <p className="text-sm">
                    La cita quedará <strong>Cancelada</strong> y el horario se liberará. Esta acción
                    no se puede deshacer.
                    {role === "PACIENTE" && " Solo puedes cancelar hasta 2 horas antes."}
                  </p>
                  <Comentario
                    value={texto}
                    onChange={setTexto}
                    label="Motivo de la cancelación (obligatorio)"
                    placeholder="Cuéntanos por qué se cancela"
                  />
                </>
              )}

              {accion === "editar" && (
                <>
                  <div className="space-y-2">
                    <Label className="text-brand-dark">Tipo</Label>
                    <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCita)}>
                      <SelectTrigger className="!h-11 w-full rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CONSULTA">Consulta</SelectItem>
                        <SelectItem value="ESTUDIO">Estudio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Comentario value={motivo} onChange={setMotivo} label="Motivo" />
                </>
              )}

              <ErrorBox message={error} />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  reset();
                  onClose();
                }}
                className="rounded-xl"
              >
                Volver
              </Button>
              <Button
                disabled={saving || (accion === "reprogramar" && !slot)}
                onClick={() => void ejecutar()}
                className={cn("rounded-xl", peligro && "bg-destructive hover:bg-destructive/90")}
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                {accion === "confirmar"
                  ? "Sí, confirmar"
                  : accion === "reprogramar"
                    ? "Confirmar reprogramación"
                    : accion === "cerrar"
                      ? "Cerrar cita"
                      : accion === "cancelar"
                        ? "Sí, cancelar cita"
                        : "Guardar cambios"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Comentario({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="accion-texto" className="text-brand-dark">
        {label}
      </Label>
      <Textarea
        id="accion-texto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={1000}
        className="min-h-24 rounded-xl"
      />
    </div>
  );
}
