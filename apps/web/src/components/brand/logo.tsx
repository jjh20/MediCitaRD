import { cn } from "@/lib/utils";

export const TAGLINE = "Tu salud, nuestra prioridad";

/** Cruz médica dentro de un cuadro azul redondeado. */
export function MedicalCross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("size-10", className)}>
      <rect width="40" height="40" rx="11" fill="#1A6FE0" />
      <path
        d="M16.5 9.5h7v7h7v7h-7v7h-7v-7h-7v-7h7z"
        fill="#fff"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** "light" para fondos oscuros (barra lateral) */
  tone?: "dark" | "light";
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, tone = "dark", showTagline = false, size = "md" }: LogoProps) {
  const text = { sm: "text-lg", md: "text-xl", lg: "text-3xl" }[size];
  const icon = { sm: "size-8", md: "size-10", lg: "size-14" }[size];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <MedicalCross className={icon} />
      <div className="leading-tight">
        <p className={cn("font-extrabold tracking-tight", text)}>
          <span className={tone === "dark" ? "text-brand-dark" : "text-white"}>MediCita</span>{" "}
          <span className={tone === "dark" ? "text-brand" : "text-[#7fb2ff]"}>RD</span>
        </p>
        {showTagline && (
          <p className={cn("text-sm", tone === "dark" ? "text-muted-foreground" : "text-white/70")}>
            {TAGLINE}
          </p>
        )}
      </div>
    </div>
  );
}
