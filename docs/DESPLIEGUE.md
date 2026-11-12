# Despliegue del entorno de prueba (Neon + Render + Vercel)

Esta guía publica MediCita RD en una URL pública **de prueba**. Está escrita para hacerla por primera vez, paso a paso. Calcula entre 45 y 60 minutos.

| Pieza | Servicio | Qué corre ahí |
|---|---|---|
| Base de datos | **Neon** (PostgreSQL) | Los datos: usuarios, citas, inventario… |
| API | **Render** (Web Service de Node) | `apps/api` (NestJS). Al arrancar aplica las migraciones pendientes. |
| Web | **Vercel** | `apps/web` (Next.js). Su ruta `/api/*` reenvía las peticiones a la API de Render. |

```
Navegador ──► Vercel (web, https://medicita-rd.vercel.app)
                 │  /api/*  (proxy del mismo dominio)
                 ▼
              Render (API, https://medicita-api.onrender.com) ──► Neon (PostgreSQL)
```

> **¿Por qué la web reenvía `/api` en vez de llamar directo a Render?** La sesión viaja en una cookie `httpOnly`. Con el proxy, el navegador solo habla con el dominio de Vercel, y la cookie queda en ese dominio. Así no hacen falta cookies entre dominios, que los navegadores bloquean cada vez más.

---

## 0. Antes de empezar

