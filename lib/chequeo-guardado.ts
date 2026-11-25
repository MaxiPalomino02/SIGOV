import { createSupabaseClient } from "@/lib/supabase";
import { encolarOperacion } from "@/lib/cola-sincronizacion";
import type { EstadoItem, ChequeoResultado } from "@/lib/chequeo";

export type GuardarResultadoInput = {
  chequeoId: string;
  itemId: string;
  estado: EstadoItem;
  nota?: string;
  fotoPath?: string;
};

export type ObtenerEstadoOutput = {
  chequeoId: string;
  resultados: Map<string, ChequeoResultado>;
  completado: boolean;
  totalItems: number;
  itemsConResultado: number;
};

type ResultadoLocal = { ok: true } | { ok: false; error: string; pendiente?: boolean };

export type ChequeoGuardado = {
  guardarResultado: (input: GuardarResultadoInput) => Promise<ResultadoLocal>;
  obtenerEstado: (chequeoId: string) => Promise<{ ok: true; data: ObtenerEstadoOutput } | { ok: false; error: string }>;
  finalizarChequeo: (chequeoId: string, observaciones?: string) => Promise<ResultadoLocal>;
};

async function getSessionBomberoId(): Promise<string | null> {
  const { getSessionActiva } = await import("@/lib/session-db");
  const session = await getSessionActiva();
  return session?.bombero_id ?? null;
}

function validarEstado(estado: string): estado is EstadoItem {
  return ["ok", "falta", "danado"].includes(estado);
}

function sinConexion(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

async function encolarResultado(input: GuardarResultadoInput): Promise<ResultadoLocal> {
  await encolarOperacion({
    tipo: "chequeo",
    accion: "guardar_resultado",
    clave: `chequeo:${input.chequeoId}:${input.itemId}`,
    payload: {
      chequeoId: input.chequeoId,
      itemId: input.itemId,
      estado: input.estado,
      nota: input.nota ?? "",
      fotoPath: input.fotoPath ?? "",
    },
  });
  return {
    ok: false,
    error: "Guardado en el dispositivo. Se sincronizará cuando vuelva la conexión.",
    pendiente: true,
  };
}

async function encolarFinalizacion(
  chequeoId: string,
  observaciones: string
): Promise<ResultadoLocal> {
  await encolarOperacion({
    tipo: "chequeo",
    accion: "finalizar_chequeo",
    clave: `chequeo:${chequeoId}:finalizacion`,
    payload: { chequeoId, observaciones },
  });
  return {
    ok: false,
    error: "Finalización guardada en el dispositivo. Se sincronizará cuando vuelva la conexión.",
    pendiente: true,
  };
}

export const chequeoGuardado: ChequeoGuardado = {
  async guardarResultado(input: GuardarResultadoInput) {
    if (sinConexion()) return encolarResultado(input);
    const bomberoId = await getSessionBomberoId();
    if (!bomberoId) return { ok: false, error: "Sesión no válida o expirada." };

    if (!validarEstado(input.estado)) return { ok: false, error: "Estado inválido." };

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.rpc("guardar_resultado_chequeo", {
        p_bombero_id: bomberoId,
        p_chequeo_id: input.chequeoId,
        p_item_id: input.itemId,
        p_estado: input.estado,
        p_nota: input.nota ?? "",
        p_foto_path: input.fotoPath ?? "",
      });

      if (error) {
        if (error.code === "P0001") {
          const mensajes: Record<string, string> = {
            BOMBERO_INACTIVO: "Bombero inactivo.",
            ESTADO_INVALIDO: "Estado inválido.",
            CHEQUEO_NO_PERTENECE: "El chequeo no te pertenece.",
            ITEM_NO_PERTENECE: "El item no pertenece a este chequeo.",
          };
          return { ok: false, error: mensajes[error.message] ?? "No se pudo guardar el resultado." };
        }
        console.error("Error al guardar resultado:", error.message);
        return { ok: false, error: "No se pudo guardar el resultado. Volvé a intentar." };
      }

      return { ok: true };
    } catch (err) {
      console.error("Error inesperado al guardar resultado:", err);
      return encolarResultado(input);
    }
  },

  async obtenerEstado(chequeoId: string) {
    const bomberoId = await getSessionBomberoId();
    if (!bomberoId) return { ok: false, error: "Sesión no válida o expirada." };

    try {
      const supabase = createSupabaseClient();

      const { data: chequeo, error: errChequeo } = await supabase
        .from("chequeos")
        .select("id, estado, plantilla_id")
        .eq("id", chequeoId)
        .eq("realizado_por", bomberoId)
        .maybeSingle();

      if (errChequeo || !chequeo) {
        return { ok: false, error: "Chequeo no encontrado." };
      }

      const { data: items, error: errItems } = await supabase
        .from("chequeo_items")
        .select("id")
        .eq("plantilla_id", chequeo.plantilla_id);

      if (errItems) {
        console.error("Error al cargar items:", errItems.message);
        return { ok: false, error: "No se pudieron cargar los items." };
      }

      const { data: resultados, error: errResultados } = await supabase
        .from("chequeo_resultados")
        .select("*")
        .eq("chequeo_id", chequeoId);

      if (errResultados) {
        console.error("Error al cargar resultados:", errResultados.message);
        return { ok: false, error: "No se pudieron cargar los resultados." };
      }

      const mapa = new Map<string, ChequeoResultado>();
      for (const r of resultados ?? []) {
        mapa.set(r.item_id, r as ChequeoResultado);
      }

      const totalItems = (items ?? []).length;
      const itemsConResultado = mapa.size;
      const completado = chequeo.estado === "completo";

      return {
        ok: true,
        data: {
          chequeoId,
          resultados: mapa,
          completado,
          totalItems,
          itemsConResultado,
        },
      };
    } catch (err) {
      console.error("Error inesperado al obtener estado:", err);
      return { ok: false, error: "Error inesperado. Volvé a intentar." };
    }
  },

  async finalizarChequeo(chequeoId: string, observaciones?: string) {
    if (sinConexion()) return encolarFinalizacion(chequeoId, observaciones ?? "");
    const bomberoId = await getSessionBomberoId();
    if (!bomberoId) return { ok: false, error: "Sesión no válida o expirada." };

    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.rpc("finalizar_chequeo", {
        p_bombero_id: bomberoId,
        p_chequeo_id: chequeoId,
        p_observaciones: observaciones ?? "",
      });

      if (error) {
        if (error.code === "P0001") {
          const mensajes: Record<string, string> = {
            BOMBERO_INACTIVO: "Bombero inactivo.",
            CHEQUEO_NO_ENCONTRADO: "Chequeo no encontrado.",
          };
          return { ok: false, error: mensajes[error.message] ?? "No se pudo finalizar el chequeo." };
        }
        console.error("Error al finalizar chequeo:", error.message);
        return { ok: false, error: "No se pudo finalizar el chequeo. Volvé a intentar." };
      }

      return { ok: true };
    } catch (err) {
      console.error("Error inesperado al finalizar chequeo:", err);
      return encolarFinalizacion(chequeoId, observaciones ?? "");
    }
  },
};

