# Plan de pruebas y resultados: Épicas 1, 2 y 3

## Alcance

- **Épica 1:** autenticación (registro, login y logout), autorización por rol (API y web), gestión de usuarios (cambio de rol, activación y desactivación) y auditoría.
- **Épica 2:** médicos y horarios; el ciclo de vida de la cita (crear, consultar, actualizar, reprogramar, confirmar, cerrar y cancelar); las reglas de negocio R1 a R10; los filtros por estado, fecha y responsable; el historial de cambios y el reporte de operaciones (JSON y CSV).
- **Épica 3:** recursos del inventario (insumos con lotes y equipos); entradas, salidas, ajustes, asignaciones, devoluciones y consumo en citas; las reglas L1 a L10 (FEFO, alertas y concurrencia); la disponibilidad, el historial de movimientos y los reportes de existencias y movimientos (JSON y CSV).

Las historias, los criterios y las reglas están en [HISTORIAS_Y_CRITERIOS.md](HISTORIAS_Y_CRITERIOS.md).

## Entorno de ejecución

| Elemento | Valor |
|---|---|
| Fecha de ejecución | Épica 1: 2026-11-03 · Épica 2: 2026-11-04 y 2026-11-05 · Épica 3: 2026-11-11 |
| Sistema operativo | Windows 11 Pro |
| Node.js / npm | 22.16.0 / 10.9.2 |
| Base de datos | PostgreSQL 16.15 (Docker 29.9.2); las pruebas e2e usan la base aislada `medicita_test` |
| Herramientas | Jest 30.5, supertest 7.3, ts-jest. Pruebas web: Microsoft Edge (headless, automatizado con puppeteer-core) y curl |
| Código probado | Épica 1: rama `main`, bloque de pruebas `467dff7` y siguientes · Épica 2: rama `Jael`, sobre `38aac74` · Épica 3: rama `Jael`, sobre `02322bc` |

## Cómo ejecutar

```bash
npm run db:up     # PostgreSQL debe estar arriba
npm test          # unitarias + e2e
```

Las e2e aplican las migraciones a `medicita_test` antes de empezar, vacían las tablas antes de cada caso y **se niegan a correr** si `DATABASE_URL_TEST` no apunta a una base de pruebas, para proteger los datos de desarrollo.

## Resumen de resultados

| Tipo | Épica | Casos (ID) | Pruebas ejecutadas | Aprobadas | Falladas |
|---|---|---|---:|---:|---:|
| Unitarias (`TU-`) | 1 | TU-01 a TU-09 | 36 | 36 | 0 |
| Unitarias (`TU-`) | 2 | TU-10 a TU-33 (+ variantes) | 69 | 69 | 0 |
| E2E API (`TC-`) | 1 | TC-01 a TC-21 (+ variantes) | 44 | 44 | 0 |
| E2E API (`TC-`) | 2 | TC-23 a TC-42 (+ variantes) | 30 | 30 | 0 |
| Web (`TW-`) | 1 | TW-01 a TW-13 | 13 | 13 | 0 |
| Web (`TW-`) | 2 | TW-14 a TW-24 | 11 | 11 | 0 |
| Unitarias (`TU-`) | 3 | TU-34 a TU-50 (+ variantes) | 37 | 37 | 0 |
| E2E API (`TC-`) | 3 | TC-43 a TC-56 | 14 | 14 | 0 |
| Web (`TW-`) | 3 | TW-25 a TW-34 | 10 | 10 | 0 |
| Unitarias (`TU-`) | Despliegue | TU-51 a TU-53 | 3 | 3 | 0 |
| **Total** | | | **267** | **267** | **0** |

`npm test` ejecuta **233 pruebas automatizadas** (145 unitarias + 88 e2e), todas aprobadas. Las 179 de las Épicas 1 y 2 siguen pasando.

Salida completa de `npm test`, con el detalle de cada caso: [evidencias/npm-test.txt](evidencias/npm-test.txt).

---

## 1. Pruebas e2e de la API (automatizadas, `npm test`)

### Épica 1

Archivos: [apps/api/test/auth.e2e-spec.ts](../apps/api/test/auth.e2e-spec.ts) y [apps/api/test/access.e2e-spec.ts](../apps/api/test/access.e2e-spec.ts).

| ID | HU | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|
| TC-01 | HU-01 | `POST /api/auth/register` con nombre, correo `Ana@Correo.do`, contraseña fuerte y `role: PACIENTE`. | 201; usuario `PACIENTE` activo, correo en minúsculas, sin `passwordHash` en la respuesta; cookie de sesión; hash bcrypt de costo 12 en la base; evento `REGISTER`. | ✅ Aprobado: 201, cookie emitida, hash `$2b$12$…`, auditoría `[REGISTER]`. |
| TC-02 | HU-01 | Registro con `role: CENTRO_MEDICO`. | 201 y rol `CENTRO_MEDICO`. | ✅ Aprobado |
| TC-03 | HU-01 | Registro con `role: ADMIN`. | 400 "Solo puedes registrarte como Paciente o Centro médico."; 0 usuarios en la base. | ✅ Aprobado: 400 y ningún usuario creado. |
| TC-04 | HU-01 | Registro con 5 contraseñas débiles: corta, sin mayúscula, sin minúscula, sin número y sin símbolo. | 400 con el mensaje de la política en los 5 casos; no se crea el usuario. | ✅ Aprobado (5/5 variantes). |
| TC-05 | HU-01 | Crear `repetido@correo.do` y registrar `REPETIDO@correo.do`. | 409 "Ya existe una cuenta registrada con ese correo electrónico.". | ✅ Aprobado |
| TC-06 | HU-01 | Registro con nombre vacío, correo inválido y el campo extra `isActive`. | 400 con los mensajes de nombre, correo y "isActive should not exist". | ✅ Aprobado |
| TC-07 | HU-02 | `POST /api/auth/login` con credenciales válidas. | 200; cookie `HttpOnly`, `SameSite=Lax`, sin `Secure` fuera de producción, `Max-Age` ≈ 28 800 s (8 h); permisos del rol; evento `LOGIN_SUCCESS`. | ✅ Aprobado: `Max-Age=28799`, auditoría `[LOGIN_SUCCESS]`. |
| TC-07b | HU-02 | Con la sesión del paso anterior, `GET /api/auth/me`. | 200 con correo, rol y etiqueta "Paciente". | ✅ Aprobado |
| TC-08 | HU-02 | Login con contraseña incorrecta y login con correo inexistente. | 401 en ambos casos con el mismo mensaje genérico "Correo o contraseña incorrectos."; sin cookie; 2 eventos `LOGIN_FAILED`. | ✅ Aprobado |
| TC-09 | HU-03 | Login, `GET /auth/me` (200), `POST /auth/logout` y otra vez `GET /auth/me`. | Logout 200 con la cookie vaciada; después, 401; eventos `LOGIN_SUCCESS`, `LOGOUT` y `ACCESS_DENIED_401`. | ✅ Aprobado |
| TC-10 | HU-02, HU-07 | Login de un usuario con `isActive=false` y contraseña correcta. | 403 "Tu cuenta está desactivada. Contacta al administrador."; sin cookie; `LOGIN_FAILED`. | ✅ Aprobado |
| TC-11 | HU-02, HU-06 | Alterar el payload del JWT (rol → `ADMIN`) conservando la firma y llamar `GET /api/users`. | 401 (firma inválida). | ✅ Aprobado |
| TC-12 | HU-06, HU-08 | Sin cookie: `GET /users`, `/audit`, `/modules/paciente`, `/modules/centro`, `/auth/me` y `PATCH /users/:id/role`. | 401 "Debes iniciar sesión para continuar." y un evento `ACCESS_DENIED_401` con la ruta. | ✅ Aprobado (6/6 rutas). |
| TC-13 | HU-05, HU-06, HU-08 | Paciente → `/users`, `/audit`, `/modules/centro`; Centro → `/users`, `/audit`, `/modules/paciente`; Admin → `/modules/paciente`, `/modules/centro`. | 403 "Acceso denegado: tu perfil no tiene permiso para este recurso." y `ACCESS_DENIED_403` con el `userId` correcto. | ✅ Aprobado (8/8 combinaciones). |
| TC-14 | HU-05, HU-06 | Admin → `/users`, `/audit`, `/users/roles`; Paciente → `/modules/paciente`; Centro → `/modules/centro`. | 200. | ✅ Aprobado (5/5). |
| TC-14b | HU-06 | Sin cookie, `GET /api/health`. | 200 `{status: "ok"}` y ningún evento de auditoría (las rutas `@Public()` no exigen sesión). | ✅ Aprobado. Se agregó tras detectar que el health respondía 401 (ver "Defectos"). |
| TC-15 | HU-04, HU-08 | El admin hace `PATCH /users/:id/role` (Paciente → Centro médico). Después el paciente usa su sesión vieja y luego vuelve a entrar. | 200 sin `passwordHash`; `ROLE_CHANGED` con actor, IP y detalle "admin@… cambió el rol de paciente@…: Paciente → Centro médico"; sesión vieja → 401; con el nuevo login, `/modules/centro` 200 y `/modules/paciente` 403. | ✅ Aprobado |
| TC-15b | HU-04 | El admin promueve al centro médico a `ADMIN` y este entra. | 200; el nuevo admin accede a `/users`. | ✅ Aprobado |
| TC-16 | HU-07, HU-08 | El admin desactiva al paciente; el paciente usa su sesión y luego intenta login; el admin lo reactiva y el paciente vuelve a entrar. | Sesión → 401; login → 403; tras reactivar, login 200; un evento `USER_DEACTIVATED` (con detalle) y uno `USER_ACTIVATED`. | ✅ Aprobado |
| TC-17 | HU-04, HU-07 | El admin intenta cambiar su propio rol y desactivarse. | 400 "No puedes cambiar tu propio rol." y 400 "No puedes activar ni desactivar tu propia cuenta."; sigue siendo ADMIN activo. | ✅ Aprobado |
| TC-18 | HU-04 | Rol `SUPERADMIN`, id `no-es-uuid`, UUID inexistente e `isActive: "no"`. | 400, 400, 404 y 400; ningún `ROLE_CHANGED` auditado. | ✅ Aprobado |
| TC-19 | HU-04 | `GET /users`; `?search=PACIENTE@`; `?role=CENTRO_MEDICO`; `?status=inactive`; `?role=OTRO`. | Total 3 y sin `passwordHash`; búsqueda sin distinguir mayúsculas; filtros correctos; rol inválido → 400. | ✅ Aprobado |
| TC-20 | HU-08 | Generar eventos y consultar `GET /audit` con `action`, `user` (actor y afectado), `from` futuro, rango con `pageSize=2`, acción inválida y fecha inválida. | Cada filtro devuelve solo lo que coincide; la paginación respeta `page` y `pageSize`; inválidos → 400. | ✅ Aprobado |
| TC-21 | HU-06, HU-08 | `POST /audit/access-denied` sin clave, con clave falsa, como admin autenticado sin clave y con la clave correcta. | 401, 401, 401 sin registrar nada; con la clave, 204 y un evento `ACCESS_DENIED_403` "Web: /admin/usuarios — rol Paciente sin permiso". | ✅ Aprobado |

