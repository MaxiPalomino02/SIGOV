# SIGOV

SIGOV (Sistema Integral de Gestión Operativa de Bomberos Voluntarios) es la plataforma operativa para cuarteles de bomberos voluntarios. Los datos del cuartel se leen siempre de `lib/cuartel.config.ts`; la interfaz no incluye ese texto fijo.

Los bomberos se anotan por número de ingreso, el tablero muestra **siempre dos semanas calendario** (la semana actual + la siguiente), hay historial de movimientos con Realtime y un panel de administración para oficiales.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, React 19, TypeScript, Tailwind CSS v4)
- [Supabase](https://supabase.com) (Postgres + RLS + Realtime)
- [Vercel](https://vercel.com) (hosting + Cron Jobs)

## Variables de entorno

Todas están documentadas en `.env.example` y `.env.local.example`. Copialo a `.env.local` para desarrollo
y configurá las mismas variables en Vercel para producción.

| Variable                        | Secreta | Dónde se obtiene                                                                 |
| ------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | No      | Supabase → Settings → API → **Project URL**                                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No      | Supabase → Settings → API → **anon / public key**                                |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Sí**  | Supabase → Settings → API → **service_role secret**                              |
| `SESSION_SECRET`                | **Sí**  | Generala vos (mínimo 32 caracteres). Firma el JWT de la cookie de sesión         |
| `CRON_SECRET`                   | **Sí**  | Generala vos (mínimo 16 caracteres). Protege el endpoint del cron                 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`  | No      | Generala con `npx web-push generate-vapid-keys`                                   |
| `VAPID_PUBLIC_KEY`              | No      | Alias compatible; usala si todavía no configuraste `NEXT_PUBLIC_VAPID_PUBLIC_KEY` |
| `VAPID_PRIVATE_KEY`             | **Sí**  | Generala con `npx web-push generate-vapid-keys`                                   |
| `VAPID_SUBJECT`                 | **Sí**  | URL `https` o `mailto:` del responsable de las notificaciones                     |

> Atención: `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `CRON_SECRET` y `VAPID_PRIVATE_KEY` solo se usan en el servidor.
> **Nunca** deben exponerse al navegador. `SUPABASE_SERVICE_ROLE_KEY` debe empezar con
> `sb_secret_` (si empieza con `sb_publishable_` es la anon key, no sirve aquí).

Para generar los dos secretos:

```bash
# SESSION_SECRET (base64, 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# CRON_SECRET (hex, 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 1. Crear el proyecto en Supabase

1. Entrá a https://supabase.com → **New project**.
2. Nombre, contraseña de la base y elegí la región más cercana a Tucumán
   (recomendado: **South America (São Paulo)** = `sa-east-1`).
3. En el dashboard, andá a **SQL Editor** (menú izquierdo).
4. Ejecutá los scripts **en este orden** en el SQL Editor (todos son seguros de re-ejecutar):
   - `supabase/schema.sql`: tablas, índices, RLS y datos base.
   - `supabase/rpc.sql`: funciones de turnos y publicación en Realtime.
   - Una sola seed: `supabase/seed.sql` para el padrón real, o `supabase/seed_dev.sql` /
     `supabase/seed_demo.sql` para datos ficticios de prueba.
   - `supabase/migracion_cupo_5.sql` solo en bases viejas.
   - Migraciones numeradas en orden: `010`, `021`, `030`, `040`, `050`, `051`, `060`,
     `070`, `071`, `072`, `080`, `090`, `100`, `110`, `120`, `130`, `140`. La `020`
     es legada. Detalle en `supabase/migrations/README.md`.

   `140_cierre_rls_permisos.sql` es obligatoria: limita el padrón de login a las columnas
   necesarias y quita a `anon` permisos de escritura en el tablero. Las migraciones las
   corre el humano; nunca se ejecutan desde código. No editar `schema.sql` ni `rpc.sql`.
5. Andá a **Settings → API** y copiá los tres valores:
   - `Project URL`
   - `anon public key`
   - `service_role secret`

## 2. Cargar los primeros bomberos

Necesitás cargar el padrón antes de que alguien pueda entrar. Dos opciones:

**Opción A — Script de seed (recomendado para la primera carga):**

Abrí `supabase/seed.sql`, reemplazá los nombres de ejemplo por los reales y ejecutalo en
el SQL Editor. Para probar sin datos reales usá `supabase/seed_demo.sql`: carga legajos
`901` a `906`, guardias, tareas, avisos, eventos, un chequeo, un incidente y una alarma
cerrada, todos ficticios. **Debe existir al menos un bombero con cargo
`Oficial Principal`** para acceder al panel `/admin`.

**Opción B — Panel de administración:**

Una vez desplegado, entrá con un bombero que tenga cargo `Oficial Principal` y usá
**Administración** en la barra de navegación para dar de alta al resto.

> Sin al menos un `Oficial Principal` cargado, nadie puede llegar al panel de admin
> (el login valida contra `bomberos` y `/admin` solo admite oficiales). Por eso en la
> primera carga conviene usar el seed.

## 3. Conectar el repo de GitHub a Vercel

Si todavía no existe un repo, inicializalo:

```bash
git init
git add .
git commit -m "Inicial"
git branch -M main
git remote add origin https://github.com/<TU_USUARIO>/<NOMBRE_REPO>.git
git push -u origin main
```

Después:

1. Entrá a https://vercel.com → **Add New → Project**.
2. Elegí **Import** sobre tu repositorio de GitHub (Vercel te pide autorizar la cuenta).
3. Vercel detecta **Next.js** solo (framework y preset automáticos). No cambies nada.
4. Antes de **Deploy**, expandí **Environment Variables** y agregá las ocho variables de
   la tabla de arriba (marca **Production**).
5. Hacé clic en **Deploy**. Cada `git push` a `main` redeploya automáticamente.

## 4. Configurar el CRON_SECRET

El cron es el que garantiza que el tablero siempre tenga las dos semanas de celdas
generadas. Está definido en `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/generar-turnos", "schedule": "5 3 * * *" },
    { "path": "/api/cron/alertas", "schedule": "20 3 * * *" }
  ]
}
```

- El horario está en **UTC**: `5 3 * * *` = 03:05 UTC = **00:05 hora Argentina** (UTC-3).
  Argentina no usa horario de verano, así que siempre es 00:05.
- **Los cron jobs solo corren en deployments de producción** (no en previews ni en local).
- En el plan **Hobby** de Vercel, los crons se ejecutan una vez por día.
- Para que Vercel envíe el `CRON_SECRET` como `Authorization: Bearer <CRON_SECRET>`,
  activá **Settings → Cron Jobs → Protect cron jobs** en el proyecto de Vercel. Si queda
  desactivado, el endpoint responde 401 (por diseño).

Para verificar el cron manualmente después del deploy:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<TU_PROYECTO>.vercel.app/api/cron/generar-turnos
```