export async function iniciarChequeo(plantillaId: string, fecha: string, franja: string): Promise<{ ok: true; data: string } | { ok: false; error: string }> {
  const bomberoId = await getSessionBomberoId();
  if (!bomberoId) return { ok: false, error: "Sesión no válida o expirada." };

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.rpc("iniciar_chequeo", {
      p_bombero_id: bomberoId,
      p_plantilla_id: plantillaId,
      p_fecha: fecha,
      p_franja: franja,
    });

    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          BOMBERO_INACTIVO: "Bombero inactivo.",
          FRANJA_INVALIDA: "Franja inválida.",
          PLANTILLA_NO_ENCONTRADA: "Plantilla no encontrada o inactiva.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo iniciar el chequeo." };
      }
      console.error("Error al iniciar chequeo:", error.message);
      return { ok: false, error: "No se pudo iniciar el chequeo. Volvé a intentar." };
    }

    return { ok: true, data: data as string };
  } catch (err) {
    console.error("Error inesperado al iniciar chequeo:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function firmarSubidaFoto(chequeoId: string, itemId: string, contentType: string): Promise<{ ok: true; data: string } | { ok: false; error: string }> {
  const bomberoId = await getSessionBomberoId();
  if (!bomberoId) return { ok: false, error: "Sesión no válida o expirada." };

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase.rpc("firmar_subida_foto_chequeo", {
      p_bombero_id: bomberoId,
      p_chequeo_id: chequeoId,
      p_item_id: itemId,
      p_content_type: contentType,
    });

    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          BOMBERO_INACTIVO: "Bombero inactivo.",
          CHEQUEO_NO_PERTENECE: "El chequeo no te pertenece.",
          ITEM_NO_PERTENECE: "El item no pertenece a este chequeo.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo generar la URL de subida." };
      }
      console.error("Error al firmar subida:", error.message);
      return { ok: false, error: "No se pudo generar la URL de subida. Volvé a intentar." };
    }

    return { ok: true, data: data as string };
  } catch (err) {
    console.error("Error inesperado al firmar subida:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}