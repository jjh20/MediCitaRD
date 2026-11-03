import { CheckCircle2, Construction, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Lo que tendrá el módulo cuando se implemente */
  upcoming: string[];
  /** Respuesta del endpoint de la API protegido por rol */
  apiCheck: { modulo: string; usuario: string };
}

/**
 * Pantalla provisional de un módulo de negocio (épicas siguientes).
 * Solo demuestra la restricción por perfil en la web y en la API.
 */
export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  upcoming,
  apiCheck,
}: ModulePlaceholderProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card className="rounded-2xl border-none shadow-sm">
        <CardContent className="flex flex-col items-center gap-6 px-6 py-10 text-center sm:py-14">
          <span className="grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Icon className="size-8" />
          </span>
          <div className="max-w-md space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-[#8a5d00]">
              <Construction className="size-3.5" /> Módulo en construcción
            </p>
            <p className="text-muted-foreground">
              Esta sección estará disponible en las próximas épicas de MediCita RD.
            </p>
          </div>
          <ul className="grid w-full max-w-md gap-2 text-left">
            {upcoming.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-xl bg-muted px-4 py-3 text-sm"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Acceso verificado por la API: módulo <strong>{apiCheck.modulo}</strong> para{" "}
            <strong>{apiCheck.usuario}</strong>.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
