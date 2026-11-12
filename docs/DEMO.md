# Guion de la demo en vivo

- [Épica 1: Gestión de usuarios y accesos](#épica-1-gestión-de-usuarios-y-accesos-8-a-10-minutos) (8 a 10 minutos)
- [Épica 2: Gestión Operativa (citas)](#épica-2-gestión-operativa-citas-10-a-12-minutos) (10 a 12 minutos)
- [Épica 3: Gestión Logística (inventario)](#épica-3-gestión-logística-inventario-10-a-12-minutos) (10 a 12 minutos)

# Épica 1: Gestión de usuarios y accesos (8 a 10 minutos)

## Antes de empezar (5 minutos antes)

1. Abrir Docker Desktop y esperar a que esté en verde.
2. En la raíz del proyecto:
   ```bash
   npm run db:up      # PostgreSQL
   npm run db:seed    # restablece las cuentas de demo (rol, estado y contraseña)
   npm run dev        # API :4000 + web :3000
   ```
3. Preparar **dos ventanas del navegador**:
   - **Ventana A (normal):** para el administrador.
   - **Ventana B (incógnito):** para paciente y centro médico. Así las sesiones no se mezclan.
4. Tener una terminal lista para `npm test` (el punto final es opcional).
5. *(Opcional, base totalmente limpia)*: `npm run db:reset` y luego `npm run db:seed`. **Borra todos los datos de desarrollo.**

### Credenciales

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@medicita.local` | `Admin1234!` |
| Paciente (demo) | `paciente@medicita.local` | `Demo12345!` |
| Centro médico (demo) | `centro@medicita.local` | `Demo12345!` |
| Nueva cuenta (se crea en vivo) | `juan.demo@correo.do` | `Juan-Demo-2026!` |

> Si `juan.demo@correo.do` ya existe de un ensayo anterior, usa otro correo (por ejemplo `juan.demo2@correo.do`).

---

## 0. Presentación (30 s)

Abrir <http://localhost:3000>. *"MediCita RD: Tu salud, nuestra prioridad. Esta épica construye la base de seguridad: quién entra, qué puede ver y quedan registradas todas las operaciones."*

## 1. Registro de usuarios (1,5 min)

1. **Ventana B** → "Crear cuenta".
2. Señalar que **solo** aparecen **Paciente** y **Centro médico**: *"Administrador no se puede elegir; la API también lo rechaza aunque alguien lo intente por fuera."*
3. Escribir una contraseña débil (`hola123`) y mostrar la lista de requisitos en vivo; luego `Juan-Demo-2026!`, para que se marquen en verde.
4. Registrar a **Juan Demo** (`juan.demo@correo.do`) como **Paciente** → entra directo a **Mis citas**.
5. *(Opcional)* Intentar registrar el mismo correo otra vez → "Ya existe una cuenta registrada con ese correo electrónico."

## 2. Inicio y cierre de sesión (1 min)

1. En la Ventana B, pulsar **Cerrar sesión** → vuelve al login con "Cerraste sesión correctamente.".
2. Intentar entrar con una contraseña incorrecta → "Correo o contraseña incorrectos." (mensaje genérico, no revela qué falló).
3. Entrar como `paciente@medicita.local` → llega a **Mis citas**.

## 3. Restricción de funcionalidades según el perfil (1 min)

1. Ventana B (paciente): el menú muestra solo **Mis citas, Buscar médico y Pagos**. Al pie de **Pagos** (módulo provisional): *"Acceso verificado por la API: módulo Paciente…"*. La API también valida el rol.
2. Cerrar sesión y entrar como `centro@medicita.local` → solo **Agenda del centro, Médicos y horarios, Inventario y Reportes**.
3. Ventana A: entrar como `admin@medicita.local` → solo **Usuarios y roles, Operaciones, Reportes, Inventario y Auditoría**.
4. *(Opcional)* Reducir la ventana o usar las herramientas de desarrollo en modo celular: el menú pasa a un botón ☰.

## 4. Acceso autorizado y no autorizado (1,5 min)

1. **Rol incorrecto (403):** en la Ventana B (centro médico), escribir en la barra `localhost:3000/admin/usuarios` → pantalla **Acceso denegado (ERROR 403)** con el perfil y la ruta.
2. **Sin sesión (401):** en la Ventana B, cerrar sesión y abrir `localhost:3000/admin/auditoria` → redirige a **Iniciar sesión** con "Inicia sesión para continuar.".
3. Comentar: *"Los dos intentos quedaron en la auditoría; lo veremos en el punto 5."*

## 5. Asignación de roles y permisos, y usuario desactivado (3 min)

En la **Ventana A** (admin) → **Usuarios y roles**:

1. Mostrar la búsqueda: escribir `juan`. Mostrar también los filtros por rol y estado, y la tarjeta **Roles y permisos**.
2. **Cambiar el rol** de Juan Demo a **Centro médico** → aparece **"¿Cambiar el rol?"** → pulsar **Cancelar** (no cambia nada) → repetir y pulsar **Sí, cambiar rol** → aviso de éxito.
3. En la **Ventana B**, entrar como Juan (`juan.demo@correo.do` / `Juan-Demo-2026!`) → ahora ve el menú de **Centro médico**.
4. Volver a la Ventana A → **Desactivar** a Juan → aparece **"¿Desactivar la cuenta?"** → **Sí, desactivar**.
5. En la Ventana B, hacer clic en cualquier opción del menú → la sesión se invalida y vuelve al login con "Tu sesión ya no es válida…".
6. Intentar entrar como Juan → **"Tu cuenta está desactivada. Contacta al administrador."**
7. Mostrar la propia fila del admin, marcada "(tú)": rol y botón deshabilitados. *"El admin no puede quitarse permisos a sí mismo, y el sistema nunca permite quedarse sin un administrador activo."*
8. *(Opcional)* **Activar** de nuevo a Juan y mostrar que puede volver a entrar.

### Auditoría

En la Ventana A → **Auditoría**:

1. Mostrar los eventos recientes: registro, inicios de sesión correctos y fallidos, cierre de sesión, cambio de rol, desactivación y accesos denegados 401 y 403, cada uno con fecha, usuario, detalle e IP.
2. Filtrar por **Acción → Cambio de rol** → aparece "admin@medicita.local cambió el rol de juan.demo@correo.do: Paciente → Centro médico".
3. Filtrar por **Usuario → `juan`** y por **fecha de hoy**. Pulsar **Limpiar**.

## 6. Pruebas automatizadas (1 min, opcional)

```bash
npm test
```

Resultado esperado: **105 unitarias + 74 e2e aprobadas** (las 80 de la Épica 1 incluidas). Mostrar [PLAN_PRUEBAS.md](PLAN_PRUEBAS.md) y [HISTORIAS_Y_CRITERIOS.md](HISTORIAS_Y_CRITERIOS.md).

---

## Plan B

| Problema | Acción |
|---|---|
| La web no carga | Revisar que `npm run dev` muestre `Ready` (web) y `Nest application successfully started` (API). |
| "No se pudo conectar con el servidor" | La API no está arriba o PostgreSQL está detenido: `npm run db:up` y reiniciar `npm run dev`. |
| Una cuenta de demo quedó con otro rol o desactivada | `npm run db:seed` la restablece. |
| No se puede mostrar en vivo | Usar las capturas reales de [evidencias/](evidencias/) en el orden 01 → 13. |

## Evidencias disponibles

| Archivo | Muestra |
|---|---|
| [01-registro-paciente.png](evidencias/01-registro-paciente.png) | Formulario de registro (solo Paciente o Centro médico). |
| [02-menu-paciente.png](evidencias/02-menu-paciente.png) | Menú restringido del paciente. |
| [03-acceso-denegado-403.png](evidencias/03-acceso-denegado-403.png) | Paciente intentando entrar a `/admin/usuarios`. |
| [04-sesion-cerrada.png](evidencias/04-sesion-cerrada.png) | Cierre de sesión. |
| [05-sin-sesion-redirige-login.png](evidencias/05-sin-sesion-redirige-login.png) | Ruta protegida sin sesión → login. |
| [06-confirmar-cambio-rol.png](evidencias/06-confirmar-cambio-rol.png) | Confirmación antes de cambiar un rol. |
| [07-rol-cambiado.png](evidencias/07-rol-cambiado.png) | Rol cambiado con aviso de éxito. |
| [08-confirmar-desactivar.png](evidencias/08-confirmar-desactivar.png) | Confirmación antes de desactivar. |
| [09-auditoria.png](evidencias/09-auditoria.png) | Tabla de auditoría. |
| [10-auditoria-filtro-cambio-rol.png](evidencias/10-auditoria-filtro-cambio-rol.png) | Auditoría filtrada por "Cambio de rol". |
| [11-usuario-desactivado.png](evidencias/11-usuario-desactivado.png) | Usuario desactivado que no puede entrar. |
| [12-movil-centro.png](evidencias/12-movil-centro.png) / [13-movil-menu-centro.png](evidencias/13-movil-menu-centro.png) | Vista de celular y menú del centro médico. |
| [npm-test.txt](evidencias/npm-test.txt) | Salida completa de `npm test`. |

> Nunca mostrar ni capturar el archivo `.env`, cookies ni tokens.

---

# Épica 2: Gestión Operativa (citas) (10 a 12 minutos)

La "operación" de MediCita RD es la **cita médica**. Esta parte demuestra los 5 puntos pedidos: (1) crear, consultar, actualizar y cerrar citas; (2) validar las reglas de negocio; (3) consultar por estado, fecha o responsable; (4) el historial de cambios y (5) el reporte básico.

## Antes de empezar (5 minutos antes)

1. Docker Desktop en verde y, en la raíz del proyecto:
   ```bash
   npm run db:up
   npm run db:migrate   # aplica la migración de la Épica 2 si aún no está
   npm run db:seed      # restablece cuentas, médicos y las 20 citas de demo (fechas relativas a hoy)
   npm run dev
   ```
   El seed **borra y vuelve a crear** las citas de los médicos de demo, así que cada ensayo empieza igual (códigos desde `CIT-0001`).
2. Preparar **tres sesiones** que no se mezclen: **A** (ventana normal, admin), **B** (incógnito, paciente) y **C** (otro navegador u otro perfil, centro médico).

### Credenciales

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@medicita.local` | `Admin1234!` |
| Paciente (María Pérez) | `paciente@medicita.local` | `Demo12345!` |
| Pacientes extra | `paciente2@medicita.local`, `paciente3@medicita.local` | `Demo12345!` |
| Centro Médico Esperanza | `centro@medicita.local` | `Demo12345!` |
| Clínica Santo Domingo (2.º centro) | `centro2@medicita.local` | `Demo12345!` |

### Datos que deja el seed

- **Centro Médico Esperanza:** Dra. Laura Fernández (Medicina General, RD$1,500), Dr. Ricardo Gómez (Cardiología, RD$2,500) y Dra. Patricia Núñez (Pediatría, RD$1,800). Todos atienden de lunes a viernes, de 8:00 a 17:00, con turnos de 30 minutos.
- **Clínica Santo Domingo:** Dr. Miguel Santana (Dermatología, RD$2,000).
- **20 citas** en las últimas 2 semanas y las próximas 2, con todos los estados e historial. Las útiles para la demo:
  - una cita **Confirmada de hace 1 o 2 días hábiles** de María con la Dra. Laura ("Revisión de resultados de laboratorio"), para **cerrarla**;
  - una cita **Confirmada** de María con el Dr. Ricardo Gómez a las **10:00** en los próximos días, para provocar el choque R4;
  - una cita **Pendiente reprogramada** de María ("Certificado médico para el trabajo"), cuyo historial ya tiene 3 entradas.

---

## 1. Crear, consultar, actualizar y cerrar una cita (4 min)

**Crear (Sesión B, paciente):**

1. **Buscar médico** → pulsar la especialidad **Medicina General** → **Ver horarios** de la Dra. Laura Fernández.
2. Elegir un día en la tira de fechas. Los turnos ocupados aparecen tachados y no se pueden elegir. Elegir un turno libre, tipo **Consulta** y escribir el motivo.
3. **Continuar** → diálogo **"Confirma tu cita"** con el médico, el centro, la fecha, la hora y el **costo RD$1,500** → **Confirmar y agendar**.
4. Pantalla **"¡Tu cita fue agendada!"** con el código (por ejemplo `CIT-0021`) y estado **Pendiente** → **Ver mi cita**.

**Consultar y actualizar:**

5. **Mis citas** → pestañas **Próximas** e **Historial**, con el estado en color (amarillo, azul, verde, gris y rojo).
6. En el detalle de la cita nueva → **Editar motivo o tipo** → cambiar el tipo a **Estudio** → **Guardar cambios**. El historial muestra "Tipo: Consulta → Estudio".

**Confirmar y cerrar (Sesión C, centro):**

7. **Agenda del centro** → filtrar **Estado: Pendiente** → abrir la cita nueva → **Confirmar cita** → **Sí, confirmar**.
8. Volver a la agenda → **Estado: Confirmada** → abrir la de **"Revisión de resultados de laboratorio"** (ya pasó su hora) → **Cerrar cita** → **Atendida** → escribir las notas → **Cerrar cita**. Queda **Atendida**, con las notas y "Esta cita está cerrada y ya no se puede modificar.".

## 2. Validar las reglas de negocio (3 min)

Mostrar los mensajes, que salen de la API y se ven en rojo dentro de la pantalla o del diálogo:

| Regla | Cómo mostrarla | Mensaje |
|---|---|---|
| R3 (médico ocupado) | En el perfil del médico, los turnos tomados aparecen tachados. | No se pueden elegir. |
| R4 (paciente ocupado) | Sesión B: agendar con la Dra. Laura el mismo día y a la misma hora que la cita de Cardiología de María (10:00). | "Ya tienes otra cita activa el … 10:00 (CIT-…)." |
| R2 (horario) | En el selector de fecha, elegir un **sábado**. | "El médico no atiende este día. Elige otra fecha." |
| R9 (cierre) | Sesión C: cerrar como **Atendida** sin notas; o cerrar la cita nueva, que todavía no ha llegado su hora. | "Para marcar la cita como atendida debes escribir las notas de cierre." / "La cita solo se puede cerrar después de su hora (…)". |
| R8 (cancelación) | Sesión B: **Cancelar cita** sin escribir motivo. | "Debes indicar el motivo de la cancelación." |
| R6 y R7 (estados) | Una cita cerrada ya no ofrece acciones. Para cerrar una cita Pendiente, la API responde 409 "…Primero hay que confirmarla." (cubierto por TC-35). | — |
| 403 (cita ajena) | Copiar la URL de la cita nueva desde la Sesión C, cerrar sesión, entrar como `centro2@medicita.local` y pegarla. | Pantalla **Acceso denegado (ERROR 403)**, y queda en la auditoría. |
| R10 (simultaneidad) | Explicar: transacción `Serializable` más índices únicos parciales. La prueba TC-38 envía 2 reservas a la vez y siempre obtiene un 201 y un 409. | — |

## 3. Consultar por estado, fecha o responsable (1,5 min)

Sesión A (admin) → **Operaciones**:

1. **Estado: Confirmada** → solo citas azules.
2. **Desde / Hasta** con la semana actual.
3. **Centro médico: Clínica Santo Domingo** → solo las del Dr. Miguel Santana. Cambiar a **Centro Médico Esperanza** y elegir **Médico: Dr. Ricardo Gómez** (el responsable).
4. Buscar por texto (`maría` o un código `CIT-…`) y cambiar el orden. **Limpiar filtros**.
5. Comentar: *"El centro ve los mismos filtros, pero solo con las citas de su centro, y el paciente solo ve las suyas."*

## 4. Historial de cambios (1,5 min)

1. Abrir la cita nueva (desde Operaciones o desde la Sesión B): la **línea de tiempo** muestra Cita creada → Datos actualizados → Cita confirmada (y la cancelación o el cierre, si se hizo), cada una con la fecha, quién la hizo, el estado anterior y el nuevo, y lo que cambió.
2. Abrir **"Certificado médico para el trabajo"** (María): Creada → Confirmada → **Reprogramada** con "Fecha y hora: antes → después" y el estado vuelve a Pendiente.
3. **Auditoría** → filtrar **Acción: Cita cerrada** o **Acceso denegado (403)**. *"Cada cambio se guarda en el historial de la cita, en la misma transacción, y también en la auditoría general."*

## 5. Reporte básico de operaciones (1,5 min)

1. Sesión A → **Reportes** (rango por defecto: últimas 2 semanas y próximas 2): tarjetas de **total**, **tasa de asistencia**, **tasa de cancelación** e **ingresos** (citas atendidas); barras **por estado**; columnas **por día** (al pasar el mouse se ve el detalle) y la tabla **por médico**.
2. Cambiar **Centro médico** o **Médico** y ver cómo cambian los números.
3. **Descargar CSV** y abrirlo en Excel: resumen, por médico, por día y el detalle de cada cita.
4. **Vista imprimible** → **Imprimir** (el menú lateral no sale en la impresión).
5. Sesión C → **Reportes**: el centro ve **solo su centro**.

## 6. Pruebas automatizadas (1 min, opcional)

```bash
npm test
```

Resultado esperado: **179 pruebas aprobadas** (105 unitarias + 74 e2e). Las 80 de la Épica 1 siguen pasando. Ver [PLAN_PRUEBAS.md](PLAN_PRUEBAS.md).

## Plan B

| Problema | Acción |
|---|---|
| Errores 500 en médicos o citas ("la tabla no existe") | Falta la migración: `npm run db:migrate` y reiniciar `npm run dev`. |
| No hay citas o los datos quedaron alterados por un ensayo | `npm run db:seed` (restablece las citas de demo con fechas relativas a hoy). |
| El turno que se quería usar ya está ocupado | Elegir otro turno; los ocupados aparecen tachados. |
| No se puede mostrar en vivo | Usar las capturas 14 → 34 de [evidencias/](evidencias/). |

## Evidencias de la Épica 2

| Archivo | Muestra |
|---|---|
| [14-buscar-medico.png](evidencias/14-buscar-medico.png) / [15-buscar-por-especialidad.png](evidencias/15-buscar-por-especialidad.png) | Búsqueda de médicos y filtro por especialidad. |
| [16-perfil-medico-horarios.png](evidencias/16-perfil-medico-horarios.png) | Perfil del médico y turnos libres. |
| [17-regla-paciente-ocupado-409.png](evidencias/17-regla-paciente-ocupado-409.png) | Regla R4: la paciente ya tiene otra cita a esa hora. |
| [18-confirmar-cita-resumen-costo.png](evidencias/18-confirmar-cita-resumen-costo.png) / [19-cita-agendada.png](evidencias/19-cita-agendada.png) | Resumen con costo y cita agendada. |
| [20-detalle-cita-paciente.png](evidencias/20-detalle-cita-paciente.png) | Detalle de la cita con acciones e historial. |
| [21-mis-citas-proximas.png](evidencias/21-mis-citas-proximas.png) / [22-mis-citas-historial.png](evidencias/22-mis-citas-historial.png) | Mis citas: Próximas e Historial. |
| [23-agenda-centro.png](evidencias/23-agenda-centro.png) | Agenda del centro con filtros. |
| [24-confirmar-cita-dialogo.png](evidencias/24-confirmar-cita-dialogo.png) | Confirmación de la cita. |
| [25-regla-notas-obligatorias.png](evidencias/25-regla-notas-obligatorias.png) / [26-cita-cerrada-historial.png](evidencias/26-cita-cerrada-historial.png) | Regla R9 y cita cerrada con su línea de tiempo. |
| [27-medicos-y-horarios.png](evidencias/27-medicos-y-horarios.png) / [28-agregar-medico.png](evidencias/28-agregar-medico.png) | Médicos y horarios del centro. |
| [29-reporte-centro.png](evidencias/29-reporte-centro.png) / [31-reportes-admin.png](evidencias/31-reportes-admin.png) / [32-reporte-imprimible.png](evidencias/32-reporte-imprimible.png) | Reportes (centro y admin) y vista imprimible. |
| [30-operaciones-admin.png](evidencias/30-operaciones-admin.png) | Operaciones: todas las citas con filtros. |
| [33-cita-ajena-403.png](evidencias/33-cita-ajena-403.png) / [34-auditoria-citas.png](evidencias/34-auditoria-citas.png) | Cita ajena (403) y auditoría de las acciones. |
| [npm-test.txt](evidencias/npm-test.txt) | Salida completa de `npm test` (179 pruebas). |

> Nunca mostrar ni capturar el archivo `.env`, cookies ni tokens.

---

# Épica 3: Gestión Logística (inventario) (10 a 12 minutos)

La logística de MediCita RD es el **inventario de cada centro médico**: insumos con stock y lotes, y equipos con estado. Esta parte demuestra los 5 puntos pedidos: (1) registrar y consultar recursos; (2) gestionar entradas, salidas y asignaciones; (3) validar disponibilidad; (4) consultar el historial de movimientos y (5) generar reportes de existencias y de movimientos.

## Antes de empezar (5 minutos antes)

1. Docker Desktop en verde y, en la raíz del proyecto:
   ```bash
   npm run db:up
   npm run db:migrate   # aplica la migración de la Épica 3 si aún no está
   npm run db:seed      # restablece cuentas, citas e inventario de demo (fechas relativas a hoy)
   npm run dev
   ```
   El seed **borra y vuelve a crear** el inventario de los centros de demo (códigos desde `REC-0001` y `MOV-0001`).
2. Sesiones: **A** (normal) con `centro@medicita.local`, **B** (incógnito) con `admin@medicita.local` y, para el 403, `centro2@medicita.local` y `paciente@medicita.local`. Contraseñas: `Demo12345!` (admin: `Admin1234!`).

### Datos que deja el seed (Centro Médico Esperanza)

- **10 insumos** (guantes, jeringas, gasas, alcohol 70 %, tiras de glucosa, paracetamol, mascarillas, solución salina, cinta y catéteres) con **41 movimientos** de las últimas 3 semanas.
  - **Bajo stock:** Mascarillas quirúrgicas (8 de mínimo 20) y Catéter 22G (35 de 50).
  - **Próximo a vencer:** Tiras reactivas de glucosa, lote TIR-2604 (vence en 18 días).
  - **Vencido:** Paracetamol 500 mg, lote PAR-2503 (2 cajas vencidas que no se pueden usar).
- **4 equipos:** Electrocardiógrafo **asignado** al Dr. Ricardo Gómez, Nebulizador y Oxímetro **disponibles**, Tensiómetro **en mantenimiento**.
- **5 citas atendidas** con insumos consumidos.
- **Clínica Santo Domingo:** 3 insumos y un dermatoscopio (para el 403 entre centros).

---

## 1. Registrar y consultar recursos (2 min)

1. Sesión A → **Inventario** → pestaña **Recursos**. Señalar las tarjetas **Bajo stock 2**, **Próximo a vencer 1** y **Con lotes vencidos 1**, y las insignias de la tabla.
2. Pulsar la tarjeta **Bajo stock** → la tabla muestra solo Mascarillas y Catéter. Probar los filtros **Tipo: Equipos** y **Buscar** (`REC-0006` o `ECG`).
3. **Nuevo recurso** → Insumo "Termómetro desechable", categoría Material médico, unidad, costo y mínimo, sin vencimiento → **Registrar recurso**. Se abre su detalle con el código `REC-0019` y stock 0. *(Opcional: repetir el nombre → "Ya existe un recurso con ese nombre en tu centro.")*

## 2. Entradas, salidas y asignaciones (4 min)

**Insumo con lotes (Paracetamol 500 mg):**

1. **Registrar entrada** con cantidad 24 **sin lote** → error dentro del diálogo: "…requiere vencimiento: indica el número de lote y la fecha de vencimiento." (L3).
2. Escribir el lote `PAR-2612`, una fecha futura, la factura y el costo → **Confirmar**. Aviso "MOV-00xx: entraron 24 caja".
3. **Registrar salida** de **500** → "Stock insuficiente (disponible: …)." (L2). Cambiar a **30**: el diálogo explica **de qué lote** se descuenta (FEFO: primero el que vence antes; el vencido nunca) → **Confirmar**.
4. *(Opcional)* **Ajustar stock** sin motivo → "El ajuste exige un motivo." (L7).

**Equipos:**

5. Abrir el **Nebulizador portátil** (disponible) → **Asignar a un médico** → elegir médico y devolución prevista → **Confirmar** (pasa a Asignado).
6. Intentar asignarlo otra vez (desde la API o con otro equipo asignado como el Electrocardiógrafo, que solo ofrece **Registrar devolución**) → la regla L4 impide asignar un equipo ya asignado (409).
7. **Registrar devolución** del nebulizador → vuelve a **Disponible**.

**Consumo en una cita:**

8. **Agenda del centro** → abrir una cita **Atendida** → **Registrar insumos usados** → elegir Guantes (1) y Gasas (2) → **Confirmar consumo**. Debajo aparece "Insumos usados" con su valor. *(Si un insumo no alcanza, no se registra ninguno.)*

## 3. Validar disponibilidad (1,5 min)

1. En el detalle del **Paracetamol**: tarjeta **Disponible** (sin vencidos) frente a **Stock total / mínimo** ("2 vencidas, no utilizables"), y la tabla de **lotes** con su vencimiento, estado (Vencido, Vigente) y la marca **SALE PRIMERO**.
2. Abrir **Tiras reactivas de glucosa** → lote **Próximo a vencer**.
3. Abrir el **Electrocardiógrafo** → **Asignado a Dr. Ricardo Gómez**, con la devolución prevista. El **Tensiómetro** aparece **En mantenimiento** (no se puede asignar).
4. **403:** entrar como `centro2@medicita.local` y pegar la URL de un recurso del Centro Médico Esperanza → **Acceso denegado (ERROR 403)**. Como paciente, `/centro/inventario` también da 403. Ambos quedan en la auditoría.

## 4. Historial de movimientos (1,5 min)

1. En el detalle de cualquier recurso, la **línea de tiempo**: cada movimiento con su código `MOV-…`, el **stock antes → después** (o el estado del equipo), el lote, el médico, la cita, la factura, el usuario y el motivo.
2. Pestaña **Movimientos**: filtrar por **Tipo: Salida**, por **fechas**, por **médico** (asignaciones) o buscar `MOV-0001`.
3. Comentar: *"Los movimientos no se editan ni se borran; un error se corrige con un ajuste. Todos quedan también en la auditoría."* (Sesión B → **Auditoría** → acciones "Entrada/Salida de inventario", "Equipo asignado").

## 5. Reportes de existencias y de movimientos (2 min)

1. Pestaña **Reportes** → **Existencias**: tarjetas con el **valor total del inventario en DOP** y los totales de **Bajo stock**, **Próximo a vencer** y **Vencido**; equipos por estado; valor por categoría; listas de alertas y la tabla de existencias por recurso.
2. **Movimientos** (últimas 3 semanas): entradas y salidas en unidades y en DOP, barras por tipo, columnas por día (al pasar el mouse se ve el detalle), tabla por recurso y **consumo por cita**.
3. **Descargar CSV** (de cada reporte) y **Vista imprimible** → **Imprimir**.
4. Sesión B (admin) → **Inventario**: recursos, movimientos y reportes de **todos los centros**, con filtro por centro y en solo lectura.

## 6. Pruebas automatizadas (1 min, opcional)

```bash
npm test
```

Resultado esperado: **230 pruebas aprobadas** (142 unitarias + 88 e2e). Las 179 de las Épicas 1 y 2 siguen pasando. Ver [PLAN_PRUEBAS.md](PLAN_PRUEBAS.md), que también incluye la sección "Errores encontrados y corregidos".

## Plan B

| Problema | Acción |
|---|---|
| Errores 500 en Inventario ("la tabla no existe") | Falta la migración: `npm run db:migrate` y reiniciar `npm run dev`. |
| Los datos quedaron alterados por un ensayo | `npm run db:seed` restablece el inventario (y las citas) de demo. |
| No se puede mostrar en vivo | Usar las capturas 35 → 54 de [evidencias/](evidencias/). |

## Evidencias de la Épica 3

| Archivo | Muestra |
|---|---|
| [35-inventario-recursos.png](evidencias/35-inventario-recursos.png) / [36-filtro-bajo-stock.png](evidencias/36-filtro-bajo-stock.png) | Recursos con alertas e insignias; filtro de bajo stock. |
| [37-nuevo-recurso.png](evidencias/37-nuevo-recurso.png) | Registro de un recurso. |
| [38-detalle-insumo-lotes.png](evidencias/38-detalle-insumo-lotes.png) | Disponibilidad por lote (vencido, vigente, sale primero). |
| [39-regla-entrada-sin-lote.png](evidencias/39-regla-entrada-sin-lote.png) / [40-regla-stock-insuficiente.png](evidencias/40-regla-stock-insuficiente.png) | Reglas L3 y L2 dentro del diálogo. |
| [41-salida-fefo-vista-previa.png](evidencias/41-salida-fefo-vista-previa.png) / [42-historial-stock-antes-despues.png](evidencias/42-historial-stock-antes-despues.png) | Salida FEFO y línea de tiempo con stock antes y después. |
| [43-equipo-asignado.png](evidencias/43-equipo-asignado.png) / [44-asignar-equipo.png](evidencias/44-asignar-equipo.png) / [45-equipo-mantenimiento.png](evidencias/45-equipo-mantenimiento.png) | Equipos: asignado, asignar y en mantenimiento. |
| [46-registrar-insumos-cita.png](evidencias/46-registrar-insumos-cita.png) / [47-insumos-usados-en-cita.png](evidencias/47-insumos-usados-en-cita.png) | Consumo de insumos en una cita atendida. |
| [48-movimientos.png](evidencias/48-movimientos.png) | Tabla global de movimientos. |
| [49-reporte-existencias.png](evidencias/49-reporte-existencias.png) / [50-reporte-movimientos.png](evidencias/50-reporte-movimientos.png) / [51-reporte-imprimible.png](evidencias/51-reporte-imprimible.png) | Reportes de existencias y de movimientos, y vista imprimible. |
| [52-admin-inventario.png](evidencias/52-admin-inventario.png) | Inventario global del administrador. |
| [53-recurso-ajeno-403.png](evidencias/53-recurso-ajeno-403.png) / [54-auditoria-inventario.png](evidencias/54-auditoria-inventario.png) | 403 entre centros y auditoría del inventario. |
| [npm-test.txt](evidencias/npm-test.txt) | Salida completa de `npm test` (230 pruebas). |

> Nunca mostrar ni capturar el archivo `.env`, cookies ni tokens.