### Épica 2

Archivos: [apps/api/test/medicos.e2e-spec.ts](../apps/api/test/medicos.e2e-spec.ts), [apps/api/test/citas.e2e-spec.ts](../apps/api/test/citas.e2e-spec.ts) y [apps/api/test/reportes.e2e-spec.ts](../apps/api/test/reportes.e2e-spec.ts). Las fechas se calculan respecto a hoy (días hábiles a 3 y 5 días) para que las pruebas no caduquen; las citas en el pasado se insertan directamente en la base.

| ID | HU / Regla | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|
| TC-23 | HU-09 | El centro hace `POST /api/medicos` (Cardiología, RD$2,500, L-V 08:00 a 17:00). | 201; médico activo, asociado al centro, `horarioTexto` "lunes a viernes, 08:00 a 17:00"; evento `MEDICO_CREADO`. | ✅ Aprobado |
| TC-23b | HU-09 | El paciente intenta crear un médico. | 403. | ✅ Aprobado |
| TC-24 | HU-09 | Crear con fin antes del inicio; luego con días vacíos, precio negativo y hora "8am". | 400 "La hora de fin debe ser posterior…"; 400 con los tres mensajes. | ✅ Aprobado |
| TC-25 | HU-09 | El centro edita precio y hora de fin de su médico; el centro 2 intenta editarlo. | 200 con los cambios; 403 y `ACCESS_DENIED_403` con el `userId` del centro 2. | ✅ Aprobado |
| TC-26 | HU-09, R5 | Desactivar el médico; listar como paciente y como centro; repetir el estado; reactivar. | El paciente ve 0 y luego 1; el centro lo ve inactivo; repetir → 400 "El médico ya está inactivo."; eventos `MEDICO_DESACTIVADO` y `MEDICO_ACTIVADO`. | ✅ Aprobado |
| TC-26b | HU-09 | Médicos de dos centros; buscar `?especialidad=cardiología`; `GET /medicos/especialidades`; listar como centro 2. | Dos cardiólogos (sin distinguir mayúsculas); `["Cardiología", "Medicina General"]`; el centro 2 ve solo el suyo. | ✅ Aprobado |
| TC-27 | HU-09, HU-10 | Con una cita a las 09:00, `GET /medicos/:id/disponibilidad` para ese día, para un sábado y para `2026-02-31`. | 18 turnos (08:00 a 16:30), 09:00 `ocupado` y 17 libres; sábado `atiende: false` sin turnos; fecha inválida → 400. | ✅ Aprobado |
| TC-28 | HU-10 | El paciente agenda; se sube el precio del médico y agenda otra cita. | 201, `CIT-0001`, Pendiente, costo 1500; la segunda es `CIT-0002`; la primera conserva su costo; historial `[CREADA]`; `CITA_CREADA` con el código. | ✅ Aprobado |
| TC-28b | HU-10 | El admin y el centro intentan agendar. | 403 en ambos casos. | ✅ Aprobado |
| TC-37 | R1, R2, R5 | Agendar: en el pasado, a 95 días, un sábado, a las 09:10, a las 18:00 y con el médico inactivo. | 400 en los seis casos, con "ya pasó", "90 días", "no atiende ese día", "turno de 30 minutos", "fuera del horario" y "no está disponible para nuevas citas"; ninguna cita creada. | ✅ Aprobado (6/6 variantes) |
| TC-36 | R3, R4 | Paciente 1 agenda a las 09:00; el paciente 2 intenta el mismo turno; el paciente 1 intenta otro médico a la misma hora. | 409 "Dra. Laura Fernández ya tiene una cita…"; 409 "Ya tienes otra cita activa … (CIT-0001)". | ✅ Aprobado |
| TC-36b | R3 | Cancelar la cita y que otro paciente tome ese turno. | 201: una cita cancelada libera el horario. | ✅ Aprobado |
| TC-38 | R10 | Dos pacientes envían a la vez (`Promise.all`) la reserva del mismo turno. | Un 201 y un 409; una sola cita en la base. | ✅ Aprobado (repetido 5 veces seguidas sin fallos) |
| TC-29 | HU-11 | La cita la consultan el paciente, el centro y el admin; luego el paciente 2 (detalle), el centro 2 (historial) y el centro 2 (confirmar). | 200, 200 y 200; después 403 "Acceso denegado: esta cita no te pertenece." en los tres casos, 3 eventos `ACCESS_DENIED_403` con el código, y el historial sin cambios. | ✅ Aprobado |
| TC-29b | HU-11 | UUID inexistente; `GET /citas` sin sesión. | 404; 401. | ✅ Aprobado |
| TC-39 | HU-11 | 4 citas (una atendida ayer, dos en un día y otra de otro centro). Probar el alcance por rol y los filtros `estado`, `desde`/`hasta`, `medicoId`, `centroId`, `texto`, `orden` y paginación. | Paciente 2, centro 3, centro 2 1, admin 4; el paciente no amplía su alcance con `pacienteId`; estado → 1 y 3; estado inválido → 400; un día → 2; por médico → Dr. Ricardo; por centro → 1; "juan" → 2; orden descendente; página 2 de 3 → 1 elemento. | ✅ Aprobado |
| TC-30 | HU-12 | `PATCH` con motivo y tipo; luego con `estado`. | 200 y el historial `ACTUALIZADA` con `{motivo: {antes, despues}, tipo: {…}}`; `estado` → 400 (campo no permitido). | ✅ Aprobado |
| TC-31 | HU-12, R3, R6 | Confirmar; reprogramar a un turno ocupado; reprogramar a otro día; reprogramar desde el centro. | 409; 200 con estado Pendiente y la nueva fecha; 200; 2 eventos `CITA_REPROGRAMADA`. | ✅ Aprobado |
| TC-32 | HU-13 | El paciente intenta confirmar; el centro confirma con comentario. | 403; 200 Confirmada. | ✅ Aprobado |
| TC-33 | HU-13, R9 | Cerrar una cita futura; cerrar una cita pasada sin notas y con notas; cerrar otra como No asistió; el paciente intenta cerrar. | 400 "después de su hora"; 400 "…debes escribir las notas de cierre."; 200 Atendida con notas; 200 No asistió; 403. | ✅ Aprobado |
| TC-34 | HU-13, R8 | Cancelar sin motivo; el paciente cancela una cita que es en 1 hora; el centro cancela esa misma; el paciente cancela otra con tiempo. | 400 "Debes indicar el motivo de la cancelación."; 400 "hasta 2 horas antes"; 200 con el motivo; 200. | ✅ Aprobado |
| TC-35 | R6, R7 | Cerrar una cita Pendiente; cancelar una cita y luego confirmarla, editarla, reprogramarla y cancelarla otra vez. | 409 "…de Pendiente a No asistió. Primero hay que confirmarla."; 409 "ya está cerrada (Cancelada)" y 409 en el resto. | ✅ Aprobado |
| TC-40 | HU-14 | Crear → confirmar → editar → reprogramar → confirmar → cancelar, y `GET /citas/:id/historial`. | 6 entradas en orden, con acción, estado anterior y nuevo, y rol del actor; fecha anterior y nueva en `cambios`; comentario de la cancelación; la auditoría registra las 6 acciones `CITA_*` en el mismo orden. | ✅ Aprobado |
| TC-40b | HU-14, R2 | Reprogramar a un sábado. | 400 y el historial sigue siendo `[CREADA]` (misma transacción). | ✅ Aprobado |
| TC-41 | HU-15 | Con 10 citas fijas (9 en el rango del 2 al 6 de noviembre), `GET /reportes/citas` como admin. | Total 9; por estado 1/1/4/1/2; asistencia 0.8; cancelación 0.2222; ingresos 7500; sin detalle de citas en el JSON. | ✅ Aprobado |
| TC-41b | HU-15 | Revisar `porMedico` y `porDia`. | Laura 4 / RD$3,000, Ricardo 3 / RD$2,500, Miguel 2 / RD$2,000; 5 días con 3, 2, 1, 2 y 1 citas. | ✅ Aprobado |
| TC-41c | HU-15 | Filtrar por `centroId` del centro 2 y por `medicoId` de Cardiología. | Centro 2: total 2, ingresos 2000, cancelación 0.5. Cardiología: total 3, ingresos 2500, asistencia 1. | ✅ Aprobado |
| TC-41d | HU-15 | El centro pide el reporte con el `centroId` del centro 2; el centro 2 pide el suyo; el paciente pide JSON y CSV. | Total 7 y `filtros.centroId` = su centro; total 2; 403 y 403. | ✅ Aprobado |
| TC-41e | HU-15 | Rango invertido y fecha `02-11-2026`. | 400 y 400. | ✅ Aprobado |
| TC-42 | HU-15 | `GET /reportes/citas.csv` con el rango. | `text/csv`, `Content-Disposition` con el nombre `reporte-citas_2026-11-02_2026-11-06.csv`; líneas de resumen (total 9, asistencia 80.0 %, cancelación 22.2 %, ingresos 7500.00) y 9 filas de detalle. | ✅ Aprobado |

