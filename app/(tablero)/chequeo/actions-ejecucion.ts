"use server";

import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };
export type ResultadoConId = { ok: true; data: string } | { ok: false; error: string };
export type ResultadoConUrl = { ok: true; data: { signedUrl: string; path: string } } | { ok: false; error: string };
export type ResultadoChequeosFecha = { ok: true; data: any[] } | { ok: false; error: string };
export type ResultadoDetalle = { ok: true; data: any[] } | { ok: false; error: string };

async function getBomberoId(): Promise<string | null> {
  const session = await getSessionActiva();
  return session?.bombero_id ?? null;
}

function validarEstado(estado: string): boolean {
  return ["ok", "falta", "danado"].includes(estado);
}

function validarFranja(franja: string): boolean {
  return ["08:00-13:00", "13:00-18:00", "18:00-23:00", "23:00-08:00"].includes(franja);
}

function validarFecha(fecha: string): boolean {
  const d = new Date(fecha + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

function validarUUID(uuid: string): boolean {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

export async function iniciarChequeo(plantillaId: string, fecha: string, franja: string): Promise<ResultadoConId> {
  const bomberoId = await getBomberoId();
  if (!bomberoId) return { ok: false, error: "Sesión no válida o expirada." };

  if (!validarUUID(plantillaId)) return { ok: false, error: "Plantilla inválida." };
  if (!validarFecha(fecha)) return { ok: false, error: "Fecha inválida." };
  if (!validarFranja(franja)) return { ok: false, error: "Franja inválida." };

  try {
    const supabase = createServiceRoleClient();
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

export async function guardarResultado(
  chequeoId: string,
  itemId: string,
  estado: string,
  nota: string,
  fotoPath: string
): Promise<ResultadoAccion> {
  const bomberoId = await getBomberoId();
  if (!bomberoId) return { ok: false, error: "Sesión no válida o expirada." };

  if (!validarUUID(chequeoId)) return { ok: false, error: "Chequeo inválido." };
  if (!validarUUID(itemId)) return { ok: false, error: "Item inválido." };
  if (!validarEstado(estado)) return { ok: false, error: "Estado inválido." };
  if (nota.length > 500) return { ok: false, error: "La nota no puede superar los 500 caracteres." };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("guardar_resultado_chequeo", {
      p_bombero_id: bomberoId,
      p_chequeo_id: chequeoId,
      p_item_id: itemId,
      p_estado: estado,
      p_nota: nota.trim(),
      p_foto_path: fotoPath.trim(),
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
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function finalizarChequeo(chequeoId: string, observaciones: string): Promise<ResultadoAccion> {
  const bomberoId = await getBomberoId();
  if (!bomberoId) return { ok: false, error: "Sesión no válida o expirada." };

  if (!validarUUID(chequeoId)) return { ok: false, error: "Chequeo inválido." };
  if (observaciones.length > 1000) return { ok: false, error: "Las observaciones no pueden superar los 1000 caracteres." };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("finalizar_chequeo", {
      p_bombero_id: bomberoId,
      p_chequeo_id: chequeoId,
      p_observaciones: observaciones.trim(),
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
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function firmarSubidaFoto(
  chequeoId: string,
  itemId: string,
  contentType: string
): Promise<{ ok: true; data: { signedUrl: string; path: string } } | { ok: false; error: string }> {
  const bomberoId = await getBomberoId();
  if (!bomberoId) return { ok: false, error: "Sesión no válida o expirada." };

  if (!validarUUID(chequeoId)) return { ok: false, error: "Chequeo inválido." };
  if (!validarUUID(itemId)) return { ok: false, error: "Item inválido." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return { ok: false, error: "Tipo de archivo no permitido. Usá JPG, PNG o WebP." };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data: chequeo, error: errChequeo } = await supabase
      .from("chequeos")
      .select("id")
      .eq("id", chequeoId)
      .eq("realizado_por", bomberoId)
      .maybeSingle();
    if (errChequeo || !chequeo) {
      return { ok: false, error: "El chequeo no te pertenece." };
    }

    const { data: item, error: errItem } = await supabase
      .from("chequeo_items")
      .select("id, plantilla_id")
      .eq("id", itemId)
      .maybeSingle();
    if (errItem || !item) {
      return { ok: false, error: "El item no pertenece a este chequeo." };
    }

    const { data: chequeoPlantilla } = await supabase
      .from("chequeos")
      .select("plantilla_id")
      .eq("id", chequeoId)
      .single();
    if (!chequeoPlantilla || chequeoPlantilla.plantilla_id !== item.plantilla_id) {
      return { ok: false, error: "El item no pertenece a este chequeo." };
    }

    const path = `chequeos/${chequeoId}/${itemId}/${Date.now()}`;
    const { data, error } = await supabase.storage
      .from("chequeos")
      .createSignedUploadUrl(path);
    if (error || !data) {
      console.error("Error al firmar subida:", error?.message);
      return { ok: false, error: "No se pudo generar la URL de subida. Volvé a intentar." };
    }

    return { ok: true, data: { signedUrl: data.signedUrl, path } };
  } catch (err) {
    console.error("Error inesperado al firmar subida:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function obtenerChequeosFecha(fecha: string): Promise<ResultadoChequeosFecha> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };
  if (!isOficial(session.cargo)) return { ok: false, error: "Solo los oficiales pueden ver el resumen." };

  if (!validarFecha(fecha)) return { ok: false, error: "Fecha inválida." };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("obtener_chequeos_fecha", {
      p_bombero_id: session.bombero_id,
      p_fecha: fecha,
    });

    if (error) {
      if (error.code === "P0001") {
        return { ok: false, error: "Solo los oficiales pueden ver el resumen." };
      }
      console.error("Error al obtener chequeos:", error.message);
      return { ok: false, error: "No se pudieron cargar los chequeos. Volvé a intentar." };
    }

    return { ok: true, data: (data ?? []) as any[] };
  } catch (err) {
    console.error("Error inesperado al obtener chequeos:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function obtenerDetalleChequeo(chequeoId: string): Promise<ResultadoDetalle> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };
  if (!isOficial(session.cargo)) return { ok: false, error: "Solo los oficiales pueden ver el detalle." };

  if (!validarUUID(chequeoId)) return { ok: false, error: "Chequeo inválido." };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("obtener_chequeo_detalle", {
      p_bombero_id: session.bombero_id,
      p_chequeo_id: chequeoId,
    });

    if (error) {
      if (error.code === "P0001") {
        return { ok: false, error: "Solo los oficiales pueden ver el detalle." };
      }
      console.error("Error al obtener detalle:", error.message);
      return { ok: false, error: "No se pudo cargar el detalle. Volvé a intentar." };
    }

    return { ok: true, data: (data ?? []) as any[] };
  } catch (err) {
    console.error("Error inesperado al obtener detalle:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

import { isOficial } from "@/lib/cargos";

export async function obtenerResultadosChequeo(chequeoId: string): Promise<{ ok: true; data: any[] } | { ok: false; error: string }> {
  const bomberoId = await getBomberoId();
  if (!bomberoId) return { ok: false, error: "Sesión no válida o expirada." };
  if (!validarUUID(chequeoId)) return { ok: false, error: "Chequeo inválido." };

  try {
    const supabase = createServiceRoleClient();
    const { data: chequeo, error: errChequeo } = await supabase
      .from("chequeos")
      .select("id")
      .eq("id", chequeoId)
      .eq("realizado_por", bomberoId)
      .maybeSingle();
    if (errChequeo || !chequeo) {
      return { ok: false, error: "Chequeo no encontrado." };
    }

    const { data, error } = await supabase
      .from("chequeo_resultados")
      .select("*")
      .eq("chequeo_id", chequeoId);
    if (error) {
      console.error("Error al obtener resultados:", error.message);
      return { ok: false, error: "No se pudieron cargar los resultados." };
    }
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("Error inesperado al obtener resultados:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}