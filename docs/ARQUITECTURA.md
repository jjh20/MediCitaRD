# Arquitectura: MediCita RD (Épicas 1, 2 y 3)

## Vista general

```
┌──────────────┐  /api/* (mismo origen)   ┌─────────────────────┐  HTTP + cookie   ┌──────────────────┐   Prisma   ┌──────────────┐
│  Navegador   │ ───────────────────────▶ │  Web · Next.js 15   │ ───────────────▶ │  API · NestJS 11 │ ─────────▶ │ PostgreSQL 16│
│ (cookie JWT  │ ◀─────────────────────── │  :3000              │ ◀─────────────── │  :4000/api       │ ◀───────── │  (Docker)    │
│  httpOnly)   │      páginas por rol     │  middleware.ts      │   JSON           │  Guards + Prisma │            │  medicita    │
└──────────────┘                          └─────────────────────┘                  └──────────────────┘            └──────────────┘
                                            │  POST /api/audit/access-denied (x-internal-key)  ▲
                                            └──────────────────────────────────────────────────┘
```

```mermaid
flowchart LR
  B[Navegador] -->|"/api/* (proxy)"| W["Web · Next.js<br/>middleware.ts"]
  W -->|"cookie JWT reenviada"| A["API · NestJS<br/>JwtAuthGuard + RolesGuard"]
  W -.->|"accesos denegados<br/>x-internal-key"| A
  A -->|Prisma ORM| D[(PostgreSQL)]
```

- **Proxy del mismo origen:** el navegador solo habla con `localhost:3000`. Next reenvía `/api/*` a la API (`rewrites` en `next.config.ts`), así que la cookie `httpOnly` pertenece al dominio de la web y el `middleware.ts` puede leerla. La API además tiene CORS configurado para `WEB_URL` con `credentials`.
- **Defensa en dos capas:** el middleware de Next filtra las páginas (experiencia de usuario y primera barrera), y la API vuelve a validar sesión y rol en **cada** petición. Ninguna regla depende solo del frontend.

## Flujo de autenticación

```mermaid
sequenceDiagram
  participant N as Navegador
  participant W as Next.js
  participant A as API NestJS
  participant DB as PostgreSQL
  N->>W: POST /api/auth/login
  W->>A: (proxy) POST /api/auth/login
  A->>DB: buscar usuario + bcrypt.compare
  A->>DB: AuditLog LOGIN_SUCCESS
  A-->>N: 200 + Set-Cookie medicita_token (httpOnly, lax, 8h)
  N->>W: GET /admin/usuarios
  W->>W: middleware: verifica JWT (jose) y rol
  alt sin sesión
    W-->>N: 307 /login?next=… (+ audita 401)
  else rol incorrecto
    W-->>N: 307 /acceso-denegado (+ audita 403)
  else autorizado
    W->>A: GET /api/auth/me (cookie reenviada)
    A->>DB: usuario activo y con el mismo rol que el token?
    A-->>W: 200 usuario  (o 401 → /sesion/expirada)
    W-->>N: página con menú del rol
  end
```

**Invalidación inmediata:** `JwtAuthGuard` consulta al usuario en la base en cada petición. Si está desactivado o su rol ya no coincide con el del token, responde 401 y borra la cookie. La web lo envía a `/sesion/expirada`, que limpia la cookie y redirige al login con un aviso.

## Módulos

### API (`apps/api/src`)

