import { Ban, CalendarRange, CheckCircle2, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ESTADO_INFO, ESTADOS, formatDia, formatDop, formatPct, type Reporte } from "@/lib/citas";
import { cn } from "@/lib/utils";

/** Contenido del reporte (tarjetas, gráficos y tabla); se usa en pantalla y en la vista imprimible. */
export function ReporteContenido({ reporte }: { reporte: Reporte }) {
  const r = reporte;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta
          icon={CalendarRange}
          label="Total de citas"
          valor={String(r.total)}
          sub="En el período seleccionado"
        />
        <Tarjeta
          icon={CheckCircle2}
          label="Tasa de asistencia"
          valor={formatPct(r.tasaAsistencia)}
          sub={`${r.porEstado.ATENDIDA} atendidas de ${r.porEstado.ATENDIDA + r.porEstado.NO_ASISTIO} cerradas`}
        />
        <Tarjeta
          icon={Ban}
          label="Tasa de cancelación"
          valor={formatPct(r.tasaCancelacion)}
          sub={`${r.porEstado.CANCELADA} canceladas de ${r.total}`}
        />
        <Tarjeta
          icon={Wallet}
          label="Ingresos"
          valor={formatDop(r.ingresos)}
          sub="Citas atendidas"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)] print:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="gap-4 rounded-2xl border-none p-5 shadow-sm print:break-inside-avoid print:shadow-none">
          <h2 className="font-semibold text-brand-dark">Citas por estado</h2>
          <PorEstado reporte={r} />
        </Card>
        <Card className="gap-4 rounded-2xl border-none p-5 shadow-sm print:break-inside-avoid print:shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-brand-dark">Citas por día</h2>
            <Leyenda />
          </div>
          <PorDia reporte={r} />
        </Card>
      </div>

      <Card className="gap-0 overflow-hidden rounded-2xl border-none py-0 shadow-sm print:break-inside-avoid print:shadow-none">
        <h2 className="border-b p-5 font-semibold text-brand-dark">Por médico</h2>
        {r.porMedico.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">Sin citas en el período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="bg-muted/60 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Médico</th>
                  <th className="px-2 py-2.5 text-right font-medium">Total</th>
                  {ESTADOS.map((e) => (
                    <th key={e} className="px-2 py-2.5 text-right font-medium">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className={cn("size-2 rounded-full", ESTADO_INFO[e].dot)}
                          aria-hidden
                        />
                        {ESTADO_INFO[e].label}
                      </span>
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-right font-medium">Asistencia</th>
                  <th className="px-4 py-2.5 text-right font-medium">Ingresos</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {r.porMedico.map((m) => (
                  <tr key={m.medicoId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-brand-dark">{m.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.especialidad} · {m.centro}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums">{m.total}</td>
                    {ESTADOS.map((e) => (
                      <td
                        key={e}
                        className="px-2 py-3 text-right text-muted-foreground tabular-nums"
                      >
                        {m.porEstado[e]}
                      </td>
                    ))}
                    <td className="px-2 py-3 text-right tabular-nums">
                      {formatPct(m.tasaAsistencia)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatDop(m.ingresos)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/40 font-semibold">
                  <td className="px-4 py-3 text-brand-dark">Total</td>
                  <td className="px-2 py-3 text-right tabular-nums">{r.total}</td>
                  {ESTADOS.map((e) => (
                    <td key={e} className="px-2 py-3 text-right tabular-nums">
                      {r.porEstado[e]}
                    </td>
                  ))}
                  <td className="px-2 py-3 text-right tabular-nums">
                    {formatPct(r.tasaAsistencia)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatDop(r.ingresos)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Tarjeta({
  icon: Icon,
  label,
  valor,
  sub,
}: {
  icon: typeof Wallet;
  label: string;
  valor: string;
  sub: string;
}) {
  return (
    <Card className="gap-3 rounded-2xl border-none p-5 shadow-sm print:break-inside-avoid print:shadow-none">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="text-3xl font-bold tracking-tight text-brand-dark tabular-nums">{valor}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}

function Leyenda() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {ESTADOS.map((e) => (
        <li key={e} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", ESTADO_INFO[e].bar)} aria-hidden />{" "}
          {ESTADO_INFO[e].label}
        </li>
      ))}
    </ul>
  );
}

/** Barras horizontales: una por estado, con etiqueta y valor visibles. */
function PorEstado({ reporte }: { reporte: Reporte }) {
  const max = Math.max(1, ...ESTADOS.map((e) => reporte.porEstado[e]));
  return (
    <ul className="space-y-3">
      {ESTADOS.map((e) => {
        const n = reporte.porEstado[e];
        const pct = reporte.total ? Math.round((n / reporte.total) * 100) : 0;
        return (
          <li
            key={e}
            className="group space-y-1"
            title={`${ESTADO_INFO[e].label}: ${n} (${pct} %)`}
          >
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-brand-dark">{ESTADO_INFO[e].label}</span>
              <span className="font-semibold text-brand-dark tabular-nums">
                {n} <span className="text-xs font-normal text-muted-foreground">({pct} %)</span>
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-opacity group-hover:opacity-80",
                  ESTADO_INFO[e].bar,
                )}
                style={{ width: `${(n / max) * 100}%`, minWidth: n ? "0.5rem" : 0 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Columnas apiladas por día (un segmento por estado); tooltip al pasar el mouse. */
function PorDia({ reporte }: { reporte: Reporte }) {
  const dias = reporte.porDia;
  if (dias.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Sin citas en el período.</p>
    );
  }
  // Máximo par para que la marca del medio sea un entero (son conteos de citas)
  const mayor = Math.max(1, ...dias.map((d) => d.total));
  const max = mayor === 1 ? 2 : mayor + (mayor % 2);
  const marcas = [max, max / 2, 0];
  const cada = Math.ceil(dias.length / 10);
  return (
    <div className="flex gap-2">
      <div className="flex h-48 flex-col justify-between pb-6 text-right text-[0.65rem] text-muted-foreground tabular-nums">
        {marcas.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="relative flex h-48 min-w-fit items-end gap-[2px] border-b border-border pb-0">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border/70" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border/70" />
          {dias.map((d) => {
            const detalle = ESTADOS.filter((e) => d.porEstado[e])
              .map((e) => `${ESTADO_INFO[e].label}: ${d.porEstado[e]}`)
              .join(" · ");
            return (
              <div
                key={d.fecha}
                className="group relative flex h-full min-w-4 flex-1 flex-col justify-end"
              >
                <div
                  className="flex flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] group-hover:opacity-85"
                  style={{ height: `${(d.total / max) * 100}%` }}
                >
                  {ESTADOS.filter((e) => d.porEstado[e]).map((e) => (
                    <div
                      key={e}
                      className={ESTADO_INFO[e].bar}
                      style={{ flexGrow: d.porEstado[e] }}
                    />
                  ))}
                </div>
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max max-w-56 -translate-x-1/2 rounded-lg bg-brand-dark px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block"
                >
                  <p className="font-semibold first-letter:uppercase">{formatDia(d.fecha)}</p>
                  <p>{d.total ? `${d.total} citas · ${detalle}` : "Sin citas"}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex min-w-fit gap-[2px] pt-1">
          {dias.map((d, i) => (
            <span
              key={d.fecha}
              className="min-w-4 flex-1 text-center text-[0.6rem] text-muted-foreground"
            >
              {i % cada === 0 ? d.fecha.slice(8) + "/" + d.fecha.slice(5, 7) : ""}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Citas por día</caption>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Total</th>
            {ESTADOS.map((e) => (
              <th key={e}>{ESTADO_INFO[e].label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => (
            <tr key={d.fecha}>
              <td>{d.fecha}</td>
              <td>{d.total}</td>
              {ESTADOS.map((e) => (
                <td key={e}>{d.porEstado[e]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
