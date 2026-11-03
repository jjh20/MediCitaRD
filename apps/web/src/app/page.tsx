import { CalendarCheck, CreditCard, ShieldCheck, Stethoscope } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { Logo, TAGLINE } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ROLE_HOME } from "@/lib/roles";
import { AUTH_COOKIE, verifySession } from "@/lib/session";

const FEATURES = [
  {
    icon: Stethoscope,
    title: "Encuentra tu médico",
    text: "Busca especialistas y centros médicos cerca de ti.",
  },
  {
    icon: CalendarCheck,
    title: "Agenda en minutos",
    text: "Reserva citas y estudios según la disponibilidad real.",
  },
  {
    icon: CreditCard,
    title: "Paga en línea",
    text: "Completa el pago de forma segura desde tu celular.",
  },
  {
    icon: ShieldCheck,
    title: "Acceso seguro",
    text: "Cada perfil ve solo lo que le corresponde.",
  },
];

export default async function HomePage() {
  const session = await verifySession((await cookies()).get(AUTH_COOKIE)?.value);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo size="sm" />
        {session ? (
          <Button asChild size="sm">
            <Link href={ROLE_HOME[session.role]}>Ir a mi panel</Link>
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm" className="font-semibold text-brand">
            <Link href="/login">Iniciar sesión</Link>
          </Button>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="grid items-center gap-10 py-8 lg:grid-cols-2 lg:py-16">
          <div className="space-y-6 text-center lg:text-left">
            <p className="inline-block rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand">
              República Dominicana
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-brand-dark sm:text-5xl">
              {TAGLINE}
            </h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground lg:mx-0">
              Agenda tus citas médicas y estudios, págalos en línea y dales seguimiento desde un
              solo lugar.
            </p>
            {!session && (
              <div className="mx-auto flex max-w-sm flex-col gap-3 lg:mx-0">
                <Button asChild size="lg" className="h-12 w-full rounded-xl text-base">
                  <Link href="/registro">Crear cuenta</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 w-full rounded-xl border-brand text-base text-brand hover:text-brand"
                >
                  <Link href="/login">Ya tengo cuenta</Link>
                </Button>
              </div>
            )}
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand/20 to-brand-soft blur-2xl" />
            <div className="rounded-3xl bg-white p-6 shadow-xl shadow-brand/10">
              <Logo showTagline />
              <div className="mt-6 space-y-3">
                {[
                  "Consulta general · Mañana 9:30 a. m.",
                  "Hemograma completo · Jueves",
                  "Cardiología · 15 de noviembre",
                ].map((item, i) => (
                  <div key={item} className="flex items-center gap-3 rounded-2xl bg-background p-4">
                    <span className="grid size-10 place-items-center rounded-xl bg-brand text-white">
                      <CalendarCheck className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-brand-dark">
                        {item.split(" · ")[0]}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.split(" · ")[1]}</p>
                    </div>
                    {i === 0 && (
                      <span className="ml-auto rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                        Pagada
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-white p-6 shadow-sm">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 font-semibold text-brand-dark">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t bg-white py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} MediCita RD · {TAGLINE}
      </footer>
    </div>
  );
}
