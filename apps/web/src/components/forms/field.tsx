import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  error?: string;
};

/** Etiqueta + input con el estilo del prototipo y mensaje de error accesible. */
export function Field({ label, error, id, ...props }: FieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-brand-dark">
        {label}
      </Label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className="h-12 rounded-xl bg-background px-4 text-base md:text-sm"
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
