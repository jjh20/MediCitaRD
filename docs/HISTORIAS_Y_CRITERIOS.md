# Historias de usuario y criterios de aceptación: Épicas 1 y 2

- [Épica 1: Configuración, gestión de usuarios y accesos](#épica-1-configuración-gestión-de-usuarios-y-accesos) (HU-01 a HU-08)
- [Épica 2: Gestión Operativa (citas médicas)](#épica-2-gestión-operativa-citas-médicas) (HU-09 a HU-15)

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

## Matriz de autorización

| Recurso | Anónimo | Paciente | Centro médico | Administrador |
|---|:-:|:-:|:-:|:-:|
| Inicio, Iniciar sesión, Crear cuenta | ✅ | ↪ panel | ↪ panel | ↪ panel |
| `/paciente/*` (Mis citas, Buscar médico, Pagos) | ↪ login | ✅ | 403 | 403 |
| `/centro/*` (Agenda, Médicos y horarios, Reportes) | ↪ login | 403 | ✅ | 403 |
| `/admin/*` (Usuarios y roles, Operaciones, Reportes, Auditoría) | ↪ login | 403 | 403 | ✅ |
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

## Permisos por rol

| Rol | Permisos |
|---|---|
| Paciente | `citas:ver`, `medicos:buscar`, `pagos:ver` |
| Centro médico | `agenda:gestionar`, `medicos:gestionar`, `reportes:ver` |
| Administrador | `usuarios:gestionar`, `auditoria:ver`, `operaciones:ver`, `reportes:ver` |

## Definición de terminado

Una historia se considera terminada cuando:

- su código está en el repositorio (commit local en `main`);
- sus criterios están cubiertos por pruebas automatizadas o por una prueba web documentada;
- `npm test` pasa completo;
- la documentación y la evidencia están actualizadas.

## Fuera del alcance

**Épica 2:** pagos en línea, notificaciones (correo, SMS o WhatsApp), recordatorios automáticos, lista de espera, excepciones de horario (feriados y vacaciones del médico), varios horarios por día para un mismo médico y edición de citas por el administrador.

**Épica 1:** bloqueo por intentos fallidos, verificación de correo, recuperación de contraseña, autenticación multifactor, revocación de tokens en el servidor (lista negra), permisos granulares editables desde la interfaz y despliegue público.
