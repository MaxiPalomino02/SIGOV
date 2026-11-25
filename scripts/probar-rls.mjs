import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function cargarEnv() {
  let texto;
  try {
    texto = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return;
  }
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const corte = limpia.indexOf("=");
    if (corte < 0) continue;
    const clave = limpia.slice(0, corte).trim();
    let valor = limpia.slice(corte + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

cargarEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local."
  );
  process.exit(1);
}

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const uuid = "00000000-0000-0000-0000-000000000000";
const fecha = "2099-01-01";
const fechaHora = `${fecha}T10:00:00-03:00`;
const franja = "08:00-13:00";

const tablas = [
  ["bomberos", "id", uuid],
  ["turnos", "id", uuid],
  ["configuracion", "clave", "rls-test"],
  ["historial_cambios", "id", uuid],
  ["intentos_login", "id", uuid],
  ["institucion", "id", true],
  ["tareas", "id", uuid],
  ["avisos", "id", uuid],
  ["avisos_lecturas", "aviso_id", uuid],
  ["convocatorias", "aviso_id", uuid],
  ["convocatoria_respuestas", "aviso_id", uuid],
  ["alarmas", "id", uuid],
  ["alarma_respuestas", "alarma_id", uuid],
  ["alertas", "id", uuid],
  ["alertas_fuentes_estado", "fuente", "rls-test"],
  ["alertas_ingesta_log", "id", uuid],
  ["eventos", "id", uuid],
  ["chequeo_plantillas", "id", uuid],
  ["chequeo_items", "id", uuid],
  ["chequeos", "id", uuid],
  ["chequeo_resultados", "chequeo_id", uuid],
  ["equipos", "id", uuid],
  ["equipos_movimientos", "id", uuid],
  ["incidentes", "id", uuid],
  ["documentos", "id", uuid],
  ["prevencion_actividades", "id", uuid],
  ["push_suscripciones", "id", uuid],
  ["push_envios", "referencia", "rls-test"],
];

const vistas = ["prevencion_conteo_mensual"];

const sensibles = [
  ["bomberos", "created_at"],
  ["intentos_login", "*"],
  ["alertas_ingesta_log", "*"],
  ["chequeo_plantillas", "*"],
  ["chequeo_items", "*"],
  ["chequeos", "*"],
  ["chequeo_resultados", "*"],
  ["equipos", "*"],
  ["equipos_movimientos", "*"],
  ["incidentes", "*"],
  ["documentos", "*"],
  ["prevencion_actividades", "*"],
  ["prevencion_conteo_mensual", "*"],
  ["push_suscripciones", "*"],
  ["push_envios", "*"],
];

const publicas = [
  ["bomberos", "id, numero_ingreso, nombre_completo, cargo, activo"],
  ["turnos", "*"],
  ["configuracion", "*"],
  ["historial_cambios", "*"],
  ["institucion", "*"],
  ["tareas", "*"],
  ["avisos", "*"],
  ["avisos_lecturas", "*"],
  ["convocatorias", "*"],
  ["convocatoria_respuestas", "*"],
  ["alarmas", "*"],
  ["alarma_respuestas", "*"],
  ["alertas", "*"],
  ["alertas_fuentes_estado", "*"],
  ["eventos", "*"],
];

