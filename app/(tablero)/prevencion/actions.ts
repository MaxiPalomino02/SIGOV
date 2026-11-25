"use server";

import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";
import {
  esFechaActividad,
  esFotoActividad,
  esTipoActividad,
  esUUID,
  MAX_FOTOS_PREVENCION,
  normalizarActividad,
  type ActividadPrevencion,
  type RegistrarActividadInput,
} from "@/lib/prevencion";

export type ResultadoActividades =
  | { ok: true; data: ActividadPrevencion[] }
  | { ok: false; error: string };

export type ResultadoRegistro =
  | { ok: true; data: string }
  | { ok: false; error: string };

export type BomberoOption = { id: string; nombre: string };

export type ResultadoBomberos =
  | { ok: true; data: BomberoOption[] }
  | { ok: false; error: string };

function mapError(
  error: { code?: string; message?: string },
  fallback: string
): string {
  if (error.code !== "P0001") return fallback;
  const mensajes: Record<string, string> = {
    BOMBERO_INACTIVO: "Tu usuario no está activo.",
    TIPO_INVALIDO: "Elegí un tipo de actividad válido.",
    FECHA_REQUERIDA: "Ingresá la fecha de la actividad.",
    LUGAR_INVALIDO: "Ingresá el lugar de la actividad.",
    RESPONSABLE_INVALIDO: "El responsable no es válido.",
    PARTICIPANTES_LARGOS: "Los participantes son demasiados.",
    DESCRIPCION_LARGA: "La descripción es demasiado larga.",
    FOTOS_INVALIDAS: "Las fotos no son válidas.",
  };
  return mensajes[error.message ?? ""] ?? fallback;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export async function obtenerActividades(): Promise<ResultadoActividades> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };

  try {
    const supabase = createServiceRoleClient();
    const [actividadesResult, bomberosResult] = await Promise.all([
      supabase
        .from("prevencion_actividades")
        .select("*")
        .order("fecha", { ascending: false })
        .limit(300),
      supabase.from("bomberos").select("id, nombre_completo").limit(500),
    ]);

    if (actividadesResult.error) {
      console.error(
        "Error al cargar actividades de prevención:",
        actividadesResult.error.message
      );
      return {
        ok: false,
        error:
          "No se pudieron cargar las actividades. Revisá que la migración de prevención esté aplicada.",
      };
    }

    const nombres = new Map<string, string>();
    if (!bomberosResult.error) {
      for (const fila of bomberosResult.data ?? []) {
        if (
          typeof fila.id === "string" &&
          typeof fila.nombre_completo === "string"
        ) {
          nombres.set(fila.id, fila.nombre_completo);
        }
      }
    }

    const actividades: ActividadPrevencion[] = [];
    for (const fila of actividadesResult.data ?? []) {
      const registro = fila as Record<string, unknown>;
      const actividad = normalizarActividad({
        ...registro,
        responsable_nombre:
          typeof registro.responsable_id === "string"
            ? nombres.get(registro.responsable_id)
            : undefined,
        creador_nombre:
          typeof registro.creado_por === "string"
            ? nombres.get(registro.creado_por)
            : undefined,
      });
      if (actividad) actividades.push(actividad);
    }

    return { ok: true, data: actividades };
  } catch (err) {
    console.error("Error inesperado al cargar prevención:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function obtenerActividadesIniciales(): Promise<{
  actividades: ActividadPrevencion[];
  error: string | null;
}> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");

  const resultado = await obtenerActividades();
  if (!resultado.ok) return { actividades: [], error: resultado.error };
  return { actividades: resultado.data, error: null };
}

export async function obtenerBomberosActivos(): Promise<ResultadoBomberos> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("bomberos")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo", { ascending: true })
      .limit(500);

    if (error) {
      console.error("Error al cargar el padrón para prevención:", error.message);
      return { ok: false, error: "No se pudo cargar el padrón." };
    }

    const dataFinal: BomberoOption[] = [];
    for (const fila of data ?? []) {
      if (
        typeof fila.id === "string" &&
        esUUID(fila.id) &&
        typeof fila.nombre_completo === "string" &&
        fila.nombre_completo.trim()
      ) {
        dataFinal.push({ id: fila.id, nombre: fila.nombre_completo.trim() });
      }
    }
    return { ok: true, data: dataFinal };
  } catch (err) {
    console.error("Error inesperado al cargar el padrón:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function registrarActividadAction(
  input: RegistrarActividadInput
): Promise<ResultadoRegistro> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };

  if (!esTipoActividad(input?.tipo)) {
    return { ok: false, error: "Elegí un tipo de actividad válido." };
  }
  if (!esFechaActividad(input?.fecha)) {
    return { ok: false, error: "Ingresá una fecha válida." };
  }

  const lugar = texto(input?.lugar);
  if (!lugar || lugar.length > 200) {
    return { ok: false, error: "Ingresá el lugar de la actividad." };
  }

  if (input?.responsable_id !== null && !esUUID(input?.responsable_id)) {
    return { ok: false, error: "El responsable no es válido." };
  }

  const participantes = texto(input?.participantes);
  if (participantes.length > 1000) {
    return { ok: false, error: "Los participantes son demasiados." };
  }

  const descripcion = texto(input?.descripcion);
  if (descripcion.length > 2000) {
    return { ok: false, error: "La descripción es demasiado larga." };
  }

  const fotosRaw = Array.isArray(input?.fotos) ? input.fotos : [];
  if (fotosRaw.length > MAX_FOTOS_PREVENCION) {
    return { ok: false, error: "Se pueden cargar hasta 6 fotos." };
  }
  if (!fotosRaw.every(esFotoActividad)) {
    return { ok: false, error: "Las fotos no son válidas." };
  }
  const fotos = fotosRaw.map((foto) => foto.trim());

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc(
      "registrar_actividad_prevencion",
      {
        p_bombero_id: session.bombero_id,
        p_tipo: input.tipo,
        p_fecha: input.fecha,
        p_lugar: lugar,
        p_responsable_id: input.responsable_id,
        p_participantes: participantes,
        p_descripcion: descripcion,
        p_fotos: fotos,
      }
    );

    if (error) {
      console.error("Error al registrar actividad de prevención:", error.message);
      return {
        ok: false,
        error: mapError(error, "No se pudo guardar la actividad."),
      };
    }

    if (!esUUID(data)) {
      return { ok: false, error: "No se pudo guardar la actividad." };
    }

    return { ok: true, data };
  } catch (err) {
    console.error("Error inesperado al registrar prevención:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}
