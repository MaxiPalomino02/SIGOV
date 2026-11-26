# Checklist de despliegue

## 1. Preparación

- Repo clonado, `npm install` ejecutado y `.env.local.example` copiado a `.env.local`.
- Proyecto Supabase creado; no imprimir ni copiar `.env.local`.

## 2. Variables

| Variable | Secreta | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | No | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | Lecturas y Realtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | Escrituras del servidor |
| `SESSION_SECRET` | Sí | Firma de la cookie |
| `CRON_SECRET` | Sí | Protección de crons |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Permiso push |
| `VAPID_PUBLIC_KEY` | No | Alias compatible |
| `VAPID_PRIVATE_KEY` | Sí | Firma push |
| `VAPID_SUBJECT` | Sí | `https://` o `mailto:` |

Generar secretos con `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`, `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y `npx web-push generate-vapid-keys`. `SUPABASE_SERVICE_ROLE_KEY` debe empezar con `sb_secret_`.

## 3. SQL Editor

Ejecutar en orden: `schema.sql`, `rpc.sql`, una seed (`seed.sql` real, `seed_dev.sql` o `seed_demo.sql` ficticia), `migracion_cupo_5.sql` solo en bases viejas, y migraciones `010`, `021`, `030`, `040`, `050`, `051`, `060`, `070`, `071`, `072`, `080`, `090`, `100`, `110`, `120`, `130`, `140`, `150`. `020` es legada. Las corre el humano; nunca desde código. No editar `schema.sql` ni `rpc.sql`.

La migración `140_cierre_rls_permisos.sql` deja el padrón de login accesible solo en las columnas necesarias y quita a `anon` permisos de escritura en el tablero. Es obligatoria para pasar la verificación.

## 4. Verificación

```bash
node scripts/probar-rpc-anon.mjs
node scripts/probar-rls.mjs
```

Esperado: toda RPC responde `permission denied`; `anon` no inserta, actualiza, borra ni lee sensibles, pero sí lee tablas operativas. Si falla `bomberos` o escritura en `turnos`, `configuracion` o `historial_cambios`, ejecutar la migración `140` y repetir.

## 5. Marca

Reemplazar si hace falta `public/brand/LOGO SIGOV.jpg` y `public/brand/cuartel-escudo.jpg`. Usar proporciones originales; no deformar ni recolorear. Si cambiás el nombre del archivo, actualizar `lib/marca.ts` y `lib/cuartel.config.ts`. Los datos del cuartel salen de `lib/cuartel.config.ts`.

## 6. Vercel

Importar el repo, cargar las ocho variables en Production y deployar. Verificar `/manifest.webmanifest` y `/serwist/sw.js`. Activar `Settings → Cron Jobs → Protect cron jobs`; `vercel.json` ya define los crons de turnos y alertas. Sin ese ajuste responden 401.

## 7. Prueba manual

1. Entrar con un legajo de la seed y confirmar que carga `/inicio` sin datos inventados.
2. Anotarse en una guardia, cancelarla y revisar `/historial`.
3. Activar notificaciones en `/notificaciones`, probar con *Probar notificación* (solo oficiales), cerrar la app y confirmar el aviso push; después verificar una alarma simulada y la planilla A4 en blanco y negro.

## 8. Límites

- Push depende del sistema operativo: con app cerrada o pantalla bloqueada no suena en modo silencio; en iPhone requiere app instalada desde pantalla de inicio.
- Los crons corren solo en Production; en Hobby una vez por día cada uno.
- `service_role` y VAPID privado solo servidor.
- Sin migración `140`, RLS no cumple. Sin VAPID, `/notificaciones` informa que el servicio no está configurado.
