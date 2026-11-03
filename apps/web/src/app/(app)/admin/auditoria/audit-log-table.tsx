"use client";

import { Loader2, RotateCcw, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
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
import { AUDIT_ACTIONS, TONE_CLASSES, type AuditActionKey } from "@/lib/audit";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

interface AuditRow {
  id: string;
  action: string;
  detail: string | null;
  ip: string | null;
  createdAt: string;
  user: { email: string; fullName: string } | null;
}

interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 15;
const ALL = "todas";

const dateTime = new Intl.DateTimeFormat("es-DO", { dateStyle: "short", timeStyle: "medium" });

/** Los filtros de fecha usan el día completo en la zona horaria del navegador. */
function dayBoundary(value: string, end: boolean) {
  return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`).toISOString();
}

export function AuditLogTable() {
  const [action, setAction] = useState<string>(ALL);
  const [user, setUser] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AuditRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const debouncedUser = useDebounced(user);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (action !== ALL) params.set("action", action);
    if (debouncedUser) params.set("user", debouncedUser);
    if (from) params.set("from", dayBoundary(from, false));
    if (to) params.set("to", dayBoundary(to, true));
    try {
      const result = await api<Page<AuditRow>>(`/audit?${params}`);
      if (id === requestId.current) setData(result);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo cargar la auditoría.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [action, debouncedUser, from, to, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function filterBy<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function clearFilters() {
    setAction(ALL);
    setUser("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const hasFilters = action !== ALL || user || from || to;

  return (
    <Card className="gap-0 overflow-hidden rounded-2xl border-none py-0 shadow-sm">
      <div className="grid gap-3 border-b p-4 sm:grid-cols-2 lg:grid-cols-[14rem_1fr_10rem_10rem_auto] lg:items-end">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Acción</Label>
          <Select value={action} onValueChange={filterBy(setAction)}>
            <SelectTrigger
              className="!h-11 w-full rounded-xl bg-background"
              aria-label="Filtrar por acción"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las acciones</SelectItem>
              {Object.entries(AUDIT_ACTIONS).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-user" className="text-xs text-muted-foreground">
            Usuario
          </Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="audit-user"
              value={user}
              onChange={(e) => filterBy(setUser)(e.target.value)}
              placeholder="Correo o nombre"
              className="h-11 rounded-xl bg-background pl-9"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from" className="text-xs text-muted-foreground">
            Desde
          </Label>
          <Input
            id="audit-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => filterBy(setFrom)(e.target.value)}
            className="h-11 rounded-xl bg-background"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to" className="text-xs text-muted-foreground">
            Hasta
          </Label>
          <Input
            id="audit-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => filterBy(setTo)(e.target.value)}
            className="h-11 rounded-xl bg-background"
          />
        </div>
        <Button
          variant="ghost"
          onClick={clearFilters}
          disabled={!hasFilters}
          className="h-11 rounded-xl"
        >
          <RotateCcw className="size-4" /> Limpiar
        </Button>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando eventos…
        </div>
      ) : data && data.items.length === 0 ? (
        <p className="p-10 text-center text-muted-foreground">
          No hay eventos para los filtros seleccionados.
        </p>
      ) : (
        data && (
          <div className={cn("transition-opacity", loading && "opacity-60")}>
            <Table className="hidden md:table">
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="pl-4">Fecha y hora</TableHead>
                  <TableHead>Acción</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="pr-4">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">
                      {dateTime.format(new Date(row.createdAt))}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={row.action} />
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {row.user?.email ?? <span className="text-muted-foreground">Anónimo</span>}
                    </TableCell>
                    <TableCell className="max-w-md text-sm whitespace-normal">
                      {row.detail}
                    </TableCell>
                    <TableCell className="pr-4 font-mono text-xs text-muted-foreground">
                      {row.ip ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <ul className="divide-y md:hidden">
              {data.items.map((row) => (
                <li key={row.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <ActionBadge action={row.action} />
                    <span className="text-xs text-muted-foreground">
                      {dateTime.format(new Date(row.createdAt))}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-brand-dark">
                    {row.user?.email ?? "Anónimo"}
                  </p>
                  <p className="text-sm text-muted-foreground">{row.detail}</p>
                  {row.ip && <p className="font-mono text-xs text-muted-foreground">IP {row.ip}</p>}
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

function ActionBadge({ action }: { action: string }) {
  const meta = AUDIT_ACTIONS[action as AuditActionKey];
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full border-none", TONE_CLASSES[meta?.tone ?? "neutral"])}
    >
      {meta?.label ?? action}
    </Badge>
  );
}