### Épica 3

Archivo: [apps/api/test/inventario.e2e-spec.ts](../apps/api/test/inventario.e2e-spec.ts). Las fechas de vencimiento se calculan respecto a hoy; los lotes vencidos se insertan directamente en la base, porque la API no los acepta (L3).

| ID | HU / Regla | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|
| TC-43 | HU-16 | El centro registra un insumo y un equipo; repite el nombre; el centro 2 usa el mismo nombre; el paciente lista; el admin intenta crear. | 201 `REC-0001` (stock 0) y `REC-0002` (DISPONIBLE); 409 "Ya existe un recurso con ese nombre en tu centro."; 201 en el otro centro; 403 y 403; 3 `RECURSO_CREADO` y `ACCESS_DENIED_403` auditados. | ✅ Aprobado |
| TC-44 | HU-16, HU-19 | Filtros por tipo, categoría, texto, `estado=bajo_stock`, `estado=disponible`, `centroId` (admin) y estado inválido; editar; dar de baja y reactivar. | Centro 3, equipos 1, medicamentos 1, texto `REC-0001` → Gasas; bajo stock 2 con `resumen.bajoStock=2`; admin 4 (centro 2: 1); estado inválido 400; PATCH 200; inactivo 1. | ✅ Aprobado |
| TC-45 | HU-16 | El centro 2 lee, consulta el historial, registra una entrada y edita un recurso del centro 1. | 403 "Acceso denegado: este recurso pertenece a otro centro." en los 4 casos, 4 eventos `ACCESS_DENIED_403` con el código y el stock sin cambios. | ✅ Aprobado |
| TC-46 | HU-17, L1, L3 | Entrada sin lote, con vencimiento pasado, con cantidad 0, válida (con factura y costo), al mismo lote y al mismo lote con otra fecha. | 400, 400, 400; 201 `MOV-0001` 0→10 con referencia y costo; 201 (suma al lote); 400 "ya existe con vencimiento"; stock 15; el costo de la entrada pasa a ser el último costo. | ✅ Aprobado |
| TC-47 | HU-17, L2, L3 | Salida mayor al stock y con cantidad negativa; salida FEFO de 6 con lotes PRONTO (4), TARDE (10) y un VENCIDO (50). | 409 "Stock insuficiente (disponible: 8)."; 400; FEFO: 4 de PRONTO (64→60) y 2 de TARDE (60→58); pedir 9 → 409 "(disponible: 8)"; el lote vencido sigue con 50. | ✅ Aprobado |
| TC-48 | HU-17, L7 | Ajuste sin motivo, disminución mayor al stock, aumento; ajuste de un insumo con lotes sin lote y con lote. | 400 "El ajuste exige un motivo."; 409 "…(disponible: 5)."; 201 5→7; 400 "Indica el lote…"; 201 y el lote baja a 2. | ✅ Aprobado |
| TC-49 | HU-17, L6 | Desactivar un insumo con stock 5 e intentar una entrada y una salida. | 409 "…está inactivo y no admite movimientos." en ambos; el stock sigue en 5. | ✅ Aprobado |
| TC-50 | HU-18, L4, L5, L6 | Asignar a un médico inactivo, de otro centro, con fecha pasada, un insumo; asignar bien; reasignar; mantenimiento y baja estando asignado; devolver dos veces; mantenimiento; asignar en mantenimiento; volver a disponible; dar de baja; asignar dado de baja. | 400 ×4; 201 DISPONIBLE→ASIGNADO con el médico; 409 "ya está asignado a Dra. Laura Fernández"; 409 y 409; 201 y 409 "(estado actual: Disponible)"; 201; 409 "en mantenimiento"; 201; 200 BAJA; 409 "dado de baja". Movimientos: ASIGNACION, DEVOLUCION, AJUSTE ×3. | ✅ Aprobado |
| TC-51 | HU-19, L10 | Insumo con lotes PROX (+10 días), LEJOS (+100) y VIEJO (vencido); equipo asignado consultado por el admin. | Disponible 9 de 13, alertas bajo stock + próximo a vencer + vencido; lotes en orden VIEJO (no utilizable), PROX, LEJOS; equipo ASIGNADO a la Dra. Laura, no disponible, sin atraso. | ✅ Aprobado |
| TC-52 | HU-20 | Entrada, salida, ajuste y salida; historial del recurso; filtros de `/movimientos`; alcance por rol; `PATCH`/`DELETE` de un movimiento. | Historial `MOV-0001…0004` en orden con 0→10, 10→7, 7→5, 5→4 y el usuario; filtros: salidas 2, médico 1, recurso 4, hoy 5, ayer 0, usuario 5; centro 2 ve 0, admin 5, paciente 403; PATCH y DELETE 404; 5 movimientos y 5 eventos `MOV_*`. | ✅ Aprobado |
| TC-53 | HU-17, L8 | Consumo de 2 insumos en una cita ATENDIDA donde el segundo no alcanza; consumo válido; salida ligada a una cita PENDIENTE; consumo en una cita de otro centro. | 409 y **ningún** movimiento (todo o nada); 201 con 2 SALIDAS ligadas a la cita; 409 "…está Pendiente"; 403 "la cita pertenece a otro centro"; stock final correcto. | ✅ Aprobado |
| TC-54 | L9 | 5 salidas simultáneas (`Promise.all`) de 3 unidades con stock 7. | Exactamente 2×201 y 3×409; stock final 1; las salidas registran 7→4 y 4→1. | ✅ Aprobado (repetido 4 veces seguidas sin fallos) |
| TC-55 | HU-21 | Reporte de existencias con datos fijos (bajo stock, lote próximo, lote vencido, equipos asignado y disponible); admin global; el centro 2 pide otro centro; paciente. | Valor insumos 1,100, equipos 13,000, **total 14,100**; bajo stock 1; próximo 1 (8 u.); vencido 1 (6 u., RD$300); equipos 1 disponible y 1 asignado; admin 5 recursos; centro 2 solo lo suyo; 403. | ✅ Aprobado |
| TC-56 | HU-21 | Reporte de movimientos de 3 días con un consumo en cita; rango invertido; CSV de movimientos y de existencias. | 5 movimientos, 14 u. entraron (RD$900), 3 salieron (RD$200), 1 cita con consumo (RD$100); la asignación vale 0; 3 días; 400; CSV con `Content-Disposition` y líneas de resumen; existencias con "Valor total del inventario (DOP),14000.00". | ✅ Aprobado |

