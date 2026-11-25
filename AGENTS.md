# SIGOV - Sistema Integral de Gestion Operativa de Bomberos Voluntarios
SIGOV es una plataforma general para cuarteles de bomberos voluntarios. La primera instalacion es
Bomberos Voluntarios La Trinidad, Tucuman. Es un complemento de RUBA, no un reemplazo. Usuarios: bomberos,
muchos mayores y con poca tecnologia. Priorizar claridad, letra grande y pocos pasos.
## Stack
Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Supabase (Postgres, RLS, Realtime,
Storage), Vercel. Antes de usar una API de Next, leer node_modules/next/dist/docs (esta version tiene
cambios).
## Identidad y marca
- Producto: SIGOV. Nombre completo: Sistema Integral de Gestion Operativa de Bomberos Voluntarios.
- El cuartel que usa la instalacion (nombre, localidad, provincia, escudo, numero, coordenadas) sale
 SIEMPRE de lib/cuartel.config.ts. Prohibido escribir "La Trinidad" o "Bomberos Voluntarios La Trinidad"
 a mano en componentes, paginas, metadata, textos de impresion o mensajes.
- Los logos salen de lib/marca.ts (rutas dentro de public/brand/). El logo oficial de SIGOV lo entrega el
 usuario: usarlo con sus proporciones originales, sin deformar, recortar, recolorear ni recrear. No
 inventar logos. El escudo del cuartel y otros logos institucionales son complementarios y no compiten
 con el de SIGOV.
- Jerarquia: SIGOV es el sistema; el cuartel es quien lo usa. Nunca llamar al producto "Sistema de
 Bomberos La Trinidad".
- Referencia de interfaz: consolas de despacho (MAGNER) solo como referencia de jerarquia operativa. No
 copiar su marca, sus textos ni su interfaz.