const rpc = [
  ["lock_celda", { p_fecha: fecha, p_franja: franja }],
  ["ocupar_celda", { p_fecha: fecha, p_franja: franja, p_bombero_id: uuid }],
  ["anotar_turno", { p_fecha: fecha, p_franja: franja, p_bombero_id: uuid }],
  ["cancelar_turno", { p_turno_id: uuid, p_bombero_id: uuid, p_nota: null }],
  [
    "cambiar_turno",
    { p_turno_anterior_id: uuid, p_fecha: fecha, p_franja: franja, p_bombero_id: uuid },
  ],
  ["generar_turnos_ventana", { p_fecha_inicio: fecha, p_dias: 0 }],
  [
    "crear_bombero",
    { p_numero_ingreso: -1, p_nombre_completo: "Prueba RLS", p_cargo: "Bombero" },
  ],
  ["dar_de_baja_bombero", { p_bombero_id: uuid }],
  ["registrar_intento_login", { p_clave: "rls-test" }],
  ["contar_intentos_login", { p_clave: "rls-test", p_minutos: 10 }],
  ["tarea_franja_actual", { p_ts: fechaHora }],
  ["bombero_de_guardia_ahora", { p_bombero_id: uuid }],
  ["crear_tarea", { p_actor_id: uuid, p_titulo: "Prueba RLS" }],
  ["editar_tarea", { p_actor_id: uuid, p_tarea_id: uuid, p_titulo: "Prueba RLS" }],
  ["borrar_tarea", { p_actor_id: uuid, p_tarea_id: uuid }],
  ["marcar_tarea", { p_actor_id: uuid, p_tarea_id: uuid }],
  ["desmarcar_tarea", { p_actor_id: uuid, p_tarea_id: uuid }],
  [
    "publicar_aviso",
    { p_actor_id: uuid, p_titulo: "Prueba RLS", p_cuerpo: "Prueba", p_tipo: "informativo" },
  ],
  ["fijar_aviso", { p_actor_id: uuid, p_aviso_id: uuid, p_fijado: false }],
  ["borrar_aviso", { p_actor_id: uuid, p_aviso_id: uuid }],
  ["marcar_leido", { p_actor_id: uuid, p_aviso_id: uuid }],
  ["responder_convocatoria", { p_actor_id: uuid, p_aviso_id: uuid, p_respuesta: "voy" }],
  ["cerrar_alarmas_expiradas", {}],
  ["activar_alarma", { p_bombero_id: uuid, p_tipo: "simulacro" }],
  ["cerrar_alarma", { p_bombero_id: uuid, p_alarma_id: uuid }],
  ["responder_alarma", { p_bombero_id: uuid, p_alarma_id: uuid, p_respuesta: "recibido" }],
  ["_alertas_es_oficial", { p_bombero_id: uuid }],
  [
    "upsert_alerta",
    {
      p_tipo_fuente: "meteorologica",
      p_id_externo: "rls-test",
      p_nivel: "amarilla",
      p_fenomeno: "Prueba",
      p_titulo: "Prueba RLS",
      p_descripcion: "Prueba",
      p_area: "Zona",
      p_area_geojson: null,
      p_desde: fechaHora,
      p_hasta: fechaHora,
      p_fuente_nombre: "Prueba",
      p_fuente_url: "",
      p_estado: "vigente",
    },
  ],
  [
    "crear_alerta_manual",
    {
      p_bombero_id: uuid,
      p_tipo_fuente: "institucional",
      p_nivel: "amarilla",
      p_fenomeno: "Prueba",
      p_titulo: "Prueba RLS",
      p_descripcion: "Prueba",
      p_area: "Zona",
      p_desde: fechaHora,
      p_hasta: fechaHora,
      p_fuente_nombre: "Prueba",
      p_fuente_url: "",
    },
  ],
  ["cerrar_alerta", { p_bombero_id: uuid, p_alerta_id: uuid }],
  ["cancelar_alerta", { p_bombero_id: uuid, p_alerta_id: uuid }],
  ["registrar_estado_fuente_alertas", { p_fuente: "Prueba", p_ok: true, p_error: null }],
  ["marcar_alertas_vencidas", {}],
  ["cancelar_alerta_por_id_externo", { p_fuente_nombre: "Prueba", p_id_externo: "rls-test" }],
  [
    "registrar_ingesta_alertas",
    {
      p_fecha_consulta: fechaHora,
      p_items_feed: 0,
      p_cap_nuevos: 0,
      p_detalle: {},
    },
  ],
  ["_eventos_es_oficial", { p_bombero_id: uuid }],
  [
    "crear_evento",
    {
      p_bombero_id: uuid,
      p_titulo: "Prueba RLS",
      p_descripcion: "Prueba",
      p_tipo: "reunion",
      p_inicio: fechaHora,
      p_fin: fechaHora,
      p_lugar: "Cuartel",
    },
  ],
  [
    "editar_evento",
    {
      p_evento_id: uuid,
      p_bombero_id: uuid,
      p_titulo: "Prueba RLS",
      p_descripcion: "Prueba",
      p_tipo: "reunion",
      p_inicio: fechaHora,
      p_fin: fechaHora,
      p_lugar: "Cuartel",
    },
  ],
  ["borrar_evento", { p_evento_id: uuid, p_bombero_id: uuid }],
  ["_chequeo_es_oficial", { p_bombero_id: uuid }],
  ["crear_chequeo_plantilla", { p_bombero_id: uuid, p_nombre: "Prueba RLS", p_tipo: "apertura" }],
  [
    "editar_chequeo_plantilla",
    {
      p_bombero_id: uuid,
      p_plantilla_id: uuid,
      p_nombre: "Prueba RLS",
      p_tipo: "apertura",
      p_activa: true,
    },
  ],
  ["borrar_chequeo_plantilla", { p_bombero_id: uuid, p_plantilla_id: uuid }],
  [
    "crear_chequeo_item",
    { p_bombero_id: uuid, p_plantilla_id: uuid, p_nombre: "Prueba RLS", p_grupo: "", p_orden: 0 },
  ],
  [
    "crear_chequeo_item",
    {
      p_bombero_id: uuid,
      p_plantilla_id: uuid,
      p_nombre: "Prueba RLS",
      p_grupo: "",
      p_orden: 0,
      p_equipo_id: null,
    },
  ],
  [
    "editar_chequeo_item",
    { p_bombero_id: uuid, p_item_id: uuid, p_nombre: "Prueba RLS", p_grupo: "", p_orden: 0 },
  ],
  [
    "editar_chequeo_item",
    {
      p_bombero_id: uuid,
      p_item_id: uuid,
      p_nombre: "Prueba RLS",
      p_grupo: "",
      p_orden: 0,
      p_equipo_id: null,
    },
  ],
  ["borrar_chequeo_item", { p_bombero_id: uuid, p_item_id: uuid }],
  ["reordenar_chequeo_items", { p_bombero_id: uuid, p_plantilla_id: uuid, p_items: [] }],
  ["iniciar_chequeo", { p_bombero_id: uuid, p_plantilla_id: uuid, p_fecha: fecha, p_franja: franja }],
  [
    "guardar_resultado_chequeo",
    {
      p_bombero_id: uuid,
      p_chequeo_id: uuid,
      p_item_id: uuid,
      p_estado: "ok",
      p_nota: "",
      p_foto_path: null,
    },
  ],
  ["finalizar_chequeo", { p_bombero_id: uuid, p_chequeo_id: uuid, p_observaciones: "" }],
  ["obtener_chequeos_fecha", { p_bombero_id: uuid, p_fecha: fecha }],
  ["obtener_chequeo_detalle", { p_bombero_id: uuid, p_chequeo_id: uuid }],
  [
    "firmar_subida_foto_chequeo",
    {
      p_bombero_id: uuid,
      p_chequeo_id: uuid,
      p_item_id: uuid,
      p_content_type: "image/jpeg",
    },
  ],
  ["_equipo_bombero_de_guardia", { p_bombero_id: uuid }],
  [
    "crear_equipo",
    {
      p_bombero_id: uuid,
      p_codigo: "RLS-TEST",
      p_nombre: "Prueba RLS",
      p_categoria: "Prueba",
      p_ubicacion: "",
      p_estado: "operativo",
      p_notas: "",
    },
  ],
  [
    "editar_equipo",
    {
      p_bombero_id: uuid,
      p_equipo_id: uuid,
      p_codigo: "RLS-TEST",
      p_nombre: "Prueba RLS",
      p_categoria: "Prueba",
      p_ubicacion: "",
      p_notas: "",
    },
  ],
  [
    "cambiar_estado_equipo",
    { p_bombero_id: uuid, p_equipo_id: uuid, p_estado: "operativo", p_nota: "" },
  ],
  [
    "guardar_incidente",
    {
      p_bombero_id: uuid,
      p_incidente_id: null,
      p_fecha_hora: fechaHora,
      p_tipo: "otro",
      p_direccion: "Prueba",
      p_descripcion: "Prueba",
      p_unidades: [],
      p_personal: [],
      p_estado: "borrador",
    },
  ],
  [
    "registrar_documento",
    {
      p_bombero_id: uuid,
      p_titulo: "Prueba RLS",
      p_categoria: "protocolos",
      p_descripcion: "Prueba",
      p_archivo_path: "rls-test/archivo.pdf",
      p_tamano: 1,
      p_tipo_mime: "application/pdf",
    },
  ],
  ["borrar_documento", { p_bombero_id: uuid, p_documento_id: uuid }],
  ["registrar_descarga_documento", { p_documento_id: uuid }],
  [
    "registrar_actividad_prevencion",
    {
      p_bombero_id: uuid,
      p_tipo: "charla",
      p_fecha: fecha,
      p_lugar: "Cuartel",
      p_responsable_id: uuid,
      p_participantes: "",
      p_descripcion: "",
      p_fotos: [],
    },
  ],
  ["reportes_obtener", { p_desde: fecha, p_hasta: fecha }],
  [
    "push_guardar_suscripcion",
    { p_bombero_id: uuid, p_endpoint: "push-test", p_p256dh: "x", p_auth: "x" },
  ],
  ["push_borrar_suscripcion", { p_bombero_id: uuid, p_endpoint: null }],
  ["push_obtener_suscripciones", { p_bombero_id: null }],
  ["push_marcar_uso", { p_ids: [uuid] }],
  ["push_tiene_suscripcion", { p_bombero_id: uuid }],
  ["push_registrar_envio", { p_referencia: "rls-test", p_ventana_segundos: 1800 }],
];