1. **El código debe estar en GitHub.** Haz tú el commit y el push de la rama que vas a publicar. Recomendado: fusionar `Jael` en `main` y publicar `main`. Si prefieres publicar `Jael`, elígela donde la guía dice "rama".
2. **Crea las cuentas** en [neon.tech](https://neon.tech), [render.com](https://render.com) y [vercel.com](https://vercel.com). Lo más fácil es entrar con tu cuenta de GitHub en las tres. Los planes gratuitos alcanzan.
3. **Elige ya el nombre del proyecto en Vercel**, porque define la URL de la web. En esta guía usamos `medicita-rd`, que da `https://medicita-rd.vercel.app`. Si ese nombre está ocupado, Vercel te dará otro; anótalo, porque lo usarás en Render (`WEB_URL`).
4. **Genera dos secretos aleatorios** en una terminal, dentro de la carpeta del proyecto. Ejecuta el comando **dos veces** y guarda cada resultado en un lugar seguro, como un gestor de contraseñas. **Nunca los pegues en el repositorio**.
   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   - El primero será `JWT_SECRET`.
   - El segundo será `INTERNAL_API_KEY`.

   Los dos deben ser **exactamente iguales** en Render y en Vercel.

La plantilla con todas las variables está en [`.env.production.example`](../.env.production.example). Es solo una referencia y no lleva secretos reales.

---

## 1. Crear la base de datos en Neon

1. Entra a Neon y pulsa **New Project**.
2. Completa:
   - **Project name:** `medicita`
   - **Postgres version:** 16
   - **Region:** **AWS US East 1 (N. Virginia)**, cerca de donde estará la API en Render.
3. Pulsa **Create project**.
4. En el panel del proyecto pulsa **Connect** (arriba a la derecha).
   - **Branch:** `main` · **Database:** `neondb` · **Role:** el que aparece (por ejemplo `neondb_owner`).
   - **Desactiva "Connection pooling"**. Necesitamos la **conexión directa**: el host **no** debe contener `-pooler`. Las migraciones de Prisma necesitan la conexión directa.
   - Copia la cadena de conexión. Se ve así:
     ```
     postgresql://neondb_owner:CONTRASEÑA@ep-algo-123456.us-east-1.aws.neon.tech/neondb?sslmode=require
     ```
5. Revisa la cadena:
   - Debe terminar en `?sslmode=require`.
   - Si al final dice `&channel_binding=require`, **bórralo** y deja solo `?sslmode=require`.
6. Guárdala junto a los secretos. Esta es tu `DATABASE_URL`.

> El plan gratuito de Neon "suspende" la base cuando no se usa. La primera consulta después de un rato tarda uno o dos segundos más; es normal.

---

## 2. Crear las tablas y los datos de demo desde tu computadora

Las migraciones crean las tablas, y el seed crea las cuentas, los médicos, las citas y el inventario de demo. Las corres **una vez** desde tu PC, apuntando a Neon. Necesitas tener el proyecto instalado (`npm install`) y tu `.env` local.

Abre **PowerShell** en la carpeta del proyecto y ejecuta, cambiando los valores entre comillas:

```powershell
cd C:\Users\ASUS\Documents\medi_cita

# 1) Apuntar SOLO esta terminal a Neon (tu .env local no se modifica)
$env:DATABASE_URL = "postgresql://neondb_owner:CONTRASEÑA@ep-algo-123456.us-east-1.aws.neon.tech/neondb?sslmode=require"

# 2) Recomendado: una contraseña de administrador distinta a la de demo,
#    porque la URL será pública (mínimo 10 caracteres, con mayúscula,
#    minúscula, número y símbolo)
$env:BOOTSTRAP_ADMIN_PASSWORD = "Tu-Clave-De-Admin-2026!"

# 3) Crear las tablas en Neon
npm run db:migrate

# 4) Cargar los datos de demo
npm run db:seed

# 5) Volver a apuntar esta terminal a tu base local
Remove-Item Env:DATABASE_URL
Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD
```

Qué debes ver:

- `db:migrate` → `All migrations have been successfully applied.` (aplica las 3 migraciones: init, épica 2 y épica 3).
- `db:seed` → la lista de cuentas, médicos, citas e inventario, y al final `Seed completado.`

Las variables que defines con `$env:` en la terminal **tienen prioridad** sobre las de tu `.env`. Por eso estos comandos van a Neon y no a tu base local, solo mientras esa terminal tenga la variable.

En Neon → **Tables** debes ver las tablas `User`, `Cita`, `Medico`, `Recurso`, `Movimiento`…

> - **Nunca** ejecutes `npm run db:reset` con `DATABASE_URL` apuntando a Neon: borra todo.
> - Las fechas de las citas y los lotes de demo son relativas al día en que corre el seed. Antes de una demo puedes repetir los pasos 1, 4 y 5 para refrescarlas.

---

## 3. Publicar la API en Render

Hay dos formas. La **A** usa el archivo [`render.yaml`](../render.yaml) del repositorio y tiene menos pasos. La **B** es manual, por si prefieres ver cada opción.

### Opción A: Blueprint (recomendada)

1. En Render: **New +** → **Blueprint**.
2. Conecta tu cuenta de GitHub si te lo pide, elige el repositorio **MediCitaRD** y la **rama** que vas a publicar.
3. Render lee `render.yaml` y muestra el servicio `medicita-api`. Te pedirá las variables marcadas como secretas; pega:

   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | La cadena de Neon del paso 1. |
   | `JWT_SECRET` | El primer secreto que generaste. |
   | `INTERNAL_API_KEY` | El segundo secreto. |
   | `WEB_URL` | La URL de Vercel que elegiste, por ejemplo `https://medicita-rd.vercel.app` (sin `/` al final). |

   El resto (`NODE_ENV=production`, `NODE_VERSION=22.16.0`, `JWT_EXPIRES_IN=8h` y `TRUST_PROXY=true`) ya viene en el archivo.
4. Pulsa **Apply**. Render empieza el primer despliegue.

### Opción B: Web Service manual

1. **New +** → **Web Service** → elige el repositorio.
2. Completa:

   | Campo | Valor |
   |---|---|
   | **Name** | `medicita-api` (define la URL `https://medicita-api.onrender.com`) |
   | **Region** | **Virginia (US East)** |
   | **Branch** | La rama que vas a publicar |
   | **Root Directory** | **Déjalo vacío** (raíz del repositorio: es un monorepo) |
   | **Runtime / Language** | Node |
   | **Build Command** | `npm ci --include=dev && npm run build -w @medicita/api` |
   | **Start Command** | `npm run start:deploy -w @medicita/api` |
   | **Instance Type** | Free |

3. En **Environment Variables** agrega:

   | Variable | Valor |
   |---|---|
   | `NODE_VERSION` | `22.16.0` |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | La cadena de Neon |
   | `JWT_SECRET` | El primer secreto |
   | `INTERNAL_API_KEY` | El segundo secreto |
   | `WEB_URL` | `https://medicita-rd.vercel.app` (tu URL de Vercel) |
   | `JWT_EXPIRES_IN` | `8h` |
   | `TRUST_PROXY` | `true` |

   **No** agregues `PORT`: Render la asigna sola y la API la usa.
4. En **Advanced** → **Health Check Path** escribe `/api/health`.
5. Pulsa **Create Web Service**.

### Comprobar la API

1. Abre la pestaña **Logs** del servicio. La compilación tarda unos minutos. Al final debes ver:
   ```
   No pending migrations to apply.
   … API de MediCita RD escuchando en el puerto 10000 (prefijo /api)
   ```
   `start:deploy` ejecuta `prisma migrate deploy` antes de arrancar. Si en el futuro hay migraciones nuevas, se aplican solas en cada despliegue.
2. Abre en el navegador `https://medicita-api.onrender.com/api/health`, con el nombre de tu servicio. Debe responder:
   ```json
   {"status":"ok","servicio":"MediCita RD API"}
   ```
3. Copia la URL base del servicio, **sin** `/api` y sin `/` al final, por ejemplo `https://medicita-api.onrender.com`. La usarás en Vercel.

> **Plan gratuito de Render:** el servicio "se duerme" tras 15 minutos sin uso. La primera petición después tarda hasta un minuto en despertar. Antes de una demo, abre `/api/health` y espera la respuesta.

---

## 4. Publicar la web en Vercel

1. En Vercel: **Add New…** → **Project** → **Import** el repositorio MediCitaRD.
2. En **Configure Project**:

   | Campo | Valor |
   |---|---|
   | **Project Name** | `medicita-rd` (el nombre que elegiste en el paso 0) |
   | **Framework Preset** | Next.js (lo detecta solo) |
   | **Root Directory** | Pulsa **Edit** y elige **`apps/web`** |
   | **Build and Output Settings** | **No los cambies**: el archivo [`apps/web/vercel.json`](../apps/web/vercel.json) ya define la instalación (`npm ci` en la raíz del monorepo) y el build (`npm run build`). |

3. Abre **Environment Variables** y agrega:

   | Variable | Valor |
   |---|---|
   | `API_INTERNAL_URL` | La URL de Render, por ejemplo `https://medicita-api.onrender.com` (sin `/api`) |
   | `JWT_SECRET` | **El mismo** valor que pusiste en Render |
   | `INTERNAL_API_KEY` | **El mismo** valor que pusiste en Render |

4. Pulsa **Deploy** y espera a que diga **Congratulations!**.
5. Si la URL que te dio Vercel **no** es la que pusiste en `WEB_URL` en Render, ve a Render → **Environment**, corrige `WEB_URL` y guarda (Render vuelve a desplegar).

> - **Si cambias una variable en Vercel**, ve a **Deployments** → el último → **⋯** → **Redeploy**. La redirección `/api` se calcula al compilar, así que las variables nuevas no se aplican hasta redesplegar.
> - **Para publicar la rama `Jael`** sin fusionarla a `main`: en Vercel → **Settings** → **Git** → **Production Branch** escribe `Jael`.

---

## 5. Verificar que todo funciona

Abre tu URL de Vercel, por ejemplo `https://medicita-rd.vercel.app`, y recorre esta lista:

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | `https://TU-API.onrender.com/api/health` | `{"status":"ok",…}` |
| 2 | `https://TU-WEB.vercel.app/api/health` (pasa por el proxy) | La misma respuesta. Si falla, revisa `API_INTERNAL_URL` en Vercel. |
| 3 | Iniciar sesión como `paciente@medicita.local` / `Demo12345!` | Entra a **Mis citas** con citas de demo. |
| 4 | Herramientas de desarrollo (F12) → **Application** → **Cookies** | La cookie `medicita_token` aparece con **HttpOnly** y **Secure**. |
| 5 | Como paciente, abrir `/admin/usuarios` | Pantalla **Acceso denegado (403)**. |
| 6 | Iniciar sesión como `centro@medicita.local` → **Inventario** | Tarjetas de bajo stock, próximo a vencer y vencido; registrar una entrada funciona. |
| 7 | Iniciar sesión como `admin@medicita.local` (con la contraseña que pusiste en el paso 2) → **Auditoría** | Aparecen los inicios de sesión y el 403 de la prueba 5, con la IP real. |
| 8 | Agendar una cita como paciente | Se crea `CIT-…` con estado Pendiente. |

Si todo eso funciona, el entorno de prueba está listo.

---

## 6. Problemas comunes

| Síntoma | Causa probable y solución |
|---|---|
| Render: el build falla con `nest: not found` o `prisma: not found` | Al **Build Command** le falta `--include=dev`. Usa exactamente el de la guía. |
| Render: la API se reinicia y el log dice `Faltan variables de entorno: …` | Falta esa variable en **Environment**. |
| Render: `En producción JWT_SECRET no puede usar el valor de ejemplo` | Pegaste el valor de ejemplo. Genera uno nuevo (paso 0) y cámbialo también en Vercel. |
| Render: `En producción falta WEB_URL` | Agrega `WEB_URL` con la URL de Vercel. |
| Render: `P1001: Can't reach database server` | Revisa `DATABASE_URL`: la conexión directa (sin `-pooler`) y `?sslmode=require`. |
| Vercel: el build falla con `Falta API_INTERNAL_URL` | Agrega `API_INTERNAL_URL` en Vercel y vuelve a desplegar. |
| La web abre, pero al iniciar sesión vuelve al login o dice "Tu sesión ya no es válida" | `JWT_SECRET` **no es igual** en Vercel y en Render. Iguálalo y redespliega los dos. |
| La primera carga tarda mucho o da error 504 | Render estaba dormido. Abre `/api/health` de Render, espera la respuesta y recarga. |
| Los "Acceso denegado" de la web no aparecen en la auditoría | `INTERNAL_API_KEY` no es igual en Vercel y en Render. |
| "Correo o contraseña incorrectos." con las cuentas de demo | No corriste el seed contra Neon (paso 2) o lo corriste contra tu base local. Repite el paso 2. |

---

## 7. Actualizar el entorno después

- **Cambios de código:** haz commit y push a la rama publicada. Render y Vercel vuelven a desplegar solos. Las migraciones nuevas se aplican solas al arrancar la API.
- **Refrescar los datos de demo:** repite el paso 2 (solo `db:seed`; `db:migrate` no hace falta si no hay migraciones nuevas).
- **Si un secreto se filtró:** genera uno nuevo, cámbialo en Render **y** en Vercel, y redespliega los dos. Las sesiones abiertas se cierran.

## 8. Seguridad del entorno de prueba

- Es un entorno **público de prueba**: las cuentas de demo (`Demo12345!`) las puede usar cualquiera que tenga la URL. No cargues datos reales de pacientes.
- La contraseña del administrador debe ser distinta a la de demo (paso 2).
- Los secretos solo viven en los paneles de Render y Vercel. En el repositorio solo están [`.env.example`](../.env.example) (local) y [`.env.production.example`](../.env.production.example) (plantilla sin secretos). El `.env` nunca se sube.
- La API se niega a arrancar en producción si `JWT_SECRET` o `INTERNAL_API_KEY` tienen los valores de ejemplo, o si falta `WEB_URL`.
