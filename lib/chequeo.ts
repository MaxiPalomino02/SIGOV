import { createSupabaseClient, createServiceRoleClient } from "@/lib/supabase";

export type TipoChequeo = "apertura" | "cierre";
export type EstadoChequeo = "en_curso" | "completo";
export type EstadoItem = "ok" | "falta" | "danado";

export const TIPOS_CHEQUEO: TipoChequeo[] = ["apertura", "cierre"];
export const ESTADOS_CHEQUEO: EstadoChequeo[] = ["en_curso", "completo"];
export const ESTADOS_ITEM: EstadoItem[] = ["ok", "falta", "danado"];

export const ETIQUETAS_TIPO: Record<TipoChequeo, string> = {
  apertura: "Apertura",
  cierre: "Cierre",
};

export const ETIQUETAS_ESTADO_CHEQUEO: Record<EstadoChequeo, string> = {
  en_curso: "En curso",
  completo: "Completo",
};

export const ETIQUETAS_ESTADO_ITEM: Record<EstadoItem, string> = {
  ok: "OK",
  falta: "Falta",
  danado: "Dañado",
};

export const COLORES_ESTADO_ITEM: Record<EstadoItem, string> = {
  ok: "text-ok",
  falta: "text-alarm",
  danado: "text-fire-text",
};

export const FONDOS_ESTADO_ITEM: Record<EstadoItem, string> = {
  ok: "bg-ok/10 border-ok/40",
  falta: "bg-alarm/10 border-alarm/40",
  danado: "bg-fire/10 border-fire/40",
};

export type ChequeoPlantilla = {
  id: string;
  nombre: string;
  tipo: TipoChequeo;
  activa: boolean;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
};

export type ChequeoItem = {
  id: string;
  plantilla_id: string;
  orden: number;
  nombre: string;
  grupo: string;
  equipo_id?: string | null;
  equipo?: { id: string; nombre: string; codigo: string; estado: string } | null;
  creado_en: string;
};

export type Chequeo = {
  id: string;
  plantilla_id: string;
  plantilla_nombre?: string;
  plantilla_tipo?: TipoChequeo;
  realizado_por: string;
  bombero_nombre?: string;
  fecha: string;
  franja: string;
  estado: EstadoChequeo;
  observaciones: string;
  creado_en: string;
  actualizado_en: string;
  total_items?: number;
  ok_count?: number;
  fallas_count?: number;
};

export type ChequeoResultado = {
  chequeo_id: string;
  item_id: string;
  estado: EstadoItem;
  nota: string;
  foto_path: string | null;
  actualizado_en: string;
  item_nombre?: string;
  item_grupo?: string;
  item_orden?: number;
};

export type ChequeoCarga = { ok: true; data: Chequeo[] } | { ok: false };
export type PlantillaCarga = { ok: true; data: ChequeoPlantilla[] } | { ok: false };
export type ItemsCarga = { ok: true; data: ChequeoItem[] } | { ok: false };
export type ResultadoCarga = { ok: true; data: ChequeoResultado[] } | { ok: false };
export type DetalleChequeoCarga = { ok: true; data: ChequeoResultado[] } | { ok: false };

function validarPlantilla(row: unknown): row is ChequeoPlantilla {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.nombre === "string" &&
    typeof r.tipo === "string" &&
    TIPOS_CHEQUEO.includes(r.tipo as TipoChequeo) &&
    typeof r.activa === "boolean" &&
    typeof r.creado_por === "string" &&
    typeof r.creado_en === "string" &&
    typeof r.actualizado_en === "string"
  );
}

function validarItem(row: unknown): row is ChequeoItem {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.plantilla_id === "string" &&
    typeof r.orden === "number" &&
    typeof r.nombre === "string" &&
    typeof r.grupo === "string" &&
    typeof r.creado_en === "string"
  );
}

function validarChequeo(row: unknown): row is Chequeo {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.plantilla_id === "string" &&
    typeof r.realizado_por === "string" &&
    typeof r.fecha === "string" &&
    typeof r.franja === "string" &&
    typeof r.estado === "string" &&
    ESTADOS_CHEQUEO.includes(r.estado as EstadoChequeo) &&
    typeof r.creado_en === "string" &&
    typeof r.actualizado_en === "string"
  );
}