let fallas = 0;

function esRechazo(error) {
  if (!error) return false;
  const codigo = String(error.code ?? "");
  const mensaje = String(error.message ?? "").toLowerCase();
  return (
    codigo === "42501" ||
    codigo === "401" ||
    codigo === "403" ||
    codigo === "PGRST301" ||
    codigo === "PGRST203" ||
    mensaje.includes("permission denied") ||
    mensaje.includes("insufficient privilege") ||
    mensaje.includes("row-level security")
  );
}

function detalle(error) {
  if (!error) return "sin error";
  return `${error.code ?? "?"}: ${error.message}`;
}

function informar(etiqueta, ok, mensaje) {
  console.log(`${ok ? "OK  " : "FALLA"} ${etiqueta}${mensaje ? ` · ${mensaje}` : ""}`);
  if (!ok) fallas += 1;
}

for (const [tabla, columna, valor] of tablas) {
  const { error } = await supabase.from(tabla).insert({ [columna]: valor });
  informar(`insert anon en ${tabla}`, Boolean(error) && esRechazo(error), detalle(error));

  const actualizacion = await supabase
    .from(tabla)
    .update({ [columna]: valor })
    .eq(columna, valor);
  informar(
    `update anon en ${tabla}`,
    Boolean(actualizacion.error) && esRechazo(actualizacion.error),
    detalle(actualizacion.error)
  );

  const borrado = await supabase.from(tabla).delete().eq(columna, valor);
  informar(`delete anon en ${tabla}`, Boolean(borrado.error) && esRechazo(borrado.error), detalle(borrado.error));
}

