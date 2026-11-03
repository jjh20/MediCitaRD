# Historias de usuario y criterios de aceptación: Épica 1

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
| HU-06 | Acceso autorizado y no autorizado | Alta | ✅ Terminada | TC-11 a TC-14, TC-21, TW-04, TW-06 |
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

## Matriz de autorización

| Recurso | Anónimo | Paciente | Centro médico | Administrador |
|---|:-:|:-:|:-:|:-:|
| Inicio, Iniciar sesión, Crear cuenta | ✅ | ↪ panel | ↪ panel | ↪ panel |
| `/paciente/*` (Mis citas, Buscar médico, Pagos) | ↪ login | ✅ | 403 | 403 |
| `/centro/*` (Agenda, Médicos y horarios) | ↪ login | 403 | ✅ | 403 |
| `/admin/usuarios`, `/admin/auditoria` | ↪ login | 403 | 403 | ✅ |
| API `/api/users/*`, `/api/audit` | 401 | 403 | 403 | ✅ |
| API `/api/modules/paciente` | 401 | ✅ | 403 | 403 |
| API `/api/modules/centro` | 401 | 403 | ✅ | 403 |

## Permisos por rol

| Rol | Permisos |
|---|---|
| Paciente | `citas:ver`, `medicos:buscar`, `pagos:ver` |
| Centro médico | `agenda:gestionar`, `medicos:gestionar` |
| Administrador | `usuarios:gestionar`, `auditoria:ver` |

## Definición de terminado

Una historia se considera terminada cuando:

- su código está en el repositorio (commit local en `main`);
- sus criterios están cubiertos por pruebas automatizadas o por una prueba web documentada;
- `npm test` pasa completo;
- la documentación y la evidencia están actualizadas.

## Fuera del alcance de esta épica

Bloqueo por intentos fallidos, verificación de correo, recuperación de contraseña, autenticación multifactor, revocación de tokens en el servidor (lista negra), permisos granulares editables desde la interfaz y despliegue público.