## 2. Pruebas unitarias (automatizadas, `npm test`)

### Épica 1

Archivos `*.spec.ts` en [apps/api/src](../apps/api/src). Usan dependencias simuladas (Prisma y auditoría).

| ID | HU | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|
| TU-01 | HU-01 | `AuthService.register`: registro válido, registro como ADMIN saltándose el DTO y correo duplicado. | Hash bcrypt verificable y `REGISTER` auditado; ADMIN → `BadRequestException` sin crear el usuario; duplicado → `ConflictException`. | ✅ Aprobado (3/3) |
| TU-02 | HU-02, HU-07 | `AuthService.login`: credenciales válidas, contraseña errónea, correo inexistente y usuario desactivado. | `LOGIN_SUCCESS`; 401 genérico + `LOGIN_FAILED`; mismo 401 para el correo inexistente; 403 "cuenta desactivada". | ✅ Aprobado (4/4) |
| TU-03 | HU-02, HU-03 | Sesión: emitir y verificar un JWT, token manipulado, opciones de la cookie en test y en producción, logout. | Expira en 8 h; manipulado → `null`; `httpOnly`, `lax` y `secure` solo en producción; `LOGOUT` solo con un token válido. | ✅ Aprobado (4/4) |
| TU-04 | HU-04 | `UsersService.changeRole`: cambio válido, sobre sí mismo, usuario inexistente, mismo rol, último admin activo, admin con otro admin activo. | Auditado con actor y detalle; 400; 404; 400; **409 sin actualizar ni auditar**; permitido. | ✅ Aprobado (6/6) |
| TU-05 | HU-07 | `UsersService.setActive`: desactivar, activar, sobre sí mismo, último admin activo, cambio sin efecto. | `USER_DEACTIVATED` / `USER_ACTIVATED`; 400; **409 (último admin)**; 400. | ✅ Aprobado (5/5) |
| TU-06 | HU-08 | `AuditService.record`: evento completo, evento anónimo con un detalle de 800 caracteres, fallo de la base. | Guarda los campos; `userId` e `ip` nulos y detalle recortado a 500; no lanza error. | ✅ Aprobado (3/3) |
| TU-07 | HU-08 | `AuditService.find`: con todos los filtros y paginación, y sin filtros. | `where` con acción, OR de usuario o detalle, rango `gte`/`lte`; `skip=20`, `take=10`, orden descendente; sin filtros `where={}`. | ✅ Aprobado (2/2) |
| TU-08 | HU-04 | `UsersService.rolesCatalog`. | Devuelve los 3 roles con sus permisos. | ✅ Aprobado (1/1) |
| TU-09 | HU-01 | Política de contraseñas: 3 contraseñas fuertes y 5 débiles. | Acepta las fuertes y rechaza las débiles. | ✅ Aprobado (8/8) |

### Épica 2

Archivos: [cita-rules.spec.ts](../apps/api/src/citas/cita-rules.spec.ts) (reglas como funciones puras), [citas.service.spec.ts](../apps/api/src/citas/citas.service.spec.ts) (servicio con Prisma simulado) y [reportes.service.spec.ts](../apps/api/src/reportes/reportes.service.spec.ts). El reloj es fijo: miércoles 4 de noviembre de 2026, 10:00 en RD.