for (const vista of vistas) {
  const lectura = await supabase.from(vista).select("*").limit(1);
  informar(
    `lectura anon en ${vista}`,
    Boolean(lectura.error) && esRechazo(lectura.error),
    detalle(lectura.error)
  );
}

for (const [tabla, columnas] of sensibles) {
  const { data, error } = await supabase.from(tabla).select(columnas).limit(1);
  const filtrado = Boolean(error) && esRechazo(error);
  informar(
    `lectura sensible en ${tabla}`,
    filtrado,
    filtrado ? detalle(error) : `anon leyó ${(data ?? []).length} fila(s)`
  );
}

for (const [tabla, columnas] of publicas) {
  const { error } = await supabase.from(tabla).select(columnas).limit(1);
  informar(`lectura operativa en ${tabla}`, !error, detalle(error));
}

for (const [nombre, argumentos] of rpc) {
  const { error } = await supabase.rpc(nombre, argumentos);
  informar(`rpc ${nombre}`, Boolean(error) && esRechazo(error), detalle(error));
}

if (fallas > 0) {
  console.error(`\n${fallas} verificación(es) fallaron. Revisá la salida y ejecutá la migración 140 si falta.`);
  process.exit(1);
}

console.log("\nRLS correcta: anon no escribe, no ejecuta RPC y no lee datos sensibles.");
