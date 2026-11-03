"use client";

import { Loader2, Search, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Pagination } from "@/components/pagination";
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
import { Input } from "@/components/ui/input";
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
import { ROLE_LABELS, ROLES, type Role } from "@/lib/roles";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

interface UserRow {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface RoleInfo {
  role: Role;
  label: string;
  permissions: string[];
}

type PendingChange =
  | { kind: "role"; user: UserRow; role: Role }
  | { kind: "status"; user: UserRow; isActive: boolean };

const PAGE_SIZE = 10;
const ALL = "todos";

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-brand-dark text-white",
  PACIENTE: "bg-brand-soft text-brand",
  CENTRO_MEDICO: "bg-success/15 text-success",
};

const dateFormat = new Intl.DateTimeFormat("es-DO", { dateStyle: "medium" });

export function UsersManager({ currentUserId }: { currentUserId: string }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<UserRow> | null>(null);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [saving, setSaving] = useState(false);
  const debouncedSearch = useDebounced(search);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (role !== ALL) params.set("role", role);
    if (status !== ALL) params.set("status", status);
    try {
      const result = await api<Page<UserRow>>(`/users?${params}`);
      if (id === requestId.current) setData(result); // ignora respuestas viejas
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudieron cargar los usuarios.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [debouncedSearch, role, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api<RoleInfo[]>("/users/roles")
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  // Al cambiar un filtro se vuelve a la primera página
  function filterBy<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  async function confirmChange() {
    if (!pending) return;
    setSaving(true);
    try {
      if (pending.kind === "role") {
        await api(`/users/${pending.user.id}/role`, {
          method: "PATCH",
          body: JSON.stringify({ role: pending.role }),
        });
        toast.success(`${pending.user.fullName} ahora es ${ROLE_LABELS[pending.role]}.`);
      } else {
        await api(`/users/${pending.user.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: pending.isActive }),
        });
        toast.success(
          `Cuenta de ${pending.user.fullName} ${pending.isActive ? "activada" : "desactivada"}.`,
        );
      }
      setPending(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "No se pudo guardar el cambio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="gap-0 overflow-hidden rounded-2xl border-none py-0 shadow-sm">
        {/* Filtros */}
        <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_12rem_12rem]">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => filterBy(setSearch)(e.target.value)}
              placeholder="Buscar por nombre o correo"
              aria-label="Buscar por nombre o correo"
              className="h-11 rounded-xl bg-background pl-9"
            />
          </div>
          <Select value={role} onValueChange={filterBy(setRole)}>
            <SelectTrigger
              className="!h-11 w-full rounded-xl bg-background"
              aria-label="Filtrar por rol"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los roles</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={filterBy(setStatus)}>
            <SelectTrigger
              className="!h-11 w-full rounded-xl bg-background"
              aria-label="Filtrar por estado"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los estados</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Desactivados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Cargando usuarios…
          </div>
        ) : data && data.items.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">
            No hay usuarios que coincidan con la búsqueda.
          </p>
        ) : (
          data && (
            <div className={cn("transition-opacity", loading && "opacity-60")}>
              {/* Escritorio: tabla */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead className="pl-4">Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead className="pr-4 text-right">Acceso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-4">
                        <UserIdentity user={user} isMe={user.id === currentUserId} />
                      </TableCell>
                      <TableCell>
                        <RoleSelect
                          user={user}
                          disabled={user.id === currentUserId}
                          onPick={(r) => setPending({ kind: "role", user, role: r })}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge active={user.isActive} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {dateFormat.format(new Date(user.createdAt))}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <StatusButton
                          user={user}
                          disabled={user.id === currentUserId}
                          onPick={(isActive) => setPending({ kind: "status", user, isActive })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Celular: tarjetas */}
              <ul className="divide-y md:hidden">
                {data.items.map((user) => (
                  <li key={user.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <UserIdentity user={user} isMe={user.id === currentUserId} />
                      <StatusBadge active={user.isActive} />
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <RoleSelect
                        user={user}
                        disabled={user.id === currentUserId}
                        onPick={(r) => setPending({ kind: "role", user, role: r })}
                      />
                      <StatusButton
                        user={user}
                        disabled={user.id === currentUserId}
                        onPick={(isActive) => setPending({ kind: "status", user, isActive })}
                      />
                    </div>
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

      {roles.length > 0 && (
        <Card className="gap-4 rounded-2xl border-none p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold text-brand-dark">
            <ShieldCheck className="size-5 text-brand" /> Roles y permisos
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {roles.map((info) => (
              <div key={info.role} className="rounded-xl bg-muted p-4">
                <Badge className={cn("rounded-full", ROLE_BADGE[info.role])}>{info.label}</Badge>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {info.permissions.map((p) => (
                    <li key={p}>
                      <code className="text-xs">{p}</code>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => !open && !saving && setPending(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          {pending && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pending.kind === "role"
                    ? "¿Cambiar el rol?"
                    : pending.isActive
                      ? "¿Activar la cuenta?"
                      : "¿Desactivar la cuenta?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {pending.kind === "role" ? (
                    <>
                      <strong>{pending.user.fullName}</strong> pasará de{" "}
                      <strong>{ROLE_LABELS[pending.user.role]}</strong> a{" "}
                      <strong>{ROLE_LABELS[pending.role]}</strong>. Su sesión actual se cerrará y
                      verá solo las opciones del nuevo perfil.
                    </>
                  ) : pending.isActive ? (
                    <>
                      <strong>{pending.user.fullName}</strong> podrá volver a iniciar sesión.
                    </>
                  ) : (
                    <>
                      <strong>{pending.user.fullName}</strong> no podrá iniciar sesión y su sesión
                      actual se cerrará.
                    </>
                  )}{" "}
                  El cambio quedará registrado en la auditoría.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={saving}
                  onClick={(e) => {
                    e.preventDefault();
                    void confirmChange();
                  }}
                  className={cn(
                    pending.kind === "status" &&
                      !pending.isActive &&
                      "bg-destructive hover:bg-destructive/90",
                  )}
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {pending.kind === "role"
                    ? "Sí, cambiar rol"
                    : pending.isActive
                      ? "Sí, activar"
                      : "Sí, desactivar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserIdentity({ user, isMe }: { user: UserRow; isMe: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-medium text-brand-dark">
        {user.fullName}
        {isMe && <span className="ml-2 text-xs font-normal text-muted-foreground">(tú)</span>}
      </p>
      <p className="truncate text-sm text-muted-foreground">{user.email}</p>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border-none",
        active ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
      )}
    >
      {active ? "Activo" : "Desactivado"}
    </Badge>
  );
}

function RoleSelect({
  user,
  disabled,
  onPick,
}: {
  user: UserRow;
  disabled: boolean;
  onPick: (role: Role) => void;
}) {
  return (
    <Select
      value={user.role}
      disabled={disabled}
      onValueChange={(value) => value !== user.role && onPick(value as Role)}
    >
      <SelectTrigger
        className="w-full rounded-xl md:w-44"
        aria-label={`Rol de ${user.fullName}`}
        title={disabled ? "No puedes cambiar tu propio rol" : undefined}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function StatusButton({
  user,
  disabled,
  onPick,
}: {
  user: UserRow;
  disabled: boolean;
  onPick: (isActive: boolean) => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => onPick(!user.isActive)}
      title={disabled ? "No puedes desactivar tu propia cuenta" : undefined}
      className={cn(
        "rounded-xl",
        user.isActive
          ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
          : "text-success hover:bg-success/10 hover:text-success",
      )}
    >
      {user.isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
      {user.isActive ? "Desactivar" : "Activar"}
    </Button>
  );
}