function validarResultado(row: unknown): row is ChequeoResultado {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.chequeo_id === "string" &&
    typeof r.item_id === "string" &&
    typeof r.estado === "string" &&
    ESTADOS_ITEM.includes(r.estado as EstadoItem) &&
    typeof r.nota === "string" &&
    (typeof r.foto_path === "string" || r.foto_path === null) &&
    typeof r.actualizado_en === "string"
  );
}

export async function cargarPlantillas(tipo?: TipoChequeo, soloActivas = true): Promise<PlantillaCarga> {
  try {
    const supabase = createSupabaseClient();
    let query = supabase
      .from("chequeo_plantillas")
      .select("*")
      .order("tipo", { ascending: true })
      .order("nombre", { ascending: true });

    if (tipo) query = query.eq("tipo", tipo);
    if (soloActivas) query = query.eq("activa", true);

    const { data, error } = await query;

    if (error) {
      console.error("No se pudieron cargar las plantillas:", error.message);
      return { ok: false };
    }

    const plantillas: ChequeoPlantilla[] = [];
    for (const fila of data ?? []) {
      if (validarPlantilla(fila)) plantillas.push(fila);
    }
    return { ok: true, data: plantillas };
  } catch (error) {
    console.error("Error al consultar plantillas:", error);
    return { ok: false };
  }
}

export async function cargarItems(plantillaId: string): Promise<ItemsCarga> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("chequeo_items")
      .select("*")
      .eq("plantilla_id", plantillaId)
      .order("grupo", { ascending: true })
      .order("orden", { ascending: true });

    if (error) {
      console.error("No se pudieron cargar los items:", error.message);
      return { ok: false };
    }

    const items: ChequeoItem[] = [];
    for (const fila of data ?? []) {
      if (validarItem(fila)) items.push(fila);
    }
    return { ok: true, data: items };
  } catch (error) {
    console.error("Error al consultar items:", error);
    return { ok: false }
  }
}

export async function cargarChequeosFecha(fecha: string): Promise<ChequeoCarga> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("chequeos")
      .select(`
        *,
        plantilla:chequeo_plantillas(nombre, tipo),
        bombero:bomberos(nombre_completo),
        resultados:chequeo_resultados(estado)
      `)
      .eq("fecha", fecha)
      .order("franja", { ascending: true })
      .order("creado_en", { ascending: true });

    if (error) {
      console.error("No se pudieron cargar los chequeos:", error.message);
      return { ok: false };
    }

    const chequeos: Chequeo[] = [];
    for (const fila of data ?? []) {
      if (validarChequeo(fila)) {
        const r = fila as Record<string, unknown>;
        const resultados = (r.resultados as ChequeoResultado[]) ?? [];
        chequeos.push({
          ...fila,
          plantilla_nombre: (r.plantilla as { nombre?: string })?.nombre,
          plantilla_tipo: (r.plantilla as { tipo?: TipoChequeo })?.tipo,
          bombero_nombre: (r.bombero as { nombre_completo?: string })?.nombre_completo,
          total_items: resultados.length,
          ok_count: resultados.filter((x) => x.estado === "ok").length,
          fallas_count: resultados.filter((x) => x.estado === "falta" || x.estado === "danado").length,
        });
      }
    }
    return { ok: true, data: chequeos };
  } catch (error) {
    console.error("Error al consultar chequeos:", error);
    return { ok: false };
  }
}

/**
 * Versión solo-servidor que usa service_role para leer chequeos (datos sensibles).
 * No importar desde componentes cliente.
 */