| ID | Regla / HU | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|
| TU-10 | R1 | Fechas a +1 día y +90 días; ahora y 1 minuto antes; 90 días + 1 minuto. | Aceptadas; 400 "ya pasó"; 400 "90 días". | ✅ Aprobado (3/3) |
| TU-11 | R2 | 08:00, 08:30, 12:00 y 16:30 de un lunes; un sábado; 07:30 y 17:00; 08:15 y una hora con segundos; 08:00 UTC frente a 08:00 RD. | Aceptadas; "no atiende ese día… lunes a viernes"; "fuera del horario"; "turno de 30 minutos (por ejemplo 08:00 o 08:30)"; el horario se interpreta en hora de RD. | ✅ Aprobado (5/5) |
| TU-12 | R5 | Médico inactivo y médico activo. | 400 "no está disponible"; aceptado. | ✅ Aprobado (1/1) |
| TU-13 | R6 | Las 25 combinaciones de estado → estado, la matriz declarada, el mensaje de Pendiente → Atendida y reprogramar por estado. | 5 transiciones permitidas y 20 con 409; matriz idéntica; mensaje "…Primero hay que confirmarla."; reprogramar solo en Pendiente o Confirmada. | ✅ Aprobado (28/28) |
| TU-14 | R7 | Modificar una cita Atendida, No asistió y Cancelada; y una activa. | 409 "ya está cerrada … no se puede modificar"; activa permitida. | ✅ Aprobado (4/4) |
| TU-15 | R8 | Cancelar sin motivo o con espacios; el paciente a 3 h y a 2 h; el paciente a 1 h; el centro a 1 h. | 400 "Debes indicar el motivo…"; permitido (motivo recortado); 400 "hasta 2 horas antes"; permitido. | ✅ Aprobado (4/4) |
| TU-16 | R9 | Cerrar Atendida sin notas y con notas; No asistió sin notas; cerrar antes de la hora. | 400 "…notas de cierre"; notas recortadas; permitido; 400 "después de su hora". | ✅ Aprobado (3/3) |
| TU-17 | HU-10, HU-14 | `create` válido. | Transacción `Serializable`; costo copiado del precio; orden `tx → cita.create → historial.create`; historial `CREADA`; `CITA_CREADA`. | ✅ Aprobado (1/1) |
| TU-18 | R3 | `findFirst` del médico devuelve una cita. | 409 con el nombre del médico y la hora en RD; filtro por estados activos; no crea. | ✅ Aprobado (1/1) |
| TU-19 | R4 | `findFirst` del paciente devuelve `CIT-0009`. | 409 "Ya tienes otra cita activa el lun 09/11/2026 09:00 (CIT-0009)." | ✅ Aprobado (1/1) |
| TU-20 / TU-20b | R5, R1 | Médico inactivo; fecha pasada. | 400 sin crear; 400 sin abrir la transacción. | ✅ Aprobado (2/2) |
| TU-21 | R10 | La transacción falla con `P2002` (índice único) y con `P2034` (conflicto de serialización). | 409 "Ese horario acaba de ser reservado…" en ambos casos y sin auditar. | ✅ Aprobado (2/2) |
| TU-22 / TU-22b | HU-11 | Otro paciente consulta; otro centro confirma. | 403 y `audit.forbidden` con el actor, "la cita CIT-0001" e IP; sin abrir la transacción. | ✅ Aprobado (2/2) |
| TU-23 | HU-13, HU-14 | `confirmar`. | `updateMany` con `estado` y `updatedAt` (bloqueo optimista), y luego el historial en la misma transacción; `CITA_CONFIRMADA`. | ✅ Aprobado (1/1) |
| TU-24 | R10 | `updateMany` devuelve `count: 0`. | 409 "La cita fue modificada por otra persona al mismo tiempo…" sin historial. | ✅ Aprobado (1/1) |
| TU-25 | R6, HU-12 | Reprogramar una cita Confirmada. | Estado Pendiente; historial con `cambios.fechaHora {antes, despues}`; los choques excluyen la propia cita. | ✅ Aprobado (1/1) |
| TU-26 | R7 | Editar una cita Atendida. | 409 sin actualizar. | ✅ Aprobado (1/1) |
| TU-27 / TU-27b | HU-12 | PATCH de motivo y tipo; PATCH sin cambios reales. | `cambios` con los dos campos; 400 "No hay cambios para guardar." | ✅ Aprobado (2/2) |
| TU-28 | HU-15 | Reporte de 5 citas. | Conteo por estado; asistencia 0.6667; cancelación 0.2; ingresos 4000. | ✅ Aprobado (1/1) |
| TU-29 | HU-15 | Agrupar con rango del 2 al 5 de noviembre (una cita a las 23:30 RD). | Por médico ordenado por total; por día en hora de RD, incluido el día sin citas. | ✅ Aprobado (1/1) |
| TU-30 / TU-31 / TU-32 | HU-15 | El centro pide otro centro; sin citas; rango invertido. | Forzado a su centro; tasas `null` e ingresos 0; 400. | ✅ Aprobado (3/3) |
| TU-33 | HU-15 | `toCsv`. | BOM UTF-8, secciones, totales y una celda con coma y comillas escapada correctamente. | ✅ Aprobado (1/1) |

> **Nota sobre "último administrador activo":** como el admin tampoco puede modificarse a sí mismo y quien actúa siempre es un admin activo, desde la API este caso solo podría ocurrir con operaciones concurrentes. Por eso la regla se prueba de forma unitaria (TU-04 y TU-05) y en la API se aplica dentro de una transacción `Serializable`.

### Épica 3

Archivos: [inventario-rules.spec.ts](../apps/api/src/inventario/inventario-rules.spec.ts) (reglas L1–L10 como funciones puras), [movimientos.service.spec.ts](../apps/api/src/inventario/movimientos.service.spec.ts) (servicio con Prisma simulado) y [inventario-reportes.service.spec.ts](../apps/api/src/inventario/inventario-reportes.service.spec.ts). Fecha fija: 11 de noviembre de 2026.

| ID | Regla / HU | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|
| TU-34 | L1 | Cantidades 1, 5 y 1000; 0, −3, 1.5 y NaN. | Aceptadas; 400 "La cantidad debe ser un número entero mayor que 0." | ✅ Aprobado (7/7) |
| TU-35 | L2 | Sacar 8 de 8 y 9 de 8. | Permitido; 409 "Stock insuficiente (disponible: 8)." | ✅ Aprobado (2/2) |
| TU-36 | L3, L10 | Estado del lote en los límites (ayer, hoy, +30 y +31 días); FEFO de 12 con 5 lotes (uno vencido y uno vacío); disponible sin vencidos; pedir más de lo utilizable; lote obligatorio y fecha futura en la entrada. | Vencido, próximo, próximo, vigente; reparto A 4, B 6, C 2; disponible 20; 409 "(disponible: 20)"; mensajes de L3. | ✅ Aprobado (5/5) |
| TU-37 | L4 | Asignación válida; insumo; equipo asignado o en mantenimiento; médico de otro centro, inactivo o devolución en el pasado. | Permitida; 400; 409 "…ya está asignado a Dra. Laura…" y 409; 400 en los tres. | ✅ Aprobado (4/4) |
| TU-38 | L5 | Devolver un equipo asignado y uno disponible; mantenimiento ↔ disponible; mantenimiento estando asignado. | Permitido y 409 "(estado actual: Disponible)"; permitido; 409 "Primero registra la devolución". | ✅ Aprobado (2/2) |
| TU-39 | L6 | Insumo inactivo, equipo de baja y activo; entrada a un equipo. | 409 "…está inactivo…" y "dado de baja"; permitido; 400. | ✅ Aprobado (2/2) |
| TU-40 | L7 | Ajuste sin motivo; disminución de 6 con 5; disminución de 5 con 5; aumento desde 0. | 400; 409 "(disponible: 5)"; permitido; permitido. | ✅ Aprobado (2/2) |
| TU-41 | L8 | Cita Atendida, Pendiente y No asistió. | Permitido; 409 "…(CIT-2 está Pendiente)."; 409. | ✅ Aprobado (1/1) |
| TU-42 | L10 | Disponible = mínimo y mínimo + 1; lote vencido que deja el disponible bajo el mínimo; lote a 20 días; lotes vacíos y equipos. | Bajo stock sí/no; bajo stock + vencido; próximo a vencer; sin alertas. | ✅ Aprobado (4/4) |
| TU-43 | L9 | Salida de 4 con stock 10. | Orden: `tx → lock (FOR UPDATE) → movimiento → stock 6`, y `MOV_SALIDA` auditado. | ✅ Aprobado (1/1) |
| TU-44 | L9, L8 | Consumo de dos recursos (b, a) donde el segundo no alcanza. | Bloquea en orden de id (a, b) para evitar interbloqueos; 409 y nada auditado. | ✅ Aprobado (1/1) |
| TU-45 | L8 | Salida ligada a una cita de otro centro y a una cita pendiente. | 403 con `audit.forbidden` (actor, cita e IP); 409 sin abrir la transacción. | ✅ Aprobado (1/1) |
| TU-46 | L8 | Salida ligada a una cita atendida. | El movimiento guarda `citaId` y "Consumo en la cita CIT-0001". | ✅ Aprobado (1/1) |
| TU-47 | HU-16 | Entrada a un recurso ajeno. | 403 antes de abrir la transacción. | ✅ Aprobado (1/1) |
| TU-48 | HU-21 | Existencias con un insumo en bajo stock, uno con lotes vencido/próximo/vigente y un equipo asignado. | Valor total 153,500; bajo stock 1; próximo 1 (8 u.); vencido 1 (10 u., RD$1,000); equipos por estado. | ✅ Aprobado (1/1) |
| TU-49 / TU-50 | HU-21 | El centro pide otro centro; CSV de existencias. | Forzado a su centro; BOM, valor total y las tres alertas en el resumen. | ✅ Aprobado (2/2) |

