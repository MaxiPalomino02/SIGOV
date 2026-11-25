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
## Congelado: logica
- RPC, cupos de 5, Realtime, sesion por legajo, rate limit, sirena y voz de la alarma, planilla A4.

## Libre: todo el aspecto

## Sistema de diseno iOS
- Colores (tokens en globals.css, nunca hex sueltos): bg #F2F2F7, surface #FFFFFF, surface-2
#F9F9FB, separator #E5E5EA (0.5px), label #1C1C1E, label-2 #636366 (texto secundario), label-3
#8E8E93 (solo iconos decorativos, NUNCA texto), red #C8102E, red-pressed #A30D25, red-tint
#FDECEF, yellow #FFCC00 (el texto encima siempre #1C1C1E), yellow-tint #FFF6D6, yellow-ink
#7A5B00, green #34C759 solo para OK/operativo (texto sobre green-tint: #1E7B34, green-tint
#E6F7EC).
- Oscuro SOLO en la pantalla de alarma (#0E1116 con rojo #C8102E).
- Uso del color: rojo = accion principal, alertas, no leido. Amarillo = tu turno, en servicio,
destacados. Verde = operativo/OK. Todo lo demas, blanco y grises.
- Tipografia: Inter (next/font) con font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
var(--font-inter), system-ui, sans-serif. Escala: titulo grande 34/700 (tracking -0.4), titulo
22/700, encabezado 17/600, cuerpo 17/400, secundario 15/400, nota 13/400, caption 12/400.
Mayusculas SOLO en encabezados de seccion de lista (13px, tracking .3px, label-2). Numeros y horas
con tabular-nums. Prohibido Oswald, Source Sans 3 e IBM Plex Mono.
- Formas: grupos y tarjetas radio 16px; botones radio 14px y alto 50px; chips pastilla; hojas con
radio 20px arriba y grabber; separadores 0.5px; sin bordes gruesos ni negros; sombra maxima 0 1px
2px rgba(0,0,0,.04).
- Componentes: listas agrupadas (fila minima 44px con icono, titulo, valor y chevron), control
segmentado, switch, hojas (bottom sheet), barra superior translucida (blur 20px, blanco 72%) con
titulo grande que se encoge al scrollear, barra inferior de 5 items en celular (menos de 1024px),
barra lateral de 260px en escritorio (1024px o mas).
- Efectos: al presionar scale .97 y opacity .85 (150ms); transiciones 200ms
cubic-bezier(.2,.8,.2,1); hojas suben con animacion; todo respeta prefers-reduced-motion.
- Iconos: lucide, stroke 1.75, 22px, con aria-label si no llevan texto. Sin emojis.
- Accesibilidad: area tactil minima 44px, contraste AA 4.5:1, foco visible rojo (outline 2px).
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
- Cada prompt de diseno toca solo los archivos que nombra; mostrar diff y esperar OK; nunca ajustar
 colores o pesos "en toda la app" fuera de globals.css.
- El texto de interfaz va en espanol rioplatense (voseo) con tildes y enies correctas, aunque estos
 prompts esten escritos sin tildes.