| Módulo | Responsabilidad |
|---|---|
| `auth/` | Registro, login, logout y `me`. `AuthService` (bcrypt, JWT, cookie), decoradores `@Public()`, `@Roles()` y `@CurrentUser()`, guards globales `JwtAuthGuard` (401) y `RolesGuard` (403), matriz `ROLE_PERMISSIONS`. |
| `users/` | Gestión de usuarios para el admin: listar y buscar, cambiar rol, activar y desactivar. Reglas: no modificarse a sí mismo; siempre al menos un admin activo (transacción `Serializable`). |
| `audit/` | `AuditService.record()` (nunca rompe la operación auditada) y `find()` con filtros; `GET /audit`; `POST /audit/access-denied` protegido por `InternalKeyGuard` (comparación en tiempo constante). |
| `modules/` | Endpoints provisionales `/modules/paciente` y `/modules/centro`, restringidos por rol (se conservan para las pruebas de acceso de la Épica 1). |
| `medicos/` | **Épica 2.** CRUD de médicos del centro, búsqueda por especialidad, catálogo de especialidades y disponibilidad por día. |
| `citas/` | **Épica 2.** `cita-rules.ts`: reglas R1 a R9 como funciones puras. `CitasService`: crear, listar con filtros, detalle, PATCH, reprogramar, confirmar, cerrar, cancelar e historial; control de acceso por rol (403 auditado); transacción `Serializable` con historial en la misma transacción y bloqueo optimista. |
| `reportes/` | **Épica 2.** Reporte de citas (totales por estado, por médico y por día, tasas e ingresos) en JSON y CSV. |
| `inventario/` | **Épica 3.** `inventario-rules.ts`: reglas L1 a L10 como funciones puras (FEFO, alertas y transiciones del equipo). `RecursosService`: CRUD, filtros con alertas, disponibilidad y baja. `MovimientosService`: entradas, salidas, consumo en citas, ajustes, asignaciones y devoluciones dentro de una transacción con la fila del recurso bloqueada (`FOR UPDATE`); historial y listado. `InventarioReportesService`: existencias y movimientos en JSON y CSV. |
| `prisma/` | `PrismaService` global. |
| `common/` | Política de contraseñas, paginación, utilidades de petición (IP y descripción) y `rd-time.ts` (fechas en hora de República Dominicana, UTC−4). |
| `config/` | Validación de variables de entorno al arrancar. |
| `setup.ts` | Configuración HTTP común a `main.ts` y a las e2e: `helmet`, `cookie-parser`, prefijo `/api`, CORS, `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) y `trust proxy` en loopback. |

### Web (`apps/web/src`)

| Ruta o archivo | Contenido |
|---|---|
| `middleware.ts` | Verifica el JWT con `jose` (mismo `JWT_SECRET`), aplica `ROUTE_RULES` por prefijo, redirige a login (401) o a acceso denegado (403) y reporta ambos casos a la API con `x-internal-key`. |
| `app/page.tsx` | Inicio y bienvenida (pública). |
| `app/(auth)/login`, `app/(auth)/registro` | Iniciar sesión y Crear cuenta (selector Paciente o Centro médico; validación en vivo de la contraseña). |
| `app/acceso-denegado` | Pantalla 403. |
| `app/sesion/expirada` | Route handler que borra la cookie y vuelve al login. |
| `app/(app)/layout.tsx` | Área autenticada: consulta `/auth/me` y pinta `AppShell` (barra lateral o menú de celular según el rol). |
| `app/(app)/paciente/citas`, `citas/[id]` | Mis citas (Próximas e Historial) y detalle con historial, reprogramar, editar y cancelar. |
| `app/(app)/paciente/buscar-medico`, `buscar-medico/[id]` | Búsqueda por especialidad, y perfil del médico con selector de turnos libres y confirmación con resumen y costo. |
| `app/(app)/paciente/pagos` | Pagos (provisional). |
| `app/(app)/centro/agenda`, `agenda/[id]` | Agenda del centro con filtros, y detalle con confirmar, reprogramar, cerrar, cancelar y la línea de tiempo. |
| `app/(app)/centro/medicos` | Médicos y horarios (CRUD, activar y desactivar). |
| `app/(app)/centro/reportes`, `reportes/imprimir` | Reporte de su centro y vista imprimible. |
| `app/(app)/admin/usuarios` | Usuarios y roles (funcional, con diálogos de confirmación). |
| `app/(app)/admin/auditoria` | Auditoría (funcional, con filtros por acción, usuario y fechas). |
| `app/(app)/admin/operaciones`, `operaciones/[id]` | Todas las citas con filtros por estado, fecha, centro y médico; detalle de solo lectura. |
| `app/(app)/admin/reportes`, `reportes/imprimir` | Reporte global, descarga CSV y vista imprimible. |
| `components/citas/*` | Insignia de estado, selector de turnos, tabla de citas con filtros, detalle con diálogos de acción y línea de tiempo del historial. |
| `components/reportes/*` | Tarjetas, gráficos de barras (CSS, sin dependencias), tabla por médico y vista imprimible. |
| `lib/citas.ts` | Tipos, colores y etiquetas de estado, y formato de fechas (zona `America/Santo_Domingo`) y de DOP. |
| `app/(app)/centro/inventario/*` | **Épica 3.** Recursos (tabla con filtros y alertas), detalle `[id]` (disponibilidad, acciones en diálogos e historial), `movimientos` y `reportes` (más `imprimir`). |
| `app/(app)/admin/inventario/*` | Las mismas vistas en solo lectura, con filtro por centro. |
| `components/inventario/*` | Insignias de alertas y estados, pestañas de la sección, tabla de recursos, formulario, detalle con diálogos de movimiento, tabla y línea de tiempo de movimientos, reportes y el diálogo "Registrar insumos usados" de la cita. |
| `lib/inventario.ts` | Tipos, etiquetas y colores de los tipos de movimiento, estados del equipo y estados de los lotes. |
| `lib/roles.ts` | Roles, etiquetas, página de inicio por rol, menú por rol y reglas de rutas. |
| `lib/api-client.ts`, `lib/api-server.ts` | `fetch` del navegador (mismo origen) y del servidor (reenvía la cookie). |

## Endpoints

Prefijo: `http://localhost:4000/api` (o `/api` desde la web mediante el proxy).

| Método | Ruta | Acceso | Descripción | Respuestas |
|---|---|---|---|---|
| GET | `/health` | Público | Estado de la API. | 200 |
| POST | `/auth/register` | Público | `{fullName, email, password, role: PACIENTE \| CENTRO_MEDICO}`. Crea la cuenta e inicia sesión. | 201, 400, 409 |
| POST | `/auth/login` | Público | `{email, password}`. Emite la cookie `medicita_token`. | 200, 400, 401, 403 (desactivado) |
| POST | `/auth/logout` | Público* | Borra la cookie; audita si el token es válido. | 200 |
| GET | `/auth/me` | Autenticado | Usuario actual, rol y permisos. | 200, 401 |
| GET | `/users?search=&role=&status=&page=&pageSize=` | ADMIN | Lista paginada de usuarios (sin `passwordHash`). | 200, 400, 401, 403 |
| GET | `/users/roles` | ADMIN | Catálogo de roles con permisos. | 200, 401, 403 |
| PATCH | `/users/:id/role` | ADMIN | `{role}`. Cambia el rol (no a sí mismo ni al último admin activo). | 200, 400, 401, 403, 404, 409 |
| PATCH | `/users/:id/status` | ADMIN | `{isActive}`. Activa o desactiva (mismas reglas). | 200, 400, 401, 403, 404, 409 |
| GET | `/audit?action=&user=&from=&to=&page=&pageSize=` | ADMIN | Eventos de auditoría filtrados, del más reciente al más antiguo. | 200, 400, 401, 403 |
| POST | `/audit/access-denied` | Clave interna | `{path, status: 401\|403, userId?, role?, ip?}`, enviado por el middleware de Next. | 204, 400, 401 |
| GET | `/modules/paciente` | PACIENTE | Módulo provisional. | 200, 401, 403 |
| GET | `/modules/centro` | CENTRO_MEDICO | Módulo provisional. | 200, 401, 403 |

\* Es pública para poder borrar la cookie aunque el token ya haya expirado.

### Épica 2: médicos, citas y reportes

| Método | Ruta | Acceso | Descripción | Respuestas |
|---|---|---|---|---|
| GET | `/medicos?especialidad=&texto=&centroId=&page=&pageSize=` | Autenticado | Busca médicos. El paciente ve los activos, el centro solo los suyos (también inactivos) y el admin todos. | 200, 400, 401 |
| GET | `/medicos/especialidades` | Autenticado | Especialidades disponibles (para el filtro de búsqueda). | 200, 401 |
| GET | `/medicos/:id` | Autenticado | Perfil del médico (horario, duración y precio). | 200, 401, 403, 404 |
| GET | `/medicos/:id/disponibilidad?fecha=AAAA-MM-DD` | Autenticado | Turnos del día con `disponible` y `motivo` (`ocupado`, `pasado` o `fuera de rango`). | 200, 400, 401, 403, 404 |
| POST | `/medicos` | CENTRO_MEDICO | `{nombre, especialidad, precioConsulta, duracionMin?, diasSemana[], horaInicio, horaFin}`. | 201, 400, 401, 403 |
| PATCH | `/medicos/:id` | CENTRO_MEDICO (dueño) | Edita cualquier campo de los anteriores. | 200, 400, 401, 403, 404 |
| PATCH | `/medicos/:id/estado` | CENTRO_MEDICO (dueño) | `{activo}`: activa o desactiva. | 200, 400, 401, 403, 404 |
| POST | `/citas` | PACIENTE | `{medicoId, fechaHora (ISO 8601), tipo?, motivo}`. Aplica R1 a R5 y R10. | 201, 400, 401, 403, 404, 409 |
| GET | `/citas?estado=A,B&desde=&hasta=&medicoId=&centroId=&pacienteId=&texto=&orden=asc\|desc&page=&pageSize=` | Autenticado (alcance por rol) | Lista paginada y ordenada por fecha. El paciente ve las suyas, el centro las de su centro y el admin todas. | 200, 400, 401 |
| GET | `/citas/:id` | Dueño, su centro o admin | Detalle de la cita. | 200, 401, 403, 404 |
| GET | `/citas/:id/historial` | Dueño, su centro o admin | Historial completo en orden cronológico. | 200, 401, 403, 404 |
| PATCH | `/citas/:id` | PACIENTE (dueño) o CENTRO_MEDICO (de la cita) | `{motivo?, tipo?}` (R7). | 200, 400, 401, 403, 404, 409 |
| POST | `/citas/:id/reprogramar` | PACIENTE o CENTRO_MEDICO | `{fechaHora, comentario?}`. Vuelve a Pendiente (R1 a R7, R10). | 200, 400, 401, 403, 404, 409 |
| POST | `/citas/:id/confirmar` | CENTRO_MEDICO | `{comentario?}`. Pendiente → Confirmada. | 200, 401, 403, 404, 409 |
| POST | `/citas/:id/cerrar` | CENTRO_MEDICO | `{resultado: ATENDIDA\|NO_ASISTIO, notas?}` (R9). | 200, 400, 401, 403, 404, 409 |
| POST | `/citas/:id/cancelar` | PACIENTE o CENTRO_MEDICO | `{motivo}` (R8). | 200, 400, 401, 403, 404, 409 |
| GET | `/reportes/citas?desde=&hasta=&centroId=&medicoId=` | ADMIN (global) o CENTRO_MEDICO (su centro) | `{total, porEstado, tasaAsistencia, tasaCancelacion, ingresos, porMedico[], porDia[]}`. | 200, 400, 401, 403 |
| GET | `/reportes/citas.csv?…` | ADMIN o CENTRO_MEDICO | El mismo reporte en CSV (UTF-8 con BOM): resumen, por médico, por día y detalle. | 200, 400, 401, 403 |

Códigos de las reglas de negocio: **400** cuando el dato no es válido (R1, R2, R5, R8 y R9) y **409** cuando hay conflicto con el estado actual o con otra cita (R3, R4, R6, R7 y R10). Si alguien intenta acceder a una cita o un médico de otro usuario, la API responde **403** "Acceso denegado: esta cita no te pertenece." y lo audita como `ACCESS_DENIED_403`.

Formato de error (NestJS): `{ "statusCode": 403, "error": "Forbidden", "message": "Acceso denegado: tu perfil no tiene permiso para este recurso." }`. Los errores de validación devuelven `message` como arreglo.

### Épica 3: inventario

| Método | Ruta | Acceso | Descripción | Respuestas |
|---|---|---|---|---|
| POST | `/recursos` | CENTRO_MEDICO | `{nombre, tipo: INSUMO\|EQUIPO, categoria, unidad, costoUnitario, stockMinimo?, requiereVencimiento?, numeroSerie?}`. Insumo con stock 0; equipo DISPONIBLE. | 201, 400, 401, 403, 409 |
| GET | `/recursos?tipo=&categoria=&texto=&centroId=&estado=&page=&pageSize=` | CENTRO_MEDICO (los suyos) o ADMIN (todos) | `estado`: `bajo_stock`, `proximo_vencer`, `vencido`, `disponible`, `asignado`, `mantenimiento` o `inactivo`. Devuelve también `resumen` con el total de cada alerta. | 200, 400, 401, 403 |
| GET | `/recursos/:id` | Dueño o admin | Recurso con disponible, valor, alertas y lotes con existencias. | 200, 401, 403, 404 |
| PATCH | `/recursos/:id` | CENTRO_MEDICO (dueño) | Edita nombre, categoría, unidad, costo, mínimo y número de serie (nunca el stock). | 200, 400, 401, 403, 404, 409 |
| PATCH | `/recursos/:id/estado` | CENTRO_MEDICO (dueño) | `{activo, motivo?}`: activar o dar de baja. En los equipos crea un AJUSTE (estado → BAJA o DISPONIBLE). | 200, 400, 401, 403, 404, 409 |
| GET | `/recursos/:id/disponibilidad` | Dueño o admin | Insumo: disponible sin vencidos y lotes con estado (`VIGENTE`, `PROXIMO_A_VENCER`, `VENCIDO`) y `utilizable`. Equipo: estado, médico asignado, devolución prevista y si está atrasada. | 200, 401, 403, 404 |
| GET | `/recursos/:id/movimientos` | Dueño o admin | Historial completo del recurso, del más antiguo al más reciente. | 200, 401, 403, 404 |
| POST | `/movimientos/entrada` | CENTRO_MEDICO | `{recursoId, cantidad, numeroLote?, fechaVencimiento?, referencia?, costoUnitario?, motivo?}` (L1, L3, L6). | 201, 400, 401, 403, 404, 409 |
| POST | `/movimientos/salida` | CENTRO_MEDICO | `{recursoId, cantidad, motivo?, citaId?}`. FEFO: un movimiento por lote (L1, L2, L3, L6, L8, L9). | 201, 400, 401, 403, 404, 409 |
| POST | `/movimientos/consumo` | CENTRO_MEDICO | `{citaId, items: [{recursoId, cantidad}]}`. Varias salidas ligadas a una cita ATENDIDA, todo o nada (L8). | 201, 400, 401, 403, 404, 409 |
| POST | `/movimientos/ajuste` | CENTRO_MEDICO | Insumo: `{recursoId, sentido: AUMENTO\|DISMINUCION, cantidad, motivo, loteId?}` (L7). Equipo: `{recursoId, estadoEquipo: MANTENIMIENTO\|DISPONIBLE, motivo}`. | 201, 400, 401, 403, 404, 409 |
| POST | `/movimientos/asignacion` | CENTRO_MEDICO | `{recursoId, medicoId, fechaDevolucionPrevista, motivo?}` (L4). | 201, 400, 401, 403, 404, 409 |
| POST | `/movimientos/devolucion` | CENTRO_MEDICO | `{recursoId, motivo?}` (L5). | 201, 401, 403, 404, 409 |
| GET | `/movimientos?tipo=&recursoId=&medicoId=&citaId=&centroId=&desde=&hasta=&usuario=&texto=&page=&pageSize=` | CENTRO_MEDICO (los suyos) o ADMIN (todos) | Movimientos del más reciente al más antiguo. **No hay PATCH ni DELETE:** son inmutables. | 200, 400, 401, 403 |
| GET | `/reportes/existencias[.csv]?centroId=` | CENTRO_MEDICO (su centro) o ADMIN | Totales (valor total en DOP, bajo stock, próximo a vencer, vencido), equipos por estado, valor por categoría, listas de alertas y existencias por recurso. | 200, 400, 401, 403 |
| GET | `/reportes/movimientos[.csv]?desde=&hasta=&centroId=` | CENTRO_MEDICO (su centro) o ADMIN | Totales de entradas y salidas, por tipo, por recurso, por día y consumo por cita (rango por defecto: últimos 21 días). | 200, 400, 401, 403 |

Códigos del inventario: **400** cuando el dato no es válido (L1, L3, L4 por médico o fecha, L7 sin motivo) y **409** cuando hay conflicto con el estado actual (L2, L4 equipo no disponible, L5, L6, L7 stock negativo, L8 cita no atendida). Un recurso o una cita de otro centro responde **403** y se audita como `ACCESS_DENIED_403`.

## Modelo de datos

```mermaid
erDiagram
  User ||--o{ AuditLog : "realiza (opcional)"
  User {
    uuid id PK
    varchar fullName
    varchar email UK
    string passwordHash
    Role role "ADMIN | PACIENTE | CENTRO_MEDICO"
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }
  AuditLog {
    uuid id PK
    uuid userId FK "nullable, ON DELETE SET NULL"
    varchar action
    varchar detail "nullable, máx. 500"
    varchar ip "nullable"
    datetime createdAt
  }
  User ||--o{ Medico : "centro publica"
  User ||--o{ Cita : "paciente agenda"
  User ||--o{ Cita : "centro atiende"
  Medico ||--o{ Cita : "responsable"
  Cita ||--o{ CitaHistorial : "cambios"
  User ||--o{ CitaHistorial : "actor"
  Medico {
    uuid id PK
    uuid centroId FK "User CENTRO_MEDICO"
    varchar nombre
    varchar especialidad
    decimal precioConsulta "DOP"
    int duracionMin "por defecto 30"
    int[] diasSemana "1=lunes … 7=domingo"
    varchar horaInicio "HH:mm (RD)"
    varchar horaFin "HH:mm (RD)"
    boolean activo
    datetime createdAt
    datetime updatedAt
  }
  Cita {
    uuid id PK
    varchar codigo UK "CIT-0001 (secuencia)"
    uuid pacienteId FK
    uuid medicoId FK
    uuid centroId FK
    datetime fechaHora "UTC"
    TipoCita tipo "CONSULTA | ESTUDIO"
    varchar motivo
    EstadoCita estado
    decimal costo "copia del precio"
    varchar notasCierre "nullable"
    varchar motivoCancelacion "nullable"
    datetime createdAt
    datetime updatedAt
  }
  CitaHistorial {
    uuid id PK
    uuid citaId FK "ON DELETE CASCADE"
    uuid usuarioId FK "nullable"
    AccionCita accion
    EstadoCita estadoAnterior "nullable"
    EstadoCita estadoNuevo "nullable"
    json cambios "campo: {antes, despues}"
    varchar comentario "nullable"
    datetime createdAt
  }
```

- **Role:** enum `ADMIN`, `PACIENTE`, `CENTRO_MEDICO`. Índice por `role`.
- **AuditLog:** índices por `action`, `userId` y `createdAt`. `userId` es el **actor** (quien hizo la acción); el usuario afectado aparece en `detail`. El filtro "usuario" de la auditoría busca en ambos.
- **Acciones auditadas:** `REGISTER`, `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `ROLE_CHANGED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `ACCESS_DENIED_401`, `ACCESS_DENIED_403` y, desde la Épica 2, `MEDICO_CREADO`, `MEDICO_ACTUALIZADO`, `MEDICO_ACTIVADO`, `MEDICO_DESACTIVADO`, `CITA_CREADA`, `CITA_ACTUALIZADA`, `CITA_REPROGRAMADA`, `CITA_CONFIRMADA`, `CITA_CERRADA` y `CITA_CANCELADA`.
- **Medico:** índices por `centroId` y `especialidad`. El horario se interpreta en hora de RD.
- **Cita:** índices por `estado`, `fechaHora`, `medicoId`, `centroId` y `pacienteId`. `codigo` lo genera la base con la secuencia `Cita_codigo_seq`. Además hay **dos índices únicos parciales** (en SQL, porque Prisma no los modela): `(medicoId, fechaHora)` y `(pacienteId, fechaHora)` `WHERE estado IN ('PENDIENTE','CONFIRMADA')`. Son la última barrera de R3, R4 y R10.
- **CitaHistorial:** índice por `(citaId, createdAt)`. Se escribe en la **misma transacción** que el cambio de la cita.
- **AccionCita:** `CREADA`, `ACTUALIZADA`, `REPROGRAMADA`, `CONFIRMADA`, `CERRADA`, `CANCELADA`.
- Esquema: [apps/api/prisma/schema.prisma](../apps/api/prisma/schema.prisma). Migraciones: `apps/api/prisma/migrations/` (`20261103055551_init`, `20261104120000_epica2_citas` y `20261111120000_epica3_inventario`).

## Ciclo de vida de la cita (estados)

```mermaid
stateDiagram-v2
  [*] --> PENDIENTE: paciente agenda (POST /citas)
  PENDIENTE --> CONFIRMADA: centro confirma
  PENDIENTE --> CANCELADA: paciente (≥ 2 h antes) o centro, con motivo
  CONFIRMADA --> ATENDIDA: centro cierra con notas (después de la hora)
  CONFIRMADA --> NO_ASISTIO: centro cierra (después de la hora)
  CONFIRMADA --> CANCELADA: paciente (≥ 2 h antes) o centro, con motivo
  PENDIENTE --> PENDIENTE: reprogramar / editar motivo o tipo
  CONFIRMADA --> PENDIENTE: reprogramar
  CONFIRMADA --> CONFIRMADA: editar motivo o tipo
  ATENDIDA --> [*]
  NO_ASISTIO --> [*]
  CANCELADA --> [*]
```

- **Estados activos:** `PENDIENTE` y `CONFIRMADA`. Ocupan el turno del médico y del paciente.
- **Estados cerrados:** `ATENDIDA`, `NO_ASISTIO` y `CANCELADA`. No se pueden modificar (R7) y liberan el turno.
- Cualquier transición que no está en el diagrama responde **409** (R6).

### Flujo de una operación sobre la cita

```mermaid
sequenceDiagram
  participant U as Paciente o centro
  participant A as API (CitasService)
  participant DB as PostgreSQL
  U->>A: POST /citas/:id/reprogramar
  A->>DB: cargar la cita y verificar el acceso (403 auditado)
  A->>DB: BEGIN ISOLATION LEVEL SERIALIZABLE
  A->>A: reglas R1, R2, R5, R6 y R7 (cita-rules.ts)
  A->>DB: R3 y R4: ¿otra cita activa a esa hora?
  A->>DB: UPDATE … WHERE id AND estado AND updatedAt (bloqueo optimista)
  A->>DB: INSERT CitaHistorial (REPROGRAMADA, antes → después)
  A->>DB: COMMIT (índice único parcial o conflicto → 409)
  A->>DB: AuditLog CITA_REPROGRAMADA
  A-->>U: 200 cita actualizada
```

## Modelo del inventario (Épica 3)

```mermaid
erDiagram
  User ||--o{ Recurso : "centro registra"
  Recurso ||--o{ Lote : "lotes (insumos con vencimiento)"
  Recurso ||--o{ Movimiento : "historial"
  Lote ||--o{ Movimiento : "lote afectado"
  User ||--o{ Movimiento : "usuario que registra"
  Medico ||--o{ Movimiento : "asignaciones"
  Medico ||--o{ Recurso : "equipo asignado"
  Cita ||--o{ Movimiento : "consumo en la cita"
  Recurso {
    uuid id PK
    uuid centroId FK "User CENTRO_MEDICO"
    varchar codigo UK "REC-0001 (secuencia)"
    varchar nombre "único por centro"
    TipoRecurso tipo "INSUMO | EQUIPO"
    CategoriaRecurso categoria
    varchar unidad
    int stockActual "solo INSUMO, CHECK >= 0"
    int stockMinimo "solo INSUMO"
    decimal costoUnitario "último costo (DOP)"
    boolean requiereVencimiento
    EstadoEquipo estadoEquipo "solo EQUIPO"
    varchar numeroSerie "nullable"
    uuid medicoAsignadoId FK "nullable"
    datetime devolucionPrevista "nullable"
    boolean activo
  }
  Lote {
    uuid id PK
    uuid recursoId FK
    varchar numeroLote "único por recurso"
    date fechaVencimiento
    int cantidadDisponible "CHECK >= 0"
    datetime createdAt
  }
  Movimiento {
    uuid id PK
    varchar codigo UK "MOV-0001 (secuencia)"
    uuid recursoId FK
    uuid centroId FK
    uuid usuarioId FK
    TipoMovimiento tipo
    int cantidad "CHECK > 0"
    int stockAnterior "nullable"
    int stockNuevo "nullable"
    EstadoEquipo estadoEquipoAnterior "nullable"
    EstadoEquipo estadoEquipoNuevo "nullable"
    uuid loteId FK "nullable"
    uuid medicoId FK "nullable"
    uuid citaId FK "nullable"
    varchar motivo
    varchar referencia "factura o proveedor"
    decimal costoUnitario "nullable"
    datetime fechaDevolucionPrevista "nullable"
    datetime createdAt
  }
```

- **Enums:** `TipoRecurso` (INSUMO, EQUIPO), `CategoriaRecurso` (MATERIAL_MEDICO, MEDICAMENTO, REACTIVO, EQUIPO_MEDICO, OTRO), `EstadoEquipo` (DISPONIBLE, ASIGNADO, MANTENIMIENTO, BAJA) y `TipoMovimiento` (ENTRADA, SALIDA, AJUSTE, ASIGNACION, DEVOLUCION).
- **Recurso:** `@@unique([centroId, nombre])`; índices por `centroId`, `tipo` y `categoria`. En los insumos con vencimiento, `stockActual` es la suma de sus lotes (incluidos los vencidos, hasta que se ajustan).
- **Movimiento:** índices por `(centroId, createdAt)`, `(recursoId, createdAt)`, `tipo`, `medicoId` y `citaId`. Es **inmutable**: no hay rutas para editarlo ni borrarlo.
- **Restricciones `CHECK` (en la migración):** `stockActual >= 0`, `cantidadDisponible >= 0` y `cantidad > 0`. Son la última barrera de L1, L2, L7 y L9.
- **Acciones auditadas:** `RECURSO_CREADO`, `RECURSO_ACTUALIZADO`, `RECURSO_ACTIVADO`, `RECURSO_BAJA`, `MOV_ENTRADA`, `MOV_SALIDA`, `MOV_AJUSTE`, `MOV_ASIGNACION` y `MOV_DEVOLUCION`.

### Tipos de movimiento

| Tipo | Aplica a | Efecto | Reglas |
|---|---|---|---|
| ENTRADA | Insumos | Suma al stock (y al lote, si maneja vencimiento). Puede traer factura o proveedor y costo, que pasa a ser el último costo. | L1, L3, L6 |
| SALIDA | Insumos | Resta del stock. En insumos con lotes, un movimiento por lote según FEFO (sin vencidos). Puede ligarse a una cita (consumo). | L1, L2, L3, L6, L8, L9 |
| AJUSTE | Insumos y equipos | Insumo: aumenta o disminuye el stock (o un lote) con motivo. Equipo: cambia el estado (mantenimiento ↔ disponible, baja ↔ reactivación). | L6, L7 |
| ASIGNACION | Equipos | DISPONIBLE → ASIGNADO a un médico, con devolución prevista. | L4, L6 |
| DEVOLUCION | Equipos | ASIGNADO → DISPONIBLE. | L5 |

## Ciclo de estados del equipo

```mermaid
stateDiagram-v2
  [*] --> DISPONIBLE: se registra el equipo
  DISPONIBLE --> ASIGNADO: ASIGNACION (médico activo del centro, devolución futura)
  ASIGNADO --> DISPONIBLE: DEVOLUCION
  DISPONIBLE --> MANTENIMIENTO: AJUSTE con motivo
  MANTENIMIENTO --> DISPONIBLE: AJUSTE con motivo
  DISPONIBLE --> BAJA: dar de baja (AJUSTE)
  MANTENIMIENTO --> BAJA: dar de baja (AJUSTE)
  BAJA --> DISPONIBLE: reactivar (AJUSTE)
```

- Un equipo **ASIGNADO** no puede ir a mantenimiento ni darse de baja: primero se registra la devolución (409).
- **BAJA** no admite movimientos (L6) hasta reactivarlo.

### Flujo de una salida (con bloqueo de fila)

```mermaid
sequenceDiagram
  participant C as Centro médico
  participant A as API (MovimientosService)
  participant DB as PostgreSQL
  C->>A: POST /movimientos/salida {recursoId, cantidad}
  A->>DB: cargar recurso y verificar el centro (403 auditado)
  A->>DB: BEGIN
  A->>DB: SELECT … FROM "Recurso" WHERE id = $1 FOR UPDATE
  Note over A,DB: una segunda salida simultánea espera aquí
  A->>DB: leer el stock y los lotes ya actualizados
  A->>A: L1, L2, L3 (FEFO), L6 y L8 (inventario-rules.ts)
  A->>DB: UPDATE lote(s) y stock · INSERT Movimiento (stock antes → después)
  A->>DB: COMMIT (CHECK stock >= 0 como red de seguridad)
  A->>DB: AuditLog MOV_SALIDA
  A-->>C: 201 [movimientos]
```

## Decisiones técnicas

| Decisión | Motivo |
|---|---|
| JWT en una cookie `httpOnly` (no en `localStorage`) | El JavaScript de la página no puede leer el token (mitiga XSS). `sameSite=lax` mitiga CSRF y `secure` se activa en producción. |
| Proxy `/api/*` en Next | Cookie del mismo origen: el middleware puede leerla y no hacen falta cookies entre dominios. |
| Verificar el usuario en la base en cada petición | Desactivar o cambiar el rol tiene efecto inmediato, aunque el JWT siga vigente. |
| Mensaje genérico en el login y bcrypt de relleno para correos inexistentes | No revela qué correos están registrados. |
| La auditoría nunca lanza errores | Un fallo al registrar el evento se reporta en el log, pero no tumba el login ni el cambio de rol. |
| Clave interna para `/audit/access-denied` | Solo el middleware puede reportar denegaciones web; nadie puede llenar la auditoría manualmente. |
| Base `medicita_test` separada | Las e2e corren contra PostgreSQL real sin tocar los datos de desarrollo. |
| Seed idempotente desde variables de entorno | No hay contraseñas privilegiadas fijas en el código, y la demo se puede restablecer. |
| Next.js 15 con `middleware.ts` | Lo pide la especificación (en Next 16 el archivo se renombró a `proxy.ts`). |
| **Épica 2:** fechas en UTC y horarios en hora de RD (UTC−4 fijo) | RD no tiene horario de verano, así que basta un desfase fijo (`common/rd-time.ts`). Así la regla R2 no depende de la zona horaria del servidor ni del navegador; la web formatea con `America/Santo_Domingo`. |
| **Épica 2:** reglas como funciones puras (`cita-rules.ts`) | Cada regla tiene su prueba unitaria sin base de datos, y el servicio las reutiliza dentro de la transacción. |
| **Épica 2:** R10 en dos capas | Transacción `Serializable` (si dos reservas compiten, Postgres aborta una con P2034) más índices únicos parciales (P2002). Las dos se convierten en 409. En los cambios de estado, `updateMany … WHERE estado AND updatedAt` evita que dos personas pisen la misma cita. |
| **Épica 2:** historial en la misma transacción y auditoría después | Si la regla falla, no queda historial a medias. La auditoría general sigue la política de la Épica 1: nunca rompe la operación. |
| **Épica 2:** el costo se copia al crear la cita | Si el centro cambia el precio después, las citas existentes y los ingresos del reporte no cambian. |
| **Épica 2:** código `CIT-0001` generado por la base | Una secuencia de PostgreSQL no repite códigos aunque haya inserciones simultáneas. |
| **Épica 2:** gráficos con CSS, sin librería | Menos dependencias, y se imprimen bien. Los colores de estado son los pedidos (amarillo, azul, verde, gris y rojo), siempre con etiqueta y valor visibles y una tabla equivalente. |
| **Épica 3:** bloqueo de fila (`SELECT … FOR UPDATE`) en lugar de transacción serializable | Las salidas simultáneas sobre el mismo recurso se ponen en fila: la segunda espera y luego lee el stock real, así que responde un 409 claro ("Stock insuficiente (disponible: X)") en vez de un error de serialización. Con varios recursos (consumo), se bloquean en orden de id para evitar interbloqueos. |
| **Épica 3:** `CHECK` en la base para el stock | Aunque una regla fallara en el código, PostgreSQL rechaza un stock, un lote o una cantidad inválidos. |
| **Épica 3:** una SALIDA por lote | FEFO puede repartir una salida entre varios lotes; cada parte es un movimiento con su lote y su stock antes y después, así el historial es exacto. |
| **Épica 3:** cambios de estado del equipo como AJUSTE | Todo cambio de estado deja un movimiento con el estado antes y después, sin agregar tipos nuevos. |
| **Épica 3:** los vencidos siguen en el stock hasta un ajuste | El stock refleja lo que hay físicamente; el disponible (y las salidas) excluyen los vencidos, y el reporte los muestra aparte con su valor. |
| **Épica 3:** valor = stock × último costo; los equipos no mueven valor | Valoración simple y explicable. Asignar o devolver un equipo no cuenta como "valor movido" en el reporte de movimientos. |
| **Épica 2:** CSV con BOM y celdas protegidas | Abre bien en Excel con acentos, y los valores que empiezan con `=`, `+`, `-` o `@` se neutralizan (inyección de fórmulas). |

## Fuera de alcance (próximas épicas)

Pagos en línea, órdenes de compra y proveedores, traslados de inventario entre centros, notificaciones y recordatorios, feriados y excepciones de horario del médico, lista de espera, bloqueo por intentos fallidos, verificación de correo, recuperación de contraseña, MFA, revocación de tokens en el servidor y despliegue.
