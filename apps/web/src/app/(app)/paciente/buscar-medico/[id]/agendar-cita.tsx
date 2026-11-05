"use client";

import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Loader2,
  Stethoscope,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ErrorBox } from "@/components/citas/error-box";
import { SlotPicker } from "@/components/citas/slot-picker";
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
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api-client";
import {
  formatDop,
  formatFechaLarga,
  formatHora,
  TIPO_LABELS,
  type Cita,
  type Medico,
  type Slot,
  type TipoCita,
} from "@/lib/citas";
import { cn } from "@/lib/utils";
import { iniciales } from "../buscar-medico";

/** Perfil del médico → fecha y hora libres → confirmación con resumen y costo. */
export function AgendarCita({ medico }: { medico: Medico }) {
  const [slot, setSlot] = useState<Slot | null>(null);
  const [tipo, setTipo] = useState<TipoCita>("CONSULTA");
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<Cita | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

  const motivoValido = motivo.trim().length >= 3;

  async function agendar() {
    if (!slot) return;
    setSaving(true);
    setError(null);
    try {
      const cita = await api<Cita>("/citas", {
        method: "POST",
        body: JSON.stringify({
          medicoId: medico.id,
          fechaHora: slot.fechaHora,
          tipo,
          motivo: motivo.trim(),
        }),
      });
      setCreada(cita);
      setConfirmando(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo agendar la cita.");
      // El horario pudo haberse ocupado: refrescar la disponibilidad
      if (err instanceof ApiError && err.status === 409) {
        setConfirmando(false);
        setSlot(null);
        setPickerKey((k) => k + 1);
      }
    } finally {
      setSaving(false);
    }
  }

  if (creada) {
    return (
      <Card className="mx-auto max-w-xl items-center gap-5 rounded-3xl border-none p-8 text-center shadow-sm">
        <span className="grid size-16 place-items-center rounded-full bg-success/15 text-success">
          <CheckCircle2 className="size-9" />
        </span>
        <div>
          <p className="font-mono text-sm text-muted-foreground">{creada.codigo}</p>
          <h1 className="text-2xl font-bold text-brand-dark">¡Tu cita fue agendada!</h1>
          <p className="mt-1 text-muted-foreground">
            Quedó <strong className="text-[#8a5d00]">Pendiente</strong> hasta que el centro la
            confirme.
          </p>
        </div>
        <Resumen
          medico={medico}
          fechaHora={creada.fechaHora}
          tipo={creada.tipo}
          motivo={creada.motivo}
        />
        <div className="grid w-full gap-2 sm:grid-cols-2">
          <Button asChild className="h-11 rounded-xl">
            <Link href={`/paciente/citas/${creada.id}`}>Ver mi cita</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-xl">
            <Link href="/paciente/citas">Ir a mis citas</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link href="/paciente/buscar-medico">
          <ArrowLeft className="size-4" /> Volver a la búsqueda
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="h-fit gap-5 rounded-2xl border-none p-6 shadow-sm">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="grid size-20 place-items-center rounded-3xl bg-brand-soft text-2xl font-bold text-brand">
              {iniciales(medico.nombre)}
            </span>
            <div>
              <h1 className="text-xl font-bold text-brand-dark">{medico.nombre}</h1>
              <p className="font-medium text-brand">{medico.especialidad}</p>
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            <Info icon={Building2} label="Centro" value={medico.centro.fullName} />
            <Info icon={Clock} label="Horario" value={medico.horarioTexto} />
            <Info
              icon={Timer}
              label="Duración de la consulta"
              value={`${medico.duracionMin} minutos`}
            />
          </ul>
          <div className="rounded-xl bg-muted p-4 text-center">
            <p className="text-xs text-muted-foreground">Precio de la consulta</p>
            <p className="text-2xl font-bold text-brand-dark">{formatDop(medico.precioConsulta)}</p>
          </div>
        </Card>

        <Card className="gap-6 rounded-2xl border-none p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-brand-dark">Elige fecha y hora</h2>
            <p className="text-sm text-muted-foreground">
              Solo se muestran como disponibles los turnos libres.
            </p>
          </div>
          <SlotPicker
            key={pickerKey}
            medicoId={medico.id}
            diasSemana={medico.diasSemana}
            value={slot}
            onChange={(s) => {
              setSlot(s);
              setError(null);
            }}
          />

          <div className="space-y-2">
            <Label className="text-brand-dark">Tipo de cita</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["CONSULTA", "ESTUDIO"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  aria-pressed={tipo === t}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium",
                    tipo === t
                      ? "border-brand bg-brand-soft text-brand"
                      : "bg-white hover:bg-muted",
                  )}
                >
                  {t === "CONSULTA" ? (
                    <Stethoscope className="size-4" />
                  ) : (
                    <CalendarCheck className="size-4" />
                  )}
                  {TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo" className="text-brand-dark">
              Motivo de la cita
            </Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describe brevemente tus síntomas o el motivo de la consulta"
              maxLength={500}
              className="min-h-24 rounded-xl"
            />
          </div>

          <ErrorBox message={!confirmando ? error : null} />

          <Button
            disabled={!slot || !motivoValido}
            onClick={() => {
              setError(null);
              setConfirmando(true);
            }}
            className="h-12 rounded-xl text-base"
          >
            Continuar
          </Button>
          {(!slot || !motivoValido) && (
            <p className="-mt-3 text-center text-xs text-muted-foreground">
              {!slot ? "Elige un horario disponible" : "Escribe el motivo (mínimo 3 caracteres)"}{" "}
              para continuar.
            </p>
          )}
        </Card>
      </div>

      <Dialog open={confirmando} onOpenChange={(o) => !saving && setConfirmando(o)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-dark">Confirma tu cita</DialogTitle>
            <DialogDescription>Revisa el resumen antes de agendar.</DialogDescription>
          </DialogHeader>
          {slot && (
            <Resumen
              medico={medico}
              fechaHora={slot.fechaHora}
              tipo={tipo}
              motivo={motivo.trim()}
            />
          )}
          <ErrorBox message={error} />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setConfirmando(false)}
              className="rounded-xl"
            >
              Volver
            </Button>
            <Button disabled={saving} onClick={() => void agendar()} className="rounded-xl">
              {saving && <Loader2 className="size-4 animate-spin" />} Confirmar y agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <li className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-brand-dark first-letter:uppercase">{value}</p>
      </div>
    </li>
  );
}

function Resumen({
  medico,
  fechaHora,
  tipo,
  motivo,
}: {
  medico: Medico;
  fechaHora: string;
  tipo: TipoCita;
  motivo: string;
}) {
  const filas: [string, string][] = [
    ["Médico", `${medico.nombre} · ${medico.especialidad}`],
    ["Centro", medico.centro.fullName],
    ["Fecha", formatFechaLarga(fechaHora)],
    ["Hora", formatHora(fechaHora)],
    ["Tipo", TIPO_LABELS[tipo]],
    ["Motivo", motivo],
  ];
  return (
    <div className="w-full overflow-hidden rounded-xl border text-left">
      <dl className="divide-y text-sm">
        {filas.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[6rem_1fr] gap-2 px-4 py-2.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium text-brand-dark first-letter:uppercase">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between bg-brand-soft px-4 py-3">
        <span className="font-semibold text-brand-dark">Costo</span>
        <span className="text-xl font-bold text-brand">{formatDop(medico.precioConsulta)}</span>
      </div>
    </div>
  );
}