### Configuración de producción (despliegue)

Archivo: [despliegue.spec.ts](../apps/api/src/config/despliegue.spec.ts). Además se simuló el despliegue en local con `NODE_ENV=production` y solo variables de entorno (sin `.env`): la API arrancó con `npm run start:deploy` ("No pending migrations to apply") en `PORT=4100` y la web compilada con `API_INTERNAL_URL` apuntando a ella. Resultados: el proxy `/api` responde; el login devuelve la cookie `HttpOnly; Secure; SameSite=Lax`; el CORS solo acepta `WEB_URL`; las páginas protegidas responden 200 con sesión, 307 a "Acceso denegado" con otro rol y 307 al login sin sesión. Un build de la web "como en Vercel" sin `API_INTERNAL_URL` falla con un mensaje claro.

| ID | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| TU-51 | `validateEnv` en producción con el `JWT_SECRET` de ejemplo, sin `WEB_URL` y con todo correcto; en desarrollo con el valor de ejemplo. | Error "no puede usar el valor de ejemplo"; error "falta WEB_URL"; acepta; acepta. | ✅ Aprobado (1/1) |
| TU-52 | `origenesCors` sin valor y con dos URLs (espacios y `/` final). | `http://localhost:3000`; las dos URLs limpias. | ✅ Aprobado (1/1) |
| TU-53 | `trustProxy` sin valor, `true`, `false` y `2`. | `loopback`, `true`, `false` y `2`. | ✅ Aprobado (1/1) |

## 3. Pruebas de la interfaz web

### Épica 1

Se ejecutaron el 2026-11-03 contra `npm run dev` (web `:3000`, API `:4000`) con Microsoft Edge en modo headless, automatizado con puppeteer-core, y con curl para las redirecciones. Las capturas son de la aplicación real y están en [evidencias/](evidencias/).

| ID | HU | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|
| TW-01 | HU-01 | Abrir `/registro`, revisar las opciones de tipo de cuenta y registrar a "Laura Evidencia" como Paciente. | Solo aparecen Paciente y Centro médico; tras registrarse llega a `/paciente/citas`. | ✅ Aprobado: opciones `[PACIENTE, CENTRO_MEDICO]` y redirección a `/paciente/citas` ([01](evidencias/01-registro-paciente.png), [02](evidencias/02-menu-paciente.png)). |
| TW-02 | HU-02 | Con sesión de paciente, abrir `/login` y `/panel`. | Redirige (307) a `/paciente/citas`. | ✅ Aprobado (curl: 307 → `/paciente/citas`). |
| TW-03 | HU-05 | Revisar el menú lateral de paciente y de administrador. | Paciente: Mis citas, Buscar médico, Pagos. Admin: Usuarios y roles, Auditoría. | ✅ Aprobado: menús exactamente como se esperaba ([02](evidencias/02-menu-paciente.png)). |
| TW-04 | HU-06, HU-08 | Con sesión de paciente, abrir `/admin/usuarios`. | Redirige a "Acceso denegado" (ERROR 403) con el perfil y la ruta; se audita `ACCESS_DENIED_403` con "Web: /admin/usuarios". | ✅ Aprobado ([03](evidencias/03-acceso-denegado-403.png)); evento visible en la auditoría. |
| TW-05 | HU-03 | Pulsar "Cerrar sesión" y luego abrir `/paciente/citas`. | Llega a `/login?motivo=logout` con el aviso "Cerraste sesión correctamente."; la página protegida redirige al login. | ✅ Aprobado ([04](evidencias/04-sesion-cerrada.png)). |
| TW-06 | HU-06, HU-08 | Sin sesión, abrir `/admin/auditoria`. | Redirige a `/login?next=%2Fadmin%2Fauditoria` con "Inicia sesión para continuar."; se audita `ACCESS_DENIED_401` (Anónimo). | ✅ Aprobado ([05](evidencias/05-sin-sesion-redirige-login.png)). |
| TW-07 | HU-05 | Con sesión de admin, abrir `/paciente/citas`. | Redirige a "Acceso denegado". | ✅ Aprobado (curl: 307 → `/acceso-denegado?ruta=%2Fpaciente%2Fcitas`). |
| TW-08 | HU-04 | En "Usuarios y roles", buscar "laura", cambiar su rol a Centro médico, pulsar **Cancelar**, repetir y pulsar **Sí, cambiar rol**. | Aparece el diálogo "¿Cambiar el rol?"; al cancelar sigue siendo Paciente; al confirmar pasa a Centro médico con un aviso de éxito. | ✅ Aprobado: tras cancelar "Paciente", tras confirmar "Centro médico" ([06](evidencias/06-confirmar-cambio-rol.png), [07](evidencias/07-rol-cambiado.png)). |
| TW-09 | HU-04, HU-07 | Buscar la propia cuenta del admin. | El selector de rol y el botón Desactivar están deshabilitados y la fila dice "(tú)". | ✅ Aprobado: controles `disabled = [true, true]`. |
| TW-10 | HU-07 | Pulsar "Desactivar" en Laura y confirmar. | Aparece el diálogo "¿Desactivar la cuenta?"; al confirmar, la fila muestra "Desactivado" y el botón "Activar". | ✅ Aprobado ([08](evidencias/08-confirmar-desactivar.png)). |
| TW-11 | HU-07 | (a) Laura intenta iniciar sesión. (b) Un paciente con sesión abierta navega después de que el admin le cambia el rol o lo desactiva. | (a) "Tu cuenta está desactivada. Contacta al administrador." (b) Pasa por `/sesion/expirada`, se borra la cookie y aterriza en `/login?motivo=sesion`. | ✅ Aprobado ([11](evidencias/11-usuario-desactivado.png)). (b) Verificado en el navegador: tras el cambio de rol y tras la desactivación, un clic en el menú lleva a `/login?motivo=sesion` con el aviso "Tu sesión ya no es válida…" y sin cookie. |
| TW-12 | HU-05 | Viewport de 390×844 (celular): iniciar sesión como centro médico y abrir el menú. Medir el desbordamiento horizontal en Inicio, Login, Registro, Paciente y Usuarios. | Menú lateral desplegable solo con "Agenda del centro" y "Médicos y horarios"; `overflowX = 0` en todas. | ✅ Aprobado ([12](evidencias/12-movil-centro.png), [13](evidencias/13-movil-menu-centro.png)); overflowX = 0 en las 5 pantallas. |
| TW-13 | HU-08 | Abrir "Auditoría" y filtrar por la acción "Cambio de rol". | La tabla muestra fecha, acción, usuario, detalle e IP; con el filtro, solo filas "Cambio de rol". | ✅ Aprobado ([09](evidencias/09-auditoria.png), [10](evidencias/10-auditoria-filtro-cambio-rol.png)). |

### Épica 2

Se ejecutaron el 2026-11-05 con el mismo método: un recorrido automatizado de punta a punta (paciente → centro → admin → centro 2) sobre los datos del seed. Capturas de la 14 a la 34 en [evidencias/](evidencias/).