Respuesta esperada (primera vez): `{"ok":true,"fecha_inicio":"YYYY-MM-DD","dias":14,"turnos_creados":56}`.
En corridas siguientes `turnos_creados` baja a `0` o menos porque las celdas ya existen.

El segundo cron sincroniza alertas SMN a las 00:20 hora Argentina y también exige el
header `Authorization: Bearer <CRON_SECRET>`. Activa **Protect cron jobs** en Vercel para
que lo envíe; sin eso responde 401.

---

## Puesta en marcha local

```bash
npm install
copy .env.local.example .env.local   # y completá los valores
npm run dev
```

Abrí http://localhost:3000.

## Comandos útiles

```bash
npm run dev     # servidor de desarrollo
npm run lint    # eslint
npm run build   # build de producción
npm run start   # sirve el build de producción (local)
```

## Uso

- **Login:** con el número de ingreso (sin contraseña). En la pantalla de login se
  muestra el padrón para quienes no recuerden su número.
- **Tablero (`/`):** dos semanas calendario; los días pasados de la semana actual se
  ven atenuados (no se puede anotar en el pasado). Una persona por turno; el único
  conflicto posible (dos pedidos a la vez sobre la misma celda) lo resuelve la base.
- **Historial (`/historial`):** log de anotaciones, cancelaciones y cambios, con
  Realtime.
