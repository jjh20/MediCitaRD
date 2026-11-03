# Guion de la demo en vivo: Épica 1 (8 a 10 minutos)

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

1. Ventana B (paciente): el menú muestra solo **Mis citas, Buscar médico y Pagos**. Al pie de cada página: *"Acceso verificado por la API: módulo Paciente…"*. La API también valida el rol.
2. Cerrar sesión y entrar como `centro@medicita.local` → solo **Agenda del centro y Médicos y horarios**.
3. Ventana A: entrar como `admin@medicita.local` → solo **Usuarios y roles y Auditoría**.
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

Resultado esperado: **36 unitarias + 44 e2e aprobadas**. Mostrar [PLAN_PRUEBAS.md](PLAN_PRUEBAS.md) y [HISTORIAS_Y_CRITERIOS.md](HISTORIAS_Y_CRITERIOS.md).

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