## ZONA CONGELADA
- LOGICA congelada: app/(tablero)/guardias/*, historial/*, admin/*, app/login/actions.ts, lib/tablero.ts,
 lib/historial.ts, lib/cargos.ts, lib/auth.ts, lib/session.ts, lib/session-db.ts. Cupos, cambios y
 cancelaciones, Realtime, impresion/planilla A4, sesion y rate limit no se tocan. supabase/schema.sql y
 rpc.sql no se editan: todo cambio va en una migracion nueva.
- ASPECTO descongelado SOLO durante el rediseno: components/header.tsx, components/app-nav.tsx,
 app/(tablero)/guardias/tablero.tsx, app/(tablero)/inicio/*. Conservan rutas, permisos, datos y
 comportamiento; solo cambia la presentacion.
- app/login/* sigue congelado por completo (logica y aspecto).
- app/globals.css: solo se agrega al final (sin tocar lo existente).
- components/ui/*: se pueden agregar componentes y variantes; no cambiar las clases existentes salvo
 autorizacion expresa de un prompt.
- Autenticacion: login solo por legajo, con las mismas validaciones, rate limit y mensajes.
## Lenguaje visual SIGOV (vive en tokens, nunca en colores fijos)
- Tema claro por defecto en toda la app: fondo #f2f5f3, superficie/tarjetas #ffffff, texto #141a18,
 rojo #c8102e, laton #96702e, ambar #c2690b, verde solo para OK. Oscuro (#101317) solo en /login y
 /alarma, nunca en el resto.
- El rojo se reserva para boton Alarma, boton principal, iconos de accion, no leido y alertas. No se usa
 como decoracion.
- No quitar efectos, franjas, animaciones, iconos ni resaltados existentes salvo pedido explicito.
- Tipografia: Oswald para el logo, titulos de pagina y titulos de tarjeta (mayusculas, tracking 0.08em,
 peso 600); IBM Plex Mono para etiquetas chicas en mayusculas, horas, fechas y legajos; Source Sans 3
 para el resto, en minuscula o tipo oracion, peso 400 o 500, sin tracking.
- Numeros grandes: Oswald con tabular-nums, nunca IBM Plex Mono. Escala fija: titulo de pagina 28px,
 titulo de tarjeta 18px, texto 16px, auxiliar 13px. Solo un numero clave por pantalla puede ser mas
 grande.
- Tarjetas: fondo blanco, radio 12px, sombra suave (0 1px 3px rgba(20,26,24,.06)), franja superior roja
 por defecto (laton o ambar solo si el contexto lo pide).
- Header: logo SIGOV sin deformar, nombre del cuartel desde lib/cuartel.config.ts en Oswald, ubicacion
 en mono, badge Operativo en verde, nombre/cargo/legajo visibles junto al menu de usuario y Salir. El
 boton Alarma aparece solo para oficiales.
- Nav: 5 items (Inicio, Guardias, Tareas, Avisos, Mas). Pestana activa con fondo fire-light y subrayado
 rojo; etiquetas en IBM Plex Mono mayusculas.
- Inicio: titulo "INICIO" en Oswald, banner ambar "Operativo en servicio ahora", Tu turno con estilo
 laton, indicadores Tareas/Avisos/De guardia con numero en Oswald, 4 accesos rapidos, linea de huecos
 solo oficiales. Avisos y eventos solo si hay datos; altura por contenido.
- Guardias: no cambiar el aspecto. La ayuda va en un icono "?" que abre una explicacion corta; celdas
 vacias con boton "+ ANOTARME" outlines rojo, fondo blanco y relleno rojo en hover/touch; cada franja
 muestra la hora una sola vez.
- Sin paneles vacios: si no hay datos (alertas, tareas, avisos), no se renderiza nada o una sola linea de
 texto.
- No repetir datos: el nombre, cargo y legajo viven solo en el menu de usuario del header.
- Diseno mobile first. Impresion (planillas A4 y PDF): siempre clara, en blanco y negro.
## Reglas de arquitectura (no romper)
1. Login solo con numero de legajo. Sin contrasenas ni PIN. Sesion en cookie JWT (lib/session.ts,
 cookie guardia_bomberos_session).
2. Roles por cargo (lib/cargos.ts): oficial = isOficial(). Toda accion de admin u oficial usa
 getSessionActiva() (lib/session-db.ts), que revalida cargo y baja contra la base. Nunca confiar en el
 cargo de la cookie.
3. Toda ESCRITURA va por funciones SQL SECURITY DEFINER con set search_path = public, llamadas desde
 server actions con service_role. Cada funcion nueva termina con: revoke all ... from public, anon,
 authenticated; grant execute ... to service_role.
4. LECTURAS: datos no sensibles (tareas, avisos, eventos, alarmas, alertas SMN, turnos) se leen con la
 anon key bajo RLS (policy select para anon y authenticated) y pueden usar Realtime. Datos SENSIBLES
 (incidentes, chequeos con fotos, personal, reportes, biblioteca) NO tienen policy para anon: se leen
 en server components con service_role despues de validar la sesion. Toda tabla nueva: enable row
 level security.
5. Zona horaria America/Argentina/Tucuman. Usar los helpers de lib/tablero.ts (hoyArgentina,
 franjaActual, formatFechaKey, etc.).
6. Server actions: validan entrada (tipos, UUID, largos, fechas) y devuelven { ok: true } o { ok:
 false, error } con mensajes en espanol rioplatense (voseo).
7. Texto de interfaz en espanol (voseo), SIEMPRE con tildes y enies correctas (estos prompts estan
 escritos sin tildes solo para pegarlos sin problemas de codificacion). Sin emojis.
8. Migraciones en supabase/migrations/NNN_nombre.sql, numeradas, idempotentes (if not exists / create
 or replace). Las corre el humano en el SQL Editor. Nunca ejecutarlas desde codigo ni con scripts.
 Cada tabla nueva con datos en vivo se agrega a la publicacion supabase_realtime.
9. Las claves (.env.local) nunca se imprimen, loguean ni copian a otros archivos.
10. Cada pantalla tiene estados de carga, error y vacio honestos. Nunca inventar datos, alertas, niveles,
 cupos, personal ni estados.
11. No hardcodear colores (#hex, bg-white, text-black, etc.) en componentes nuevos: usar tokens.
12. Todo cambio debe poder volver atras: la version anterior del codigo tiene que seguir funcionando con
 las tablas nuevas.
13. Ningun texto instructivo permanente en pantallas; la ayuda va en un icono "?" que abre una explicacion
 corta.
## Flujo de trabajo
Antes de tocar codigo: leer los archivos relacionados, explicar el plan en 5 lineas y recien despues
implementar. Cambios chicos que compilen (npm run build sin errores). Si algo es ambiguo, elegir el
default mas simple y decirlo al final. Si algo contradice este archivo, gana este archivo. Al terminar:
listar archivos tocados, la migracion a correr y 3 pasos para probar a mano.
