# Historias de usuario y criterios de aceptación: Épicas 1, 2 y 3

- [Épica 1: Configuración, gestión de usuarios y accesos](#épica-1-configuración-gestión-de-usuarios-y-accesos) (HU-01 a HU-08)
- [Épica 2: Gestión Operativa (citas médicas)](#épica-2-gestión-operativa-citas-médicas) (HU-09 a HU-15)
- [Épica 3: Gestión Logística (inventario)](#épica-3-gestión-logística-inventario) (HU-16 a HU-21)

## Épica 1: Configuración, gestión de usuarios y accesos

> Como **administrador de la plataforma**, necesito gestionar los usuarios, roles y permisos del sistema para garantizar que cada persona tenga acceso únicamente a las funcionalidades correspondientes a su perfil.

**Objetivo de negocio:** contar con un mecanismo seguro de autenticación, autorización y administración de usuarios que controle el acceso a los módulos y asegure la trazabilidad de las operaciones.

| ID | Historia | Prioridad | Estado | Pruebas |
|---|---|---|---|---|
| HU-01 | Registro de usuarios | Alta | ✅ Terminada | TC-01 a TC-06, TU-01, TU-09, TW-01 |
| HU-02 | Inicio de sesión | Alta | ✅ Terminada | TC-07, TC-07b, TC-08, TC-10, TC-11, TU-02, TU-03, TW-02 |
| HU-03 | Cierre de sesión | Alta | ✅ Terminada | TC-09, TU-03, TW-05 |
| HU-04 | Asignación de roles | Alta | ✅ Terminada | TC-15, TC-15b, TC-17 a TC-19, TU-04, TU-08, TW-08, TW-09 |
| HU-05 | Restricción de funcionalidades según el perfil | Alta | ✅ Terminada | TC-13, TC-14, TW-03, TW-07, TW-12 |
| HU-06 | Acceso autorizado y no autorizado | Alta | ✅ Terminada | TC-11 a TC-14b, TC-21, TW-04, TW-06 |
| HU-07 | Activación y desactivación de usuarios | Alta | ✅ Terminada | TC-10, TC-16, TC-17, TU-05, TW-09 a TW-11 |
| HU-08 | Auditoría de operaciones | Media | ✅ Terminada | TC-12, TC-13, TC-15, TC-16, TC-20, TC-21, TU-06, TU-07, TW-13 |

Los ID `TC-` son pruebas e2e automatizadas, los `TU-` son pruebas unitarias y los `TW-` son pruebas de la interfaz web. Ver [PLAN_PRUEBAS.md](PLAN_PRUEBAS.md).

---

### HU-01: Registro de usuarios

**Como** visitante de MediCita RD, **quiero** crear una cuenta como Paciente o como Centro médico **para** usar los servicios de la plataforma según mi perfil.

| ID | Criterio de aceptación |
|---|---|
| CA-01.1 | **Dado** que estoy en "Crear cuenta", **cuando** elijo el tipo de cuenta, **entonces** solo veo las opciones *Paciente* y *Centro médico* (Administrador no aparece). |
| CA-01.2 | **Dado** que completo nombre, correo y una contraseña válida, **cuando** envío el formulario, **entonces** se crea la cuenta con el rol elegido, activa, inicio sesión automáticamente y llego al panel de mi rol. |
| CA-01.3 | **Dado** que alguien envía `role: "ADMIN"` directamente a la API, **cuando** intenta registrarse, **entonces** recibe 400 ("Solo puedes registrarte como Paciente o Centro médico.") y no se crea ninguna cuenta. |
| CA-01.4 | **Dado** que la contraseña no tiene al menos 10 caracteres con mayúscula, minúscula, número y símbolo, **cuando** envío el formulario, **entonces** se rechaza con un mensaje que explica la política. El formulario muestra en vivo qué requisitos se cumplen. |
| CA-01.5 | **Dado** que ya existe una cuenta con ese correo (sin importar mayúsculas), **cuando** intento registrarme, **entonces** recibo "Ya existe una cuenta registrada con ese correo electrónico." (409). |
| CA-01.6 | **Dado** que el correo es inválido, el nombre está vacío o se envían campos no permitidos (por ejemplo `isActive`), **cuando** envío, **entonces** se rechaza con 400 y no se crea la cuenta. |
| CA-01.7 | **Dado** un registro exitoso, **entonces** la contraseña se guarda con hash bcrypt (nunca en texto plano) y se audita el evento `REGISTER`. |

### HU-02: Inicio de sesión

**Como** usuario registrado, **quiero** iniciar sesión con mi correo y contraseña **para** acceder a las funciones de mi perfil.

| ID | Criterio de aceptación |
|---|---|
| CA-02.1 | **Dado** que mis credenciales son correctas y mi cuenta está activa, **cuando** inicio sesión, **entonces** recibo una cookie `httpOnly`, `sameSite=lax` (`secure` en producción) con un JWT que expira en 8 horas, y llego al panel de mi rol. |
| CA-02.2 | **Dado** que el correo no existe o la contraseña es incorrecta, **cuando** intento entrar, **entonces** veo el mismo mensaje genérico "Correo o contraseña incorrectos." (401), sin revelar cuál dato falló. |
| CA-02.3 | **Dado** que mi cuenta fue desactivada, **cuando** intento entrar con la contraseña correcta, **entonces** veo "Tu cuenta está desactivada. Contacta al administrador." (403) y no se crea sesión. |
| CA-02.4 | **Dado** cualquier intento, **entonces** se audita `LOGIN_SUCCESS` o `LOGIN_FAILED`, con IP y sin guardar la contraseña. |
| CA-02.5 | **Dado** que un token fue alterado (por ejemplo, para cambiar el rol), **cuando** se usa, **entonces** la API lo rechaza con 401. |
| CA-02.6 | **Dado** que ya tengo sesión, **cuando** abro "Iniciar sesión" o "Crear cuenta", **entonces** me lleva directo a mi panel. |

### HU-03: Cierre de sesión

**Como** usuario autenticado, **quiero** cerrar mi sesión **para** que nadie más use mi cuenta en este dispositivo.

| ID | Criterio de aceptación |
|---|---|
| CA-03.1 | **Dado** que tengo sesión, **cuando** pulso "Cerrar sesión", **entonces** se borra la cookie, vuelvo al login con el aviso "Cerraste sesión correctamente." y se audita `LOGOUT`. |
| CA-03.2 | **Dado** que cerré sesión, **cuando** intento abrir una página o un endpoint protegido, **entonces** se me pide iniciar sesión (redirección al login, o 401 en la API). |

### HU-04: Asignación de roles y permisos

**Como** administrador, **quiero** cambiar el rol de los usuarios **para** que cada persona tenga solo los permisos que corresponden a su responsabilidad.

| ID | Criterio de aceptación |
|---|---|
| CA-04.1 | **Dado** que soy administrador, **cuando** abro "Usuarios y roles", **entonces** veo la lista de usuarios paginada y puedo buscar por nombre o correo y filtrar por rol y por estado. |
| CA-04.2 | **Dado** que elijo un rol nuevo para un usuario, **cuando** lo selecciono, **entonces** se me pide confirmar ("¿Cambiar el rol?"). Si cancelo, no cambia nada. Si confirmo, el rol se actualiza. |
| CA-04.3 | **Dado** un cambio de rol, **entonces** se audita `ROLE_CHANGED` con el administrador que lo hizo, el usuario afectado y los roles anterior y nuevo. |
| CA-04.4 | **Dado** que le cambiaron el rol a un usuario con sesión abierta, **cuando** hace su siguiente petición, **entonces** su sesión se invalida y al volver a entrar ve solo lo del nuevo rol. |
| CA-04.5 | **Dado** que soy administrador, **cuando** intento cambiar mi propio rol, **entonces** el control está deshabilitado y la API lo rechaza (400). |
| CA-04.6 | **Dado** que el usuario es el **último administrador activo**, **cuando** se intenta quitarle el rol de administrador, **entonces** se rechaza (409) para que la plataforma nunca quede sin administrador. |
| CA-04.7 | **Dado** un rol inexistente, un id inválido o un usuario que no existe, **entonces** la API responde 400 o 404 y no audita ningún cambio. |
| CA-04.8 | **Dado** el panel de administración, **entonces** se muestra la matriz de roles y permisos vigente. |

### HU-05: Restricción de funcionalidades según el perfil

**Como** usuario, **quiero** ver solo las opciones de mi perfil **para** no confundirme ni acceder a funciones ajenas.

| ID | Criterio de aceptación |
|---|---|
| CA-05.1 | **Dado** que soy Paciente, **entonces** el menú muestra solo *Mis citas*, *Buscar médico* y *Pagos*. |
| CA-05.2 | **Dado** que soy Centro médico, **entonces** el menú muestra solo *Agenda del centro* y *Médicos y horarios*. |
| CA-05.3 | **Dado** que soy Administrador, **entonces** el menú muestra solo *Usuarios y roles* y *Auditoría*. |
| CA-05.4 | **Dado** cualquier rol, **cuando** uso la app en el celular, **entonces** el menú se abre como panel lateral con las mismas opciones restringidas, sin desplazamiento horizontal. |
| CA-05.5 | **Dado** cualquier recurso de la API, **entonces** también está restringido por rol con `@Roles()`, aunque alguien intente llamarlo sin pasar por la interfaz. |

### HU-06: Acceso autorizado y no autorizado

**Como** responsable de seguridad, **quiero** que cada página y endpoint verifique la sesión y el rol **para** impedir accesos indebidos.

| ID | Criterio de aceptación |
|---|---|
| CA-06.1 | **Dado** que no tengo sesión, **cuando** abro una página protegida (por ejemplo `/admin/usuarios`), **entonces** se me redirige a `/login?next=…` y, tras iniciar sesión, vuelvo a esa página si mi rol lo permite. |
| CA-06.2 | **Dado** que tengo sesión con otro rol, **cuando** abro una página que no me corresponde, **entonces** veo la pantalla "Acceso denegado" (403), con mi perfil y la ruta solicitada. |
| CA-06.3 | **Dado** que llamo a la API sin sesión, **entonces** recibo 401 "Debes iniciar sesión para continuar.". Con un rol incorrecto recibo 403 "Acceso denegado: tu perfil no tiene permiso para este recurso.". |
| CA-06.4 | **Dado** el rol correcto, **entonces** el acceso se permite (200). |
| CA-06.5 | **Dado** cualquier acceso denegado (401 o 403) en la web o en la API, **entonces** queda auditado (`ACCESS_DENIED_401` o `ACCESS_DENIED_403`) con la ruta, el usuario si lo hay y la IP. |
| CA-06.6 | **Dado** el endpoint interno `POST /api/audit/access-denied`, **cuando** se llama sin la clave interna `x-internal-key`, **entonces** responde 401 y no registra nada. Así nadie puede llenar la auditoría manualmente. |

### HU-07: Activación y desactivación de usuarios

**Como** administrador, **quiero** desactivar y reactivar cuentas **para** retirar o devolver el acceso sin borrar datos.

| ID | Criterio de aceptación |
|---|---|
| CA-07.1 | **Dado** un usuario activo, **cuando** pulso "Desactivar", **entonces** se me pide confirmar. Al confirmar, la cuenta queda desactivada y se audita `USER_DEACTIVATED`. |
| CA-07.2 | **Dado** un usuario desactivado, **cuando** intenta iniciar sesión, **entonces** no puede (CA-02.3). Si tenía una sesión abierta, se invalida en su siguiente petición. |
| CA-07.3 | **Dado** un usuario desactivado, **cuando** pulso "Activar" y confirmo, **entonces** puede volver a entrar y se audita `USER_ACTIVATED`. |
| CA-07.4 | **Dado** que soy administrador, **entonces** no puedo desactivar mi propia cuenta (el botón está deshabilitado y la API responde 400). |
| CA-07.5 | **Dado** que el usuario es el último administrador activo, **entonces** no se puede desactivar (409). |

### HU-08: Auditoría de operaciones

**Como** administrador, **quiero** consultar un registro de los eventos de seguridad **para** dar trazabilidad a las operaciones.

| ID | Criterio de aceptación |
|---|---|
| CA-08.1 | **Dado** que ocurre un registro, login correcto o fallido, logout, cambio de rol, activación, desactivación o acceso denegado (401/403), **entonces** se guarda un evento con fecha, acción, usuario (opcional), detalle e IP. |
| CA-08.2 | **Dado** que soy administrador, **cuando** abro "Auditoría", **entonces** veo una tabla paginada con los eventos más recientes primero. |
| CA-08.3 | **Dado** la tabla, **cuando** filtro por acción, por usuario (correo o nombre, incluido el usuario afectado) o por rango de fechas, **entonces** veo solo los eventos que coinciden. "Limpiar" quita los filtros. |
| CA-08.4 | **Dado** que no soy administrador, **cuando** intento consultar la auditoría, **entonces** recibo 403 (y el intento también se audita). |
| CA-08.5 | **Dado** cualquier evento, **entonces** nunca se guarda la contraseña ni el token. |

---

## Épica 2: Gestión Operativa (citas médicas)

> Como **plataforma de citas**, necesito que pacientes, centros médicos y administradores gestionen el ciclo de vida de las citas (crear, consultar, actualizar y cerrar) con reglas de negocio claras, trazabilidad completa y un reporte básico de la operación.

**Objetivo de negocio:** que la cita médica, la "operación" de MediCita RD, se agende solo en horarios válidos y libres, avance por estados controlados, deje un historial de cada cambio y se pueda medir (asistencia, cancelación e ingresos).

| ID | Historia | Prioridad | Estado | Pruebas |
|---|---|---|---|---|
| HU-09 | Gestión de médicos y horarios | Alta | ✅ Terminada | TC-23 a TC-27, TW-14, TW-15 |
| HU-10 | Agendar una cita | Alta | ✅ Terminada | TC-28, TC-28b, TC-36 a TC-38, TU-10 a TU-12, TU-17 a TU-21, TW-16, TW-17 |
| HU-11 | Consultar citas por estado, fecha o responsable | Alta | ✅ Terminada | TC-29, TC-29b, TC-39, TU-22, TU-22b, TW-18, TW-19, TW-22 |
| HU-12 | Actualizar y reprogramar una cita | Alta | ✅ Terminada | TC-30, TC-31, TU-25 a TU-27b |
| HU-13 | Confirmar, cerrar y cancelar una cita | Alta | ✅ Terminada | TC-32 a TC-35, TU-13 a TU-16, TU-23, TU-24, TU-26, TW-20, TW-21 |
| HU-14 | Historial de cambios de la cita | Alta | ✅ Terminada | TC-40, TC-40b, TU-17, TU-23, TU-25, TU-27, TW-20 |
| HU-15 | Reporte básico de operaciones | Media | ✅ Terminada | TC-41 a TC-42, TU-28 a TU-33, TW-23, TW-24 |

### Reglas de negocio

Se validan en la API, con mensajes en español, y cada una tiene al menos una prueba.

| Regla | Descripción | Respuesta | Pruebas |
|---|---|---|---|
| R1 | No se agenda ni se reprograma en el pasado ni con más de 90 días de anticipación. | 400 | TU-10, TU-20b, TC-37 |
| R2 | La fecha y hora caen dentro del horario del médico (días, inicio y fin, en hora de RD) y alineadas a su duración (8:00, 8:30…). | 400 | TU-11, TC-37, TC-40b |
| R3 | Un médico no puede tener dos citas activas (Pendiente o Confirmada) a la misma hora. | 409 | TU-18, TC-36, TC-31 |
| R4 | Un paciente no puede tener dos citas activas a la misma hora. | 409 | TU-19, TC-36, TW-17 |
| R5 | No se agenda con un médico inactivo. | 400 | TU-12, TU-20, TC-37 |
| R6 | Transiciones: Pendiente → Confirmada o Cancelada; Confirmada → Atendida, No asistió o Cancelada. Reprogramar solo en Pendiente o Confirmada, y la cita vuelve a Pendiente. | 409 | TU-13, TU-25, TC-31, TC-35 |
| R7 | Una cita cerrada (Atendida, No asistió o Cancelada) no se puede modificar. | 409 | TU-14, TU-26, TC-35 |
| R8 | Cancelar exige motivo. El paciente solo puede cancelar hasta 2 horas antes. | 400 | TU-15, TC-34 |
| R9 | Atendida exige notas de cierre. Atendida o No asistió solo después de la hora de la cita. | 400 | TU-16, TC-33, TW-21 |
| R10 | Dos reservas simultáneas no pueden tomar el mismo horario: transacción `Serializable` más índices únicos parciales en PostgreSQL, y bloqueo optimista en los cambios de estado. | 409 | TU-21, TU-24, TC-38 |

### HU-09: Gestión de médicos y horarios

**Como** centro médico, **quiero** registrar mis médicos con su especialidad, precio y horario **para** que los pacientes puedan agendar con ellos.

| ID | Criterio de aceptación |
|---|---|
| CA-09.1 | **Dado** que soy un centro médico, **cuando** registro un médico con nombre, especialidad, precio en DOP, duración del turno (30 min por defecto), días y horas de atención, **entonces** se crea activo, asociado a mi centro, y se audita `MEDICO_CREADO`. |
| CA-09.2 | **Dado** un horario inválido (fin antes del inicio, sin días, hora mal escrita o precio negativo), **cuando** guardo, **entonces** recibo 400 con un mensaje claro por cada error. |
| CA-09.3 | **Dado** un médico de mi centro, **cuando** lo edito, lo desactivo o lo activo, **entonces** el cambio se guarda, se audita (`MEDICO_ACTUALIZADO`, `MEDICO_DESACTIVADO` o `MEDICO_ACTIVADO`) y un médico inactivo deja de aparecer en la búsqueda del paciente. |
| CA-09.4 | **Dado** un médico de **otro** centro, **cuando** intento editarlo, **entonces** recibo 403 y el intento se audita. |
| CA-09.5 | **Dado** que soy cualquier usuario autenticado, **cuando** busco médicos por especialidad o texto, **entonces** veo los activos con su centro, horario y precio. El centro ve solo los suyos, incluidos los inactivos. |
| CA-09.6 | **Dado** un médico y una fecha, **cuando** consulto su disponibilidad, **entonces** veo cada turno del día marcado como libre u ocupado (o pasado o fuera de rango), y los días sin atención aparecen sin turnos. |

### HU-10: Agendar una cita

**Como** paciente, **quiero** elegir un médico, una fecha y un horario libre **para** agendar mi consulta o estudio sabiendo cuánto cuesta.

| ID | Criterio de aceptación |
|---|---|
| CA-10.1 | **Dado** que busco por especialidad y abro el perfil de un médico, **cuando** elijo una fecha, **entonces** solo puedo seleccionar los turnos libres. |
| CA-10.2 | **Dado** que elegí horario, tipo (Consulta o Estudio) y motivo, **cuando** pulso "Continuar", **entonces** veo un resumen con el médico, el centro, la fecha, la hora y el **costo**, y debo confirmar. |
| CA-10.3 | **Dado** que confirmo, **entonces** se crea la cita con un código legible (`CIT-0001`), estado **Pendiente** y el costo copiado del precio del médico en ese momento; se registra `CREADA` en el historial y `CITA_CREADA` en la auditoría. |
| CA-10.4 | **Dado** un horario que viola R1, R2 o R5, **cuando** intento agendar, **entonces** recibo 400 con un mensaje que explica la regla. |
| CA-10.5 | **Dado** que el médico (R3) o yo (R4) ya tenemos una cita activa a esa hora, **cuando** intento agendar, **entonces** recibo 409 y la pantalla me pide elegir otro horario. |
| CA-10.6 | **Dado** que dos pacientes reservan el mismo turno al mismo tiempo, **entonces** solo uno obtiene la cita y el otro recibe 409 (R10). |
| CA-10.7 | **Dado** que soy centro médico o administrador, **cuando** intento crear una cita, **entonces** recibo 403. |

### HU-11: Consultar citas por estado, fecha o responsable

**Como** paciente, centro médico o administrador, **quiero** consultar las citas con filtros **para** dar seguimiento a la operación.

| ID | Criterio de aceptación |
|---|---|
| CA-11.1 | **Dado** que soy paciente, **cuando** abro "Mis citas", **entonces** veo **solo las mías** en las pestañas **Próximas** (Pendiente o Confirmada) e **Historial** (cerradas), con el estado en color. |
| CA-11.2 | **Dado** que soy centro médico, **cuando** abro la "Agenda del centro", **entonces** veo **solo las citas de mi centro** y puedo filtrar por estado, rango de fechas y médico. |
| CA-11.3 | **Dado** que soy administrador, **cuando** abro "Operaciones", **entonces** veo todas las citas y puedo filtrar por estado, fecha, centro y médico. |
| CA-11.4 | **Dado** cualquier listado, **entonces** puedo buscar por código, paciente o motivo, ordenar por fecha y paginar. El **responsable** de una cita es su médico y su centro (`medicoId` o `centroId`). |
| CA-11.5 | **Dado** una cita que no es mía (otro paciente u otro centro), **cuando** intento verla, cambiarla o ver su historial, **entonces** recibo **403** "Acceso denegado: esta cita no te pertenece." y el intento se audita (`ACCESS_DENIED_403`). |
| CA-11.6 | **Dado** un paciente, **cuando** envía filtros de otro paciente o de otro centro, **entonces** la API los ignora y mantiene su alcance. |

### HU-12: Actualizar y reprogramar una cita

**Como** paciente o centro médico, **quiero** corregir el motivo o el tipo de una cita y cambiarla de horario **para** mantener la agenda al día.

| ID | Criterio de aceptación |
|---|---|
| CA-12.1 | **Dado** una cita Pendiente o Confirmada, **cuando** cambio el motivo o el tipo, **entonces** se guarda y el historial registra `ACTUALIZADA` con `{campo: {antes, despues}}`. Un PATCH sin cambios reales responde 400. |
| CA-12.2 | **Dado** una cita Pendiente o Confirmada, **cuando** la reprogramo a un turno libre y válido, **entonces** cambia la fecha y la cita vuelve a **Pendiente** (debe confirmarse otra vez); el historial guarda la fecha anterior y la nueva. |
| CA-12.3 | **Dado** un turno nuevo ocupado o inválido, **cuando** reprogramo, **entonces** recibo 409 (R3 o R4) o 400 (R1, R2 o R5), y la cita no cambia. |
| CA-12.4 | **Dado** una cita cerrada, **cuando** intento editarla o reprogramarla, **entonces** recibo 409 (R7). |

### HU-13: Confirmar, cerrar y cancelar una cita

**Como** centro médico, **quiero** confirmar, cerrar y cancelar las citas de mi centro, **y como** paciente, **quiero** poder cancelar la mía **para** que la agenda refleje lo que pasó.

| ID | Criterio de aceptación |
|---|---|
| CA-13.1 | **Dado** una cita Pendiente de mi centro, **cuando** la confirmo, **entonces** pasa a **Confirmada**. El paciente no puede confirmar (403). |
| CA-13.2 | **Dado** una cita Confirmada cuya hora ya pasó, **cuando** la cierro como **Atendida** con notas o como **No asistió**, **entonces** queda cerrada. Atendida sin notas responde 400, y cerrar antes de la hora también responde 400 (R9). |
| CA-13.3 | **Dado** una cita activa, **cuando** la cancelo con un motivo, **entonces** pasa a **Cancelada** y el turno se libera. Sin motivo responde 400. El paciente solo puede cancelar hasta 2 horas antes; el centro, siempre (R8). |
| CA-13.4 | **Dado** una transición no permitida (por ejemplo, cerrar una cita Pendiente o confirmar una Cancelada), **entonces** recibo **409** con el estado actual y el solicitado (R6 y R7). |
| CA-13.5 | **Dado** cualquier acción, **entonces** la pantalla pide confirmación antes de ejecutarla y muestra el error de la regla de negocio dentro del diálogo. |
| CA-13.6 | **Dado** que dos personas cambian la misma cita a la vez, **entonces** la segunda recibe 409 "La cita fue modificada por otra persona al mismo tiempo…" (R10). |

### HU-14: Historial de cambios de la cita

**Como** paciente, centro médico o administrador, **quiero** ver la línea de tiempo de una cita **para** saber quién hizo cada cambio y cuándo.

| ID | Criterio de aceptación |
|---|---|
| CA-14.1 | **Dado** cualquier cambio (creada, actualizada, reprogramada, confirmada, cerrada o cancelada), **entonces** se guarda una entrada con la acción, el usuario, el estado anterior y el nuevo, los cambios `{campo: {antes, despues}}`, el comentario y la fecha. |
| CA-14.2 | **Dado** que el historial se escribe en la **misma transacción** que el cambio, **cuando** una regla falla, **entonces** no queda ninguna entrada nueva. |
| CA-14.3 | **Dado** el detalle de una cita, **cuando** lo abro, **entonces** veo el historial completo en orden cronológico, como una línea de tiempo. |
| CA-14.4 | **Dado** cualquier acción sobre médicos o citas, **entonces** también queda en la auditoría general (`CITA_*` y `MEDICO_*`). |

### HU-15: Reporte básico de operaciones

**Como** administrador (global) o centro médico (solo mi centro), **quiero** un reporte de las citas de un período **para** medir la operación.

| ID | Criterio de aceptación |
|---|---|
| CA-15.1 | **Dado** un rango de fechas y, opcionalmente, un centro o un médico, **cuando** genero el reporte, **entonces** veo los totales por estado, por médico y por día; la **tasa de asistencia** (Atendidas ÷ (Atendidas + No asistió)); la **tasa de cancelación** (Canceladas ÷ total) y los **ingresos** (suma del costo de las Atendidas). |
| CA-15.2 | **Dado** el reporte en pantalla, **entonces** veo tarjetas con totales y tasas, un gráfico por estado, un gráfico por día, una tabla por médico y el botón **"Descargar CSV"**, y puedo abrir una **vista imprimible**. |
| CA-15.3 | **Dado** que soy centro médico, **cuando** pido el reporte de otro centro, **entonces** la API me devuelve solo el de mi centro. El paciente recibe 403. |
| CA-15.4 | **Dado** el CSV, **entonces** incluye el resumen, la tabla por médico, la tabla por día y el detalle de cada cita, abre correctamente en Excel (UTF-8 con BOM) y protege las celdas contra fórmulas. |
| CA-15.5 | **Dado** un rango invertido o una fecha mal escrita, **entonces** recibo 400. |

---

## Épica 3: Gestión Logística (inventario)

> Como **centro médico**, necesito controlar el inventario de insumos y equipos (existencias, lotes, vencimientos, asignaciones y consumos) para atender a los pacientes sin quedarme sin material, sin usar productos vencidos y sabiendo quién tiene cada equipo.

**Objetivo de negocio:** que cada movimiento del inventario quede registrado, validado e inmutable; que el sistema avise de bajo stock y vencimientos, y que el centro y el administrador puedan medir existencias, valor y consumo.

| ID | Historia | Prioridad | Estado | Pruebas |
|---|---|---|---|---|
| HU-16 | Registrar y consultar recursos | Alta | ✅ Terminada | TC-43 a TC-45, TU-39, TW-25, TW-26, TW-33 |
| HU-17 | Entradas, salidas, ajustes y consumo en citas | Alta | ✅ Terminada | TC-46 a TC-49, TC-53, TC-54, TU-34 a TU-36, TU-40, TU-41, TU-43 a TU-47, TW-27, TW-28, TW-30 |
| HU-18 | Asignar y devolver equipos | Alta | ✅ Terminada | TC-50, TU-37, TU-38, TW-29 |
| HU-19 | Validar disponibilidad y alertas | Alta | ✅ Terminada | TC-51, TU-36, TU-42, TW-25, TW-27 |
| HU-20 | Historial de movimientos | Alta | ✅ Terminada | TC-52, TU-43, TW-28, TW-31 |
| HU-21 | Reportes de existencias y de movimientos | Media | ✅ Terminada | TC-55, TC-56, TU-48 a TU-50, TW-32 |

### Reglas de negocio

Se validan en la API (con la fila del recurso bloqueada), con mensajes en español, y cada una tiene al menos una prueba.

| Regla | Descripción | Respuesta | Pruebas |
|---|---|---|---|
| L1 | Las cantidades son enteros mayores que 0. | 400 | TU-34, TC-46, TC-47 |
| L2 | Una SALIDA no puede dejar el stock negativo: "Stock insuficiente (disponible: X)". | 409 | TU-35, TC-47, TC-53 |
| L3 | Insumos con vencimiento: la ENTRADA exige lote y fecha futura; la SALIDA descuenta por FEFO (primero el lote que vence antes) y nunca toma lotes vencidos. | 400 / 409 | TU-36, TC-46, TC-47 |
| L4 | Solo los EQUIPOS se asignan; solo si están DISPONIBLES, a un médico activo del mismo centro y con devolución prevista futura. Ya ASIGNADO o en MANTENIMIENTO → 409. | 400 / 409 | TU-37, TC-50 |
| L5 | Solo se devuelve un equipo ASIGNADO; vuelve a DISPONIBLE. | 409 | TU-38, TC-50 |
| L6 | Un recurso inactivo o dado de baja no admite movimientos. | 409 | TU-39, TC-49, TC-50 |
| L7 | Un AJUSTE exige motivo y no puede dejar el stock negativo. | 400 / 409 | TU-40, TC-48 |
| L8 | Una SALIDA ligada a una cita exige que la cita sea del mismo centro (si no, 403 auditado) y esté ATENDIDA (si no, 409). | 403 / 409 | TU-41, TU-45, TC-53 |
| L9 | Dos salidas simultáneas no pueden dejar el stock negativo: `SELECT … FOR UPDATE` sobre la fila del recurso dentro de la transacción, más `CHECK (stock >= 0)` en la base. | 409 | TU-43, TU-44, TC-54 |
| L10 | Alertas: insumo con disponible ≤ mínimo → "Bajo stock"; lote que vence en 30 días o menos → "Próximo a vencer"; lote ya vencido con existencias → "Vencido". | — | TU-42, TC-51, TC-55 |

### HU-16: Registrar y consultar recursos

**Como** centro médico, **quiero** registrar los insumos y equipos de mi centro **para** controlar su existencia y su valor.

| ID | Criterio de aceptación |
|---|---|
| CA-16.1 | **Dado** que soy un centro, **cuando** registro un insumo (nombre, categoría, unidad, costo, stock mínimo y si maneja lotes) o un equipo (con número de serie), **entonces** se crea con el código `REC-0001…`, el insumo con stock 0 y el equipo DISPONIBLE, y se audita `RECURSO_CREADO`. |
| CA-16.2 | **Dado** que ya tengo un recurso con ese nombre, **cuando** registro otro igual, **entonces** recibo 409 "Ya existe un recurso con ese nombre en tu centro." (otro centro sí puede usar el mismo nombre). |
| CA-16.3 | **Dado** el listado, **cuando** filtro por tipo, categoría, texto (nombre, código o serie) o estado (bajo stock, próximo a vencer, vencido, disponible, asignado, mantenimiento, inactivo), **entonces** veo solo los recursos que coinciden, con sus insignias y el resumen de alertas. |
| CA-16.4 | **Dado** un recurso mío, **cuando** lo edito o lo doy de baja o lo reactivo, **entonces** el cambio se guarda y se audita. El stock nunca se edita a mano: solo con movimientos. |
| CA-16.5 | **Dado** un recurso de otro centro, **cuando** intento verlo, editarlo o moverlo, **entonces** recibo 403 "Acceso denegado: este recurso pertenece a otro centro." y queda auditado. El paciente recibe 403 en todo el inventario. |
| CA-16.6 | **Dado** que soy administrador, **cuando** abro Inventario, **entonces** veo los recursos de todos los centros con filtro por centro, en solo lectura. |

### HU-17: Entradas, salidas, ajustes y consumo en citas

**Como** centro médico, **quiero** registrar lo que entra, sale o se corrige del inventario, y los insumos usados en cada cita, **para** que el stock refleje la realidad.

| ID | Criterio de aceptación |
|---|---|
| CA-17.1 | **Dado** un insumo, **cuando** registro una ENTRADA con cantidad, factura o proveedor y costo, **entonces** el stock sube, se crea el movimiento `MOV-…` con el stock antes y después, y el costo pasa a ser el último costo del recurso. |
| CA-17.2 | **Dado** un insumo con vencimiento, **cuando** registro una entrada sin lote o con una fecha vencida, **entonces** recibo 400 (L3). Si el lote ya existe con la misma fecha, la cantidad se suma a ese lote. |
| CA-17.3 | **Dado** un insumo, **cuando** registro una SALIDA, **entonces** se descuenta por FEFO (un movimiento por lote), sin tomar lotes vencidos; si no alcanza, recibo 409 "Stock insuficiente (disponible: X)." y no cambia nada. |
| CA-17.4 | **Dado** un AJUSTE, **cuando** no indico el motivo o la disminución dejaría el stock negativo, **entonces** recibo 400 o 409 (L7). En insumos con lotes, el ajuste se hace sobre un lote. |
| CA-17.5 | **Dado** una cita ATENDIDA de mi centro, **cuando** pulso "Registrar insumos usados" y confirmo varios insumos, **entonces** se crean SALIDAS ligadas a la cita en una sola operación: si un insumo no alcanza, no se registra ninguno. |
| CA-17.6 | **Dado** una cita que no está atendida o que es de otro centro, **cuando** registro un consumo, **entonces** recibo 409 o 403 (L8). |
| CA-17.7 | **Dado** un recurso inactivo o dado de baja, **cuando** intento cualquier movimiento, **entonces** recibo 409 (L6). |
| CA-17.8 | **Dado** que dos personas sacan del mismo insumo al mismo tiempo, **entonces** el stock nunca queda negativo y la que no alcanza recibe 409 (L9). |

### HU-18: Asignar y devolver equipos

**Como** centro médico, **quiero** asignar equipos a los médicos y registrar su devolución **para** saber siempre quién tiene cada equipo.

| ID | Criterio de aceptación |
|---|---|
| CA-18.1 | **Dado** un equipo DISPONIBLE, **cuando** lo asigno a un médico activo de mi centro con una fecha de devolución futura, **entonces** pasa a ASIGNADO y se registra el movimiento con el médico y la fecha prevista. |
| CA-18.2 | **Dado** un equipo ya ASIGNADO o en MANTENIMIENTO, **cuando** intento asignarlo, **entonces** recibo 409. Un médico inactivo o de otro centro, o una fecha pasada, responden 400 (L4). Un insumo no se asigna (400). |
| CA-18.3 | **Dado** un equipo ASIGNADO, **cuando** registro la devolución, **entonces** vuelve a DISPONIBLE. Devolver uno que no está asignado responde 409 (L5). |
| CA-18.4 | **Dado** un equipo, **cuando** lo envío a mantenimiento, lo marco disponible otra vez o lo doy de baja, **entonces** queda un movimiento AJUSTE con el estado antes y después. Un equipo asignado no se puede mandar a mantenimiento ni dar de baja sin devolverlo antes (409). |

### HU-19: Validar disponibilidad y alertas

**Como** centro médico, **quiero** ver cuánto hay disponible realmente y recibir alertas **para** reponer a tiempo y no usar productos vencidos.

| ID | Criterio de aceptación |
|---|---|
| CA-19.1 | **Dado** un insumo con lotes, **cuando** consulto su disponibilidad, **entonces** veo cada lote con su vencimiento, cantidad y estado (Vigente, Próximo a vencer o Vencido), cuál sale primero, y el disponible sin contar los vencidos. |
| CA-19.2 | **Dado** un equipo, **cuando** consulto su disponibilidad, **entonces** veo su estado y, si está asignado, a qué médico, hasta cuándo y si la devolución está atrasada. |
| CA-19.3 | **Dado** el listado de recursos, **entonces** veo las insignias "Bajo stock", "Próximo a vencer" y "Vencido", y tarjetas con cuántos recursos tienen cada alerta; al pulsarlas se filtra la tabla. |

### HU-20: Historial de movimientos

**Como** centro médico o administrador, **quiero** consultar el historial de movimientos **para** saber qué pasó con cada recurso, cuándo y quién lo hizo.

| ID | Criterio de aceptación |
|---|---|
| CA-20.1 | **Dado** el detalle de un recurso, **entonces** veo la línea de tiempo completa y en orden, con el tipo, el código, el stock antes y después (o el estado del equipo), el usuario, el lote, el médico, la cita, la referencia y el motivo. |
| CA-20.2 | **Dado** la pantalla Movimientos, **cuando** filtro por tipo, rango de fechas, médico, usuario o texto, **entonces** veo solo los que coinciden; el centro ve solo los suyos y el admin los de todos (con filtro por centro). |
| CA-20.3 | **Dado** cualquier movimiento, **entonces** no se puede editar ni borrar (no existen esas rutas): un error se corrige con un AJUSTE. Cada movimiento queda también en la auditoría (`MOV_*`). |

### HU-21: Reportes de existencias y de movimientos

**Como** centro médico (mi centro) o administrador (global), **quiero** reportes del inventario **para** conocer su valor, las alertas y el consumo.

| ID | Criterio de aceptación |
|---|---|
| CA-21.1 | **Dado** el reporte de existencias, **entonces** veo claramente el **valor total del inventario en DOP** y los totales de **Bajo stock**, **Próximo a vencer** y **Vencido**, los equipos por estado, el valor por categoría, las listas de cada alerta y la tabla de existencias por recurso. |
| CA-21.2 | **Dado** el reporte de movimientos de un rango de fechas, **entonces** veo los totales de entradas y salidas (unidades y valor), los movimientos por tipo, por recurso y por día, y el consumo por cita. |
| CA-21.3 | **Dado** cualquiera de los dos reportes, **cuando** pulso "Descargar CSV" o "Vista imprimible", **entonces** obtengo el mismo contenido en CSV (UTF-8 con BOM) o en una página lista para imprimir. |
| CA-21.4 | **Dado** que soy centro, **cuando** pido el reporte de otro centro, **entonces** la API me devuelve el mío. El paciente recibe 403. |

---

## Matriz de autorización

| Recurso | Anónimo | Paciente | Centro médico | Administrador |
|---|:-:|:-:|:-:|:-:|
| Inicio, Iniciar sesión, Crear cuenta | ✅ | ↪ panel | ↪ panel | ↪ panel |
| `/paciente/*` (Mis citas, Buscar médico, Pagos) | ↪ login | ✅ | 403 | 403 |
| `/centro/*` (Agenda, Médicos y horarios, Inventario, Reportes) | ↪ login | 403 | ✅ | 403 |
| `/admin/*` (Usuarios y roles, Operaciones, Reportes, Inventario, Auditoría) | ↪ login | 403 | 403 | ✅ |
| API `/api/users/*`, `/api/audit` | 401 | 403 | 403 | ✅ |
| API `/api/modules/paciente` | 401 | ✅ | 403 | 403 |
| API `/api/modules/centro` | 401 | 403 | ✅ | 403 |
| API `GET /api/medicos*` (buscar y disponibilidad) | 401 | ✅ activos | ✅ los suyos | ✅ |
| API `POST`/`PATCH /api/medicos*` | 401 | 403 | ✅ los suyos (otro centro: 403) | 403 |
| API `POST /api/citas` | 401 | ✅ | 403 | 403 |
| API `GET /api/citas*` | 401 | ✅ las suyas | ✅ las de su centro | ✅ todas |
| API `PATCH /api/citas/:id`, `reprogramar`, `cancelar` | 401 | ✅ las suyas | ✅ las de su centro | 403 |
| API `confirmar`, `cerrar` | 401 | 403 | ✅ las de su centro | 403 |
| API `/api/reportes/citas`, `citas.csv` | 401 | 403 | ✅ su centro | ✅ global |
| API `GET /api/recursos*`, `GET /api/movimientos` | 401 | 403 | ✅ los suyos (otro centro: 403) | ✅ todos (lectura) |
| API `POST`/`PATCH /api/recursos*`, `POST /api/movimientos/*` | 401 | 403 | ✅ los suyos (otro centro: 403) | 403 |
| API `/api/reportes/existencias`, `movimientos` (y `.csv`) | 401 | 403 | ✅ su centro | ✅ global |

## Permisos por rol

| Rol | Permisos |
|---|---|
| Paciente | `citas:ver`, `medicos:buscar`, `pagos:ver` |
| Centro médico | `agenda:gestionar`, `medicos:gestionar`, `reportes:ver`, `inventario:gestionar` |
| Administrador | `usuarios:gestionar`, `auditoria:ver`, `operaciones:ver`, `reportes:ver`, `inventario:ver` |

## Definición de terminado

Una historia se considera terminada cuando:

- su código está en el repositorio;
- sus criterios están cubiertos por pruebas automatizadas o por una prueba web documentada;
- `npm test` pasa completo;
- la documentación y la evidencia están actualizadas.

## Fuera del alcance

**Épica 3:** órdenes de compra y proveedores, traslados entre centros, códigos de barras, inventarios físicos programados, reservas de equipos a futuro y notificaciones automáticas de alertas.

**Épica 2:** pagos en línea, notificaciones (correo, SMS o WhatsApp), recordatorios automáticos, lista de espera, excepciones de horario (feriados y vacaciones del médico), varios horarios por día para un mismo médico y edición de citas por el administrador.

**Épica 1:** bloqueo por intentos fallidos, verificación de correo, recuperación de contraseña, autenticación multifactor, revocación de tokens en el servidor (lista negra), permisos granulares editables desde la interfaz y despliegue público.