| ID | HU / Regla | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|
| TW-14 | HU-09 | Centro → "Médicos y horarios"; pulsar "Agregar médico". | Tabla con los 3 médicos (días, horario, turno, precio y estado) y acciones Editar y Desactivar; formulario con días seleccionables y horas. | ✅ Aprobado ([27](evidencias/27-medicos-y-horarios.png), [28](evidencias/28-agregar-medico.png)) |
| TW-15 | HU-09, HU-10 | Paciente → "Buscar médico"; elegir "Cardiología". | Tarjetas con el centro, el horario y el precio; el filtro deja solo Cardiología. | ✅ Aprobado ([14](evidencias/14-buscar-medico.png), [15](evidencias/15-buscar-por-especialidad.png)) |
| TW-16 | HU-10 | Abrir el perfil de la Dra. Laura, elegir un día y un turno, escribir el motivo, "Continuar" y "Confirmar y agendar". | Solo los turnos libres se pueden elegir; resumen con el costo RD$1,500; pantalla "¡Tu cita fue agendada!" con el código y estado Pendiente. | ✅ Aprobado ([16](evidencias/16-perfil-medico-horarios.png), [18](evidencias/18-confirmar-cita-resumen-costo.png), [19](evidencias/19-cita-agendada.png)) |
| TW-17 | R4 | Agendar el lunes a las 10:00, cuando la paciente ya tiene Cardiología a esa hora. | El diálogo se cierra y aparece en rojo "Ya tienes otra cita activa el lun … 10:00 (CIT-…)."; la disponibilidad se recarga. | ✅ Aprobado ([17](evidencias/17-regla-paciente-ocupado-409.png)) |
| TW-18 | HU-11, HU-14 | "Mis citas": pestañas Próximas e Historial; abrir el detalle de la cita nueva. | Solo las citas de la paciente, con el estado en color; el detalle muestra datos, acciones (Reprogramar, Editar y Cancelar) y el historial. | ✅ Aprobado ([20](evidencias/20-detalle-cita-paciente.png), [21](evidencias/21-mis-citas-proximas.png), [22](evidencias/22-mis-citas-historial.png)) |
| TW-19 | HU-11 | Centro → "Agenda del centro". | Tabla con código, fecha, paciente, médico, estado y costo, y filtros por estado, médico, texto y rango de fechas. Solo citas de su centro (18 de 21). | ✅ Aprobado ([23](evidencias/23-agenda-centro.png)) |
| TW-20 | HU-13, HU-14 | Abrir la cita nueva y "Confirmar cita" → "Sí, confirmar". | Diálogo de confirmación; la cita pasa a Confirmada y la línea de tiempo suma la entrada. | ✅ Aprobado ([24](evidencias/24-confirmar-cita-dialogo.png)) |
| TW-21 | R9, HU-13 | En una cita confirmada de ayer, "Cerrar cita" como Atendida sin notas; luego escribir las notas. | Error en el diálogo "Para marcar la cita como atendida debes escribir las notas de cierre."; con notas → Atendida, notas visibles y "Cita cerrada" en la línea de tiempo. | ✅ Aprobado ([25](evidencias/25-regla-notas-obligatorias.png), [26](evidencias/26-cita-cerrada-historial.png)) |
| TW-22 | HU-11 | `centro2@medicita.local` abre la URL de una cita del Centro Médico Esperanza. | Pantalla "Acceso denegado (ERROR 403)"; la auditoría muestra "intentó acceder sin permiso a la cita CIT-…". | ✅ Aprobado ([33](evidencias/33-cita-ajena-403.png), [34](evidencias/34-auditoria-citas.png)) |
| TW-23 | HU-11, HU-15 | Admin → "Operaciones" y "Reportes"; centro → "Reportes". | Operaciones con el filtro de centro; reporte con tarjetas (total, asistencia, cancelación e ingresos), barras por estado, columnas por día con leyenda, tabla por médico y "Descargar CSV". El centro ve solo su centro. | ✅ Aprobado ([29](evidencias/29-reporte-centro.png), [30](evidencias/30-operaciones-admin.png), [31](evidencias/31-reportes-admin.png)) |
| TW-24 | HU-15 | "Vista imprimible". | Página con el logo, el rango y la fecha de generación, el botón "Imprimir", y al imprimir sin el menú lateral. | ✅ Aprobado ([32](evidencias/32-reporte-imprimible.png)) |

### Épica 3

Se ejecutaron el 2026-11-11 con un recorrido automatizado (centro → admin → centro 2) sobre los datos del seed. Capturas de la 35 a la 54 en [evidencias/](evidencias/). El recorrido no registró errores de consola ni de hidratación.

| ID | HU / Regla | Pasos | Resultado esperado | Resultado obtenido |
|---|---|---|---|---|
| TW-25 | HU-16, HU-19 | Centro → Inventario → Recursos; pulsar la tarjeta "Bajo stock". | Tarjetas con 2 bajo stock, 1 próximo a vencer y 1 con lotes vencidos; tabla con insignias y estado de los equipos; al pulsar, solo los 2 insumos en bajo stock. | ✅ Aprobado ([35](evidencias/35-inventario-recursos.png), [36](evidencias/36-filtro-bajo-stock.png)) |
| TW-26 | HU-16 | "Nuevo recurso". | Diálogo con Insumo o Equipo, categoría, unidad, costo, mínimo y "Maneja lotes y vencimiento". | ✅ Aprobado ([37](evidencias/37-nuevo-recurso.png)) |
| TW-27 | HU-17, HU-19, L3 | Detalle de Paracetamol (lotes); "Registrar entrada" sin lote; luego con lote y fecha. | Lotes con estado (vencido, vigente) y "SALE PRIMERO"; error en el diálogo "…requiere vencimiento: indica el número de lote…"; con lote, entrada registrada. | ✅ Aprobado ([38](evidencias/38-detalle-insumo-lotes.png), [39](evidencias/39-regla-entrada-sin-lote.png)) |
| TW-28 | HU-17, HU-20, L2 | "Registrar salida" de 500; luego de 30 con motivo. | Error "Stock insuficiente (disponible: 64)."; vista previa "Se descontará 30 del lote PAR-2611 (primero el que vence antes)"; la línea de tiempo muestra el stock antes y después. | ✅ Aprobado ([40](evidencias/40-regla-stock-insuficiente.png), [41](evidencias/41-salida-fefo-vista-previa.png), [42](evidencias/42-historial-stock-antes-despues.png)) |
| TW-29 | HU-18 | Electrocardiógrafo asignado; asignar el nebulizador; tensiómetro en mantenimiento. | Disponibilidad con médico y devolución prevista; diálogo de asignación con médico y fecha; equipo en mantenimiento con su ajuste en el historial. | ✅ Aprobado ([43](evidencias/43-equipo-asignado.png), [44](evidencias/44-asignar-equipo.png), [45](evidencias/45-equipo-mantenimiento.png)) |
| TW-30 | HU-17, L8 | Detalle de una cita Atendida → "Registrar insumos usados" → Guantes. | Diálogo con insumos y cantidades; al confirmar, "Insumos usados" lista lo consumido con su valor. | ✅ Aprobado ([46](evidencias/46-registrar-insumos-cita.png), [47](evidencias/47-insumos-usados-en-cita.png)) |
| TW-31 | HU-20 | Inventario → Movimientos. | Tabla con tipo, código, fecha, recurso, cantidad, stock o estado, detalle (lote, médico, cita) y usuario, con filtros. | ✅ Aprobado ([48](evidencias/48-movimientos.png)) |
| TW-32 | HU-21 | Reportes → Existencias y Movimientos; vista imprimible. | Existencias: **valor total del inventario**, **Bajo stock**, **Próximo a vencer** y **Vencido** en tarjetas, equipos por estado, valor por categoría, listas y tabla. Movimientos: tarjetas, barras por tipo, columnas por día, tabla por recurso y consumo por cita. | ✅ Aprobado ([49](evidencias/49-reporte-existencias.png), [50](evidencias/50-reporte-movimientos.png), [51](evidencias/51-reporte-imprimible.png)) |
| TW-33 | HU-16 | Admin → Inventario. | Recursos de los dos centros con columna y filtro por centro, sin botón "Nuevo recurso". | ✅ Aprobado ([52](evidencias/52-admin-inventario.png)) |
| TW-34 | HU-16 | `centro2@` abre la URL de un recurso del Centro Médico Esperanza; Auditoría. | "Acceso denegado (ERROR 403)"; la auditoría muestra los movimientos (`Entrada/Salida de inventario`, `Equipo asignado`) y el 403. | ✅ Aprobado ([53](evidencias/53-recurso-ajeno-403.png), [54](evidencias/54-auditoria-inventario.png)) |

