# Migraciones

Archivos numerados (010_, 020_, ...). Los corre el humano, en orden, en el SQL Editor
del proyecto de Supabase. Nunca se ejecutan desde codigo.
Orden base (ya existentes, una sola vez): ../schema.sql, ../rpc.sql, ../seed_dev.sql

- 020_identidad_institucional.sql: legado. La identidad del cuartel ahora vive en
  lib/cuartel.config.ts; la app no depende de esta tabla. No hace falta ejecutarla.
- 130_push.sql: suscripciones Web Push y registro de envíos. Ejecutar después de
  las migraciones base y configurar las variables VAPID antes de usar /notificaciones.
- 140_cierre_rls_permisos.sql: cierra permisos de escritura de anon en el tablero,
  reduce la lectura del padrón a las columnas del login y concede execute a los
  ayudantes internos de alertas y eventos. Ejecutar después de 130.