- **Administración (`/admin`):** alta y baja de bomberos. Solo `Oficial Principal` y
  `Oficial Ayudante`.

## Seguridad

- El login sigue siendo solo con número de legajo (sin contraseña ni PIN).
- Los intentos fallidos se limitan a **5 cada 10 minutos** por IP y por legajo.
- Los cambios de cargo y las bajas se aplican **de inmediato**: en la siguiente acción
  del bombero se revalidan su cargo y su estado contra la base, no contra la cookie.
- Las funciones RPC solo las puede ejecutar `service_role`; `anon` y `authenticated`
  reciben `permission denied`.
- La migración `140_cierre_rls_permisos.sql` quita a `anon` los permisos de escritura que
  venían por defecto en `bomberos`, `turnos`, `configuracion` e `historial_cambios`, y
  limita la lectura del padrón a `id`, `numero_ingreso`, `nombre_completo`, `cargo` y
  `activo`, que es lo que necesita el login.

## Verificación

```bash
node scripts/probar-rpc-anon.mjs
node scripts/probar-rls.mjs
npm run lint
npm run build
```

`probar-rpc-anon.mjs` comprueba que ninguna RPC se ejecute con la anon key.
`probar-rls.mjs` comprueba que `anon` no escriba en tablas, no ejecute RPC y no lea tablas
sensibles; sí debe poder leer tareas, avisos, eventos, alarmas, alertas y turnos. Si
falla, ejecutá la migración `140` y volvé a correrlo. La checklist completa está en
`docs/checklist-despliegue.md`.

## PWA y notificaciones

- El service worker vive en `app/sw.ts` y se registra con Serwist. La app es instalable y
  tiene pantalla offline en `/offline`.
- Las suscripciones push se gestionan en `/notificaciones`. El acceso está en *Accesos
  rápidos* de `/inicio`.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` se entrega al navegador; `VAPID_PRIVATE_KEY` y
  `VAPID_SUBJECT` quedan solo en el servidor. `VAPID_PUBLIC_KEY` sigue siendo un alias
  compatible. Sin VAPID, la pantalla informa que el servicio no está configurado.
- Las alarmas usan prioridad alta y sonido; las alertas SMN naranjas y rojas se deduplican
  durante 30 minutos. Una alarma envía una sola tanda de notificaciones y guarda solo el
  total en `alarmas.cantidad_enviados`. Nada reemplaza la sirena ni la radio.
- La prueba manual en `localhost` requiere `npm run build && npm start` porque el service
  worker se desregistra en `npm run dev` para no cachear el login.

## Marca y accesibilidad

- Los datos del cuartel salen de `lib/cuartel.config.ts`; no se escriben a mano en
  componentes, metadata, impresiones ni mensajes.
- Los logos salen de `public/brand/` y se usan con sus proporciones originales. Si falta
  un archivo, la interfaz muestra el texto `SIGOV`.
- La interfaz usa tokens de `app/globals.css`: tema oscuro, texto grande, foco visible,
  áreas táctiles de al menos 44 px y `prefers-reduced-motion`.
- Los estados llevan texto, icono y color; nunca solo color. Las planillas A4 se imprimen
  en blanco y negro.
- Objetivo de Lighthouse: 90 o más en Performance, Accesibilidad y PWA en `/inicio`,
  `/guardias` y `/tareas`.

## Limitaciones

- Login solo por legajo, sin contraseña ni PIN. El padrón de la pantalla de login es
  referencia; los cambios de cargo y bajas se revalidan contra la base.
- Con la app cerrada o el celular bloqueado, el sonido depende del sistema operativo; en
  modo silencio no suena. En iPhone hace falta instalar la app desde la pantalla de inicio.
- Los crons corren solo en Production y requieren **Protect cron jobs** en Vercel.
- Ninguna migración se ejecuta desde código. Siempre las corre el humano en el SQL Editor.