export async function cargarChequeosFechaServer(fecha: string): Promise<ChequeoCarga> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("chequeos")
      .select(`
        *,
        plantilla:chequeo_plantillas(nombre, tipo),
        bombero:bomberos(nombre_completo),
        resultados:chequeo_resultados(estado)
      `)
      .eq("fecha", fecha)
      .order("franja", { ascending: true })
      .order("creado_en", { ascending: true });

    if (error) {
      console.error("No se pudieron cargar los chequeos:", error.message);
      return { ok: false };
    }

    const chequeos: Chequeo[] = [];
    for (const fila of data ?? []) {
      if (validarChequeo(fila)) {
        const r = fila as Record<string, unknown>;
        const resultados = (r.resultados as ChequeoResultado[]) ?? [];
        chequeos.push({
          ...fila,
          plantilla_nombre: (r.plantilla as { nombre?: string })?.nombre,
          plantilla_tipo: (r.plantilla as { tipo?: TipoChequeo })?.tipo,
          bombero_nombre: (r.bombero as { nombre_completo?: string })?.nombre_completo,
          total_items: resultados.length,
          ok_count: resultados.filter((x) => x.estado === "ok").length,
          fallas_count: resultados.filter((x) => x.estado === "falta" || x.estado === "danado").length,
        });
      }
    }
    return { ok: true, data: chequeos };
  } catch (error) {
    console.error("Error al consultar chequeos:", error);
    return { ok: false };
  }
}

export async function cargarDetalleChequeo(chequeoId: string): Promise<DetalleChequeoCarga> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("chequeo_items")
      .select(`
        *,
        resultado:chequeo_resultados!left(estado, nota, foto_path, actualizado_en)
      `)
      .eq("plantilla_id", (await supabase.from("chequeos").select("plantilla_id").eq("id", chequeoId).single()).data?.plantilla_id ?? "")
      .order("grupo", { ascending: true })
      .order("orden", { ascending: true });

    if (error) {
      console.error("No se pudo cargar el detalle:", error.message);
      return { ok: false };
    }

    const resultados: ChequeoResultado[] = [];
    for (const fila of data ?? []) {
      if (validarItem(fila)) {
        const r = fila as Record<string, unknown>;
        const res = r.resultado as ChequeoResultado | null;
        resultados.push({
          chequeo_id: chequeoId,
          item_id: fila.id,
          estado: res?.estado ?? "ok",
          nota: res?.nota ?? "",
          foto_path: res?.foto_path ?? null,
          actualizado_en: res?.actualizado_en ?? new Date().toISOString(),
          item_nombre: fila.nombre,
          item_grupo: fila.grupo,
          item_orden: fila.orden,
        });
      }
    }
    return { ok: true, data: resultados };
  } catch (error) {
    console.error("Error al consultar detalle:", error);
    return { ok: false };
  }
}

export async function cargarChequeoEnCurso(bomberoId: string, plantillaId: string, fecha: string, franja: string): Promise<{ ok: true; data: Chequeo | null } | { ok: false }> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("chequeos")
      .select("*")
      .eq("realizado_por", bomberoId)
      .eq("plantilla_id", plantillaId)
      .eq("fecha", fecha)
      .eq("franja", franja)
      .eq("estado", "en_curso")
      .maybeSingle();

    if (error) {
      console.error("No se pudo buscar chequeo en curso:", error.message);
      return { ok: false };
    }

    if (!data) return { ok: true, data: null };
    if (validarChequeo(data)) return { ok: true, data };
    return { ok: true, data: null };
  } catch (error) {
    console.error("Error al buscar chequeo en curso:", error);
    return { ok: false };
  }
}

export async function cargarResultadosChequeo(chequeoId: string): Promise<ResultadoCarga> {
  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from("chequeo_resultados")
      .select("*")
      .eq("chequeo_id", chequeoId);

    if (error) {
      console.error("No se pudieron cargar resultados:", error.message);
      return { ok: false };
    }

    const resultados: ChequeoResultado[] = [];
    for (const fila of data ?? []) {
      if (validarResultado(fila)) resultados.push(fila);
    }
    return { ok: true, data: resultados };
  } catch (error) {
    console.error("Error al consultar resultados:", error);
    return { ok: false };
  }
}

export function formatearFranja(franja: string): string {
  const [desde, hasta] = franja.split("-");
  return `de ${desde} a ${hasta}hs`;
}

export function obtenerIconoEstado(estado: EstadoItem): string {
  switch (estado) {
    case "ok": return "CheckCircle2";
    case "falta": return "AlertCircle";
    case "danado": return "Wrench";
  }
}

export function agruparItemsPorGrupo(items: ChequeoItem[]): Map<string, ChequeoItem[]> {
  const grupos = new Map<string, ChequeoItem[]>();
  for (const item of items) {
    const grupo = item.grupo || "General";
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo)!.push(item);
  }
  return grupos;
}