## Errores encontrados y corregidos

Errores reales que aparecieron durante el desarrollo y las pruebas de las tres épicas, cómo se detectaron y cómo se corrigieron. Se reconstruyeron con el historial de git (`git log`) y con las notas de cada ejecución.

### Épica 1: Gestión de usuarios y accesos

| # | Qué fallaba | Cómo se detectó | Cómo se corrigió |
|---|---|---|---|
| E1-1 | `GET /api/health` respondía 401: el guard global de autenticación también se aplicaba a la ruta de salud. | Al comprobar la API sin sesión antes de la demo. | Se marcó la ruta con `@Public()` y se agregó la prueba TC-14b (commit `3bf860a`). |
| E1-2 | Jest avisaba "worker failed to exit gracefully" al correr las unitarias en paralelo en Windows (módulos nativos de bcrypt y Prisma). | Salida de `npm test`. | `test:unit` usa `--runInBand`: el aviso desaparece y la ejecución es más rápida. |
| E1-3 | Al cambiar rápido un filtro de una tabla, podía mostrarse una respuesta vieja que llegaba después de la nueva. | Prueba manual de los filtros de Usuarios y Auditoría. | La página se reinicia en el manejador del filtro y se descartan las respuestas que no son de la última petición. |
| E1-4 | ESLint no encontraba `next` porque quedó instalado sin elevar al workspace. | `npm run lint` fallaba en la web. | Reinstalación limpia de dependencias (`npm install`) para que npm lo eleve. |
| E1-5 | El indicador de desarrollo de Next.js tapaba "Cerrar sesión" en las capturas. | Al revisar las capturas de evidencia. | `devIndicators: false` en `next.config.ts` (commit `19d51a3`). |

### Épica 2: Gestión Operativa (citas)

| # | Qué fallaba | Cómo se detectó | Cómo se corrigió |
|---|---|---|---|
| E2-1 | Error de hidratación de React en el detalle de la cita: Node escribe "10:30 a.&nbsp;m." con un espacio especial (U+00A0) y Edge con un espacio normal. | Recorrido automatizado con puppeteer (error en la consola del navegador). | Los formateadores de fecha, hora y moneda (`lib/citas.ts`) normalizan esos espacios. |
| E2-2 | En pantallas angostas, el perfil del médico se desbordaba a lo ancho por la tira de días. | Revisión de las capturas. | Columnas con `minmax(0, 1fr)` en el perfil, el detalle y el reporte. |
| E2-3 | Con un 409 (horario tomado), el diálogo de confirmación quedaba abierto sin turno elegido. | Recorrido automatizado al provocar la regla R4. | El diálogo se cierra, el error se muestra bajo el selector y la disponibilidad se recarga. |
| E2-4 | El eje del gráfico por día mostraba "3, 2, 0", con la marca del medio en 1,5. | Revisión de la captura del reporte. | El máximo se redondea a un número par, así que las marcas son enteras. |
| E2-5 | Al repetir el seed, los códigos de cita seguían subiendo (CIT-0044…). | Al ejecutar el seed dos veces seguidas. | Si no quedan otras citas, el seed reinicia la secuencia y vuelve a empezar en CIT-0001. |
| E2-6 | El detalle de auditoría decía "intentó acceder a la cita … ajeno" (concordancia). | Revisión de la captura de la auditoría. | Texto neutro: "intentó acceder sin permiso a la cita CIT-…". |
| E2-7 | `npm run lint` fallaba con `no-irregular-whitespace`: el BOM del CSV quedó escrito como carácter literal en un regex. | `npm run lint`. | Se reemplazó por la secuencia de escape `﻿`. |
| E2-8 | **Prueba frágil:** TC-39 esperaba 2 citas en un día y encontraba 3. Las fechas `diaHabil(3)` y `diaHabil(5)` caían el mismo lunes cuando la suite corría un miércoles (el fin de semana se corre al lunes). | Al correr `npm test` un miércoles, durante la Épica 3 (falló 1 de 179). | Nueva función `habilesDespues(fecha, 2)`, que garantiza un día hábil distinto. |

### Épica 3: Gestión Logística (inventario)

| # | Qué fallaba | Cómo se detectó | Cómo se corrigió |
|---|---|---|---|
| E3-1 | El reporte de movimientos sumaba el costo del equipo como valor de una asignación (RD$10,000 por asignar un electrocardiógrafo), lo que inflaba el "valor movido". | Prueba e2e TC-56 (esperaba valor 0 en la asignación). | Los movimientos de equipos (asignar, devolver o cambiar estado) valen 0 en el reporte; el valor del equipo solo cuenta en las existencias. |
| E3-2 | El historial de demo no cuadraba: un consumo del 29/10 mostraba stock 46→44 antes de la entrada del 30/10 (20→60). El seed procesaba los consumos de las citas después del resto de eventos. | Revisión de la captura del historial del Paracetamol. | El seed encola todos los eventos y los ejecuta en orden de fecha; ahora el stock y los códigos MOV siguen la línea de tiempo. |
| E3-3 | El mensaje de L8 mostraba el estado de la cita en minúsculas y sin tilde ("está no asistio"). | Prueba de humo contra la API. | Usa las etiquetas de estado de la Épica 2: "(CIT-0021 está Pendiente)". |
| E3-4 | En el diálogo de movimiento, el error de un intento anterior seguía visible al cambiar la cantidad. | Revisión de la captura de la salida FEFO. | El error se limpia al editar la cantidad. |
| E3-5 | El aviso del consumo decía "Se registraron 1 salidas". | Revisión de la captura del consumo en la cita. | Mensaje en singular o plural según la cantidad. |
| E3-6 | La prueba del CSV esperaba la etiqueta "Próximo a vencer (lotes, 30 días)" sin comillas; el CSV la escribe entre comillas porque contiene una coma (comportamiento correcto). | Prueba unitaria TU-50. | Se corrigió la expectativa de la prueba. |
| E3-7 | Al terminar una herramienta de escritura, `﻿` quedaba como carácter literal (invisible) en el código del CSV. | Revisión del archivo antes de correr el lint. | Se reemplazó por la secuencia de escape, igual que en E2-7. |

> **Observación y verificación de estabilidad:** en una corrida completa de `npm test` durante la Épica 3 fallaron 2 pruebas e2e y no se guardó el detalle. Para buscar la causa se ejecutó, el 2026-11-11:
>
> - `npm test` completo **5 veces seguidas**: 230/230 en las 5. La corrida 3 cruzó la medianoche en hora de RD (el caso de riesgo de las pruebas con fechas relativas) y la 4 y la 5 corrieron ya en el día siguiente.
> - Las unitarias y las e2e en **orden aleatorio** (`jest --randomize`, semillas 101, 202 y 303): 142/142 y 88/88 en las tres, así que no hay dependencia del orden ni datos compartidos entre pruebas (cada e2e vacía la base antes de empezar).
> - Las dos pruebas de **concurrencia** (TC-38 reservas simultáneas y TC-54 salidas simultáneas) **10 veces seguidas**: 10/10.
>
> La falla no se reprodujo. La única causa confirmada de inestabilidad fue la de las fechas de TC-39 (E2-8), ya corregida.
