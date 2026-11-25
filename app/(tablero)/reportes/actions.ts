"use server";

import { isOficial } from "@/lib/cargos";
import {
  normalizarConteo,
  type ConteoMensualPrevencion,
} from "@/lib/prevencion";
import {
  normalizarReporte,
  validarRango,
  type Reporte,
} from "@/lib/reportes";
import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";

export type ResultadoReporte =
  | { ok: true; data: Reporte }
  | { ok: false; error: string };

export type ResultadoConteoPrevencion =
  | { ok: true; data: ConteoMensualPrevencion[] }
  | { ok: false; error: string };

async function verificarAcceso(): Promise<string | null> {
  const session = await getSessionActiva();
  if (!session) return "Sesión no válida o expirada.";
  if (!isOficial(session.cargo)) {
    return "Esta sección es solo para oficiales.";
  }
  return null;
}

export async function obtenerReporte(
  desde: string,
  hasta: string
): Promise<ResultadoReporte> {
  const acceso = await verificarAcceso();
  if (acceso) return { ok: false, error: acceso };

  const rango = validarRango(desde, hasta);
  if (!rango.ok) return { ok: false, error: rango.error };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("reportes_obtener", {
      p_desde: rango.rango.desde,
      p_hasta: rango.rango.hasta,
    });

    if (error) {
      console.error("Error al cargar el reporte:", error.message);
      return {
        ok: false,
        error:
          "No se pudo cargar el reporte. Revisá que la migración 120 esté aplicada.",
      };
    }

    const reporte = normalizarReporte(data);
    if (!reporte) {
      return { ok: false, error: "No se pudo interpretar el reporte." };
    }

    return { ok: true, data: reporte };
  } catch (err) {
    console.error("Error inesperado al cargar el reporte:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function obtenerConteoPrevencionMensual(): Promise<ResultadoConteoPrevencion> {
  const acceso = await verificarAcceso();
  if (acceso) return { ok: false, error: acceso };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("prevencion_conteo_mensual")
      .select("mes, total, charlas, inspecciones, simulacros, otras")
      .order("mes", { ascending: false })
      .limit(12);

    if (error) {
      console.error("Error al cargar el conteo de prevención:", error.message);
      return {
        ok: false,
        error:
          "No se pudo cargar el resumen. Revisá que la migración de prevención esté aplicada.",
      };
    }

    const conteos: ConteoMensualPrevencion[] = [];
    for (const fila of data ?? []) {
      const conteo = normalizarConteo(fila);
      if (conteo) conteos.push(conteo);
    }
    return { ok: true, data: conteos };
  } catch (err) {
    console.error("Error inesperado al cargar el conteo de prevención:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}
