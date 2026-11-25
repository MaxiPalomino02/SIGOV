"use server";

import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";
import { isOficial } from "@/lib/cargos";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };
export type ResultadoConId = { ok: true; data: string } | { ok: false; error: string };
export type ResultadoConUrl = { ok: true; data: string } | { ok: false; error: string };

function validarNombre(nombre: string): string | null {
  const n = nombre.trim();
  if (n.length === 0) return "El nombre es obligatorio.";
  if (n.length > 120) return "El nombre no puede superar los 120 caracteres.";
  return null;
}

function validarTipo(tipo: string): string | null {
  if (!["apertura", "cierre"].includes(tipo)) return "Tipo inválido. Debe ser 'apertura' o 'cierre'.";
  return null;
}

function validarUUID(uuid: string): string | null {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!regex.test(uuid)) return "Identificador inválido.";
  return null;
}

async function verificarOficial(): Promise<{ ok: true; bomberoId: string } | { ok: false; error: string }> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };
  if (!isOficial(session.cargo)) return { ok: false, error: "Solo los oficiales pueden realizar esta acción." };
  return { ok: true, bomberoId: session.bombero_id };
}

export async function crearPlantilla(nombre: string, tipo: string): Promise<ResultadoConId> {
  const permiso = await verificarOficial();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const errNombre = validarNombre(nombre);
  if (errNombre) return { ok: false, error: errNombre };

  const errTipo = validarTipo(tipo);
  if (errTipo) return { ok: false, error: errTipo };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("crear_chequeo_plantilla", {
      p_bombero_id: permiso.bomberoId,
      p_nombre: nombre.trim(),
      p_tipo: tipo,
    });

    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          SIN_PERMISO: "Solo los oficiales pueden crear plantillas.",
          TIPO_INVALIDO: "Tipo inválido.",
          NOMBRE_REQUERIDO: "El nombre es obligatorio.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo crear la plantilla." };
      }
      console.error("Error al crear plantilla:", error.message);
      return { ok: false, error: "No se pudo crear la plantilla. Volvé a intentar." };
    }

    return { ok: true, data: data as string };
  } catch (err) {
    console.error("Error inesperado al crear plantilla:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function editarPlantilla(plantillaId: string, nombre: string, tipo: string, activa: boolean): Promise<ResultadoAccion> {
  const permiso = await verificarOficial();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const errId = validarUUID(plantillaId);
  if (errId) return { ok: false, error: errId };

  const errNombre = validarNombre(nombre);
  if (errNombre) return { ok: false, error: errNombre };

  const errTipo = validarTipo(tipo);
  if (errTipo) return { ok: false, error: errTipo };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("editar_chequeo_plantilla", {
      p_bombero_id: permiso.bomberoId,
      p_plantilla_id: plantillaId,
      p_nombre: nombre.trim(),
      p_tipo: tipo,
      p_activa: activa,
    });

    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          SIN_PERMISO: "Solo los oficiales pueden editar plantillas.",
          TIPO_INVALIDO: "Tipo inválido.",
          NOMBRE_REQUERIDO: "El nombre es obligatorio.",
          PLANTILLA_NO_ENCONTRADA: "Plantilla no encontrada.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo editar la plantilla." };
      }
      console.error("Error al editar plantilla:", error.message);
      return { ok: false, error: "No se pudo editar la plantilla. Volvé a intentar." };
    }

    return { ok: true };
  } catch (err) {
    console.error("Error inesperado al editar plantilla:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function borrarPlantilla(plantillaId: string): Promise<ResultadoAccion> {
  const permiso = await verificarOficial();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const errId = validarUUID(plantillaId);
  if (errId) return { ok: false, error: errId };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("borrar_chequeo_plantilla", {
      p_bombero_id: permiso.bomberoId,
      p_plantilla_id: plantillaId,
    });

    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          SIN_PERMISO: "Solo los oficiales pueden borrar plantillas.",
          PLANTILLA_NO_ENCONTRADA: "Plantilla no encontrada.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo borrar la plantilla." };
      }
      console.error("Error al borrar plantilla:", error.message);
      return { ok: false, error: "No se pudo borrar la plantilla. Volvé a intentar." };
    }

    return { ok: true };
  } catch (err) {
    console.error("Error inesperado al borrar plantilla:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function crearItem(
  plantillaId: string,
  nombre: string,
  grupo: string,
  orden: number,
  equipoId?: string | null
): Promise<ResultadoConId> {
  const permiso = await verificarOficial();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const errPlantilla = validarUUID(plantillaId);
  if (errPlantilla) return { ok: false, error: errPlantilla };

  const errNombre = validarNombre(nombre);
  if (errNombre) return { ok: false, error: errNombre };

  if (grupo.length > 80) return { ok: false, error: "El grupo no puede superar los 80 caracteres." };
  if (orden < 0) return { ok: false, error: "El orden debe ser un número positivo." };
  if (equipoId) {
    const errEq = validarUUID(equipoId);
    if (errEq) return { ok: false, error: errEq };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("crear_chequeo_item", {
      p_bombero_id: permiso.bomberoId,
      p_plantilla_id: plantillaId,
      p_nombre: nombre.trim(),
      p_grupo: grupo.trim(),
      p_orden: orden,
      p_equipo_id: equipoId || null,
    });

    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          SIN_PERMISO: "Solo los oficiales pueden crear items.",
          PLANTILLA_NO_ENCONTRADA: "Plantilla no encontrada.",
          NOMBRE_REQUERIDO: "El nombre es obligatorio.",
          EQUIPO_NO_ENCONTRADO: "Equipo no encontrado.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo crear el item." };
      }
      console.error("Error al crear item:", error.message);
      return { ok: false, error: "No se pudo crear el item. Volvé a intentar." };
    }

    return { ok: true, data: data as string };
  } catch (err) {
    console.error("Error inesperado al crear item:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function editarItem(
  itemId: string,
  nombre: string,
  grupo: string,
  orden: number,
  equipoId?: string | null
): Promise<ResultadoAccion> {
  const permiso = await verificarOficial();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const errId = validarUUID(itemId);
  if (errId) return { ok: false, error: errId };

  const errNombre = validarNombre(nombre);
  if (errNombre) return { ok: false, error: errNombre };

  if (grupo.length > 80) return { ok: false, error: "El grupo no puede superar los 80 caracteres." };
  if (orden < 0) return { ok: false, error: "El orden debe ser un número positivo." };
  if (equipoId) {
    const errEq = validarUUID(equipoId);
    if (errEq) return { ok: false, error: errEq };
  }

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("editar_chequeo_item", {
      p_bombero_id: permiso.bomberoId,
      p_item_id: itemId,
      p_nombre: nombre.trim(),
      p_grupo: grupo.trim(),
      p_orden: orden,
      p_equipo_id: equipoId || null,
    });

    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          SIN_PERMISO: "Solo los oficiales pueden editar items.",
          NOMBRE_REQUERIDO: "El nombre es obligatorio.",
          ITEM_NO_ENCONTRADO: "Item no encontrado.",
          EQUIPO_NO_ENCONTRADO: "Equipo no encontrado.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo editar el item." };
      }
      console.error("Error al editar item:", error.message);
      return { ok: false, error: "No se pudo editar el item. Volvé a intentar." };
    }

    return { ok: true };
  } catch (err) {
    console.error("Error inesperado al editar item:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function borrarItem(itemId: string): Promise<ResultadoAccion> {
  const permiso = await verificarOficial();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const errId = validarUUID(itemId);
  if (errId) return { ok: false, error: errId };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("borrar_chequeo_item", {
      p_bombero_id: permiso.bomberoId,
      p_item_id: itemId,
    });

    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          SIN_PERMISO: "Solo los oficiales pueden borrar items.",
          ITEM_NO_ENCONTRADO: "Item no encontrado.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo borrar el item." };
      }
      console.error("Error al borrar item:", error.message);
      return { ok: false, error: "No se pudo borrar el item. Volvé a intentar." };
    }

    return { ok: true };
  } catch (err) {
    console.error("Error inesperado al borrar item:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function reordenarItems(plantillaId: string, items: { id: string; orden: number; grupo: string }[]): Promise<ResultadoAccion> {
  const permiso = await verificarOficial();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const errPlantilla = validarUUID(plantillaId);
  if (errPlantilla) return { ok: false, error: errPlantilla };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("reordenar_chequeo_items", {
      p_bombero_id: permiso.bomberoId,
      p_plantilla_id: plantillaId,
      p_items: items,
    });

    if (error) {
      if (error.code === "P0001") {
        return { ok: false, error: "Solo los oficiales pueden reordenar items." };
      }
      console.error("Error al reordenar items:", error.message);
      return { ok: false, error: "No se pudo reordenar. Volvé a intentar." };
    }

    return { ok: true };
  } catch (err) {
console.error("Error inesperado al reordenar:", err);
  return { ok: false, error: "Error inesperado. Volvé a intentar." };
}
}

export async function cargarPlantillasAction(tipo?: string, soloActivas = true): Promise<{ ok: true; data: any[] } | { ok: false; error: string }> {
  try {
    const supabase = createServiceRoleClient();
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
      return { ok: false, error: "No se pudieron cargar las plantillas." };
    }

    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("Error al consultar plantillas:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function cargarItemsAction(plantillaId: string): Promise<{ ok: true; data: any[] } | { ok: false; error: string }> {
  const errId = validarUUID(plantillaId);
  if (errId) return { ok: false, error: errId };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("chequeo_items")
      .select("*, equipo:equipos(id, nombre, codigo, estado)")
      .eq("plantilla_id", plantillaId)
      .order("grupo", { ascending: true })
      .order("orden", { ascending: true });

    if (error) {
      console.error("No se pudieron cargar los items:", error.message);
      return { ok: false, error: "No se pudieron cargar los items." };
    }

    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("Error al consultar items:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function cargarEquiposActivosAction(): Promise<{ ok: true; data: any[] } | { ok: false; error: string }> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("equipos")
      .select("id, codigo, nombre, categoria, estado")
      .neq("estado", "baja")
      .order("nombre", { ascending: true });
    if (error) {
      console.error("No se pudieron cargar los equipos:", error.message);
      return { ok: false, error: "No se pudieron cargar los equipos." };
    }
    return { ok: true, data: data ?? [] };
  } catch (err) {
    console.error("Error al consultar equipos:", err);
    return { ok: false, error: "Error inesperado." };
  }
}

export async function marcarEquipoEnReparacionAction(
  equipoId: string,
  nota: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const permiso = await verificarOficial();
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const errId = validarUUID(equipoId);
  if (errId) return { ok: false, error: errId };
  if (!nota.trim()) return { ok: false, error: "Ingresá una nota para el cambio de estado." };
  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("cambiar_estado_equipo", {
      p_bombero_id: permiso.bomberoId,
      p_equipo_id: equipoId,
      p_estado: "en_reparacion",
      p_nota: nota.trim(),
    });
    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          SIN_PERMISO: "No tenés permiso para realizar esta acción.",
          BOMBERO_INACTIVO: "Tu usuario no está activo.",
          ESTADO_INVALIDO: "Estado inválido.",
          NOTA_REQUERIDA: "Ingresá una nota para el cambio de estado.",
          EQUIPO_NO_ENCONTRADO: "No encontramos ese equipo.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo cambiar el estado." };
      }
      console.error("Error al marcar en reparación:", error.message);
      return { ok: false, error: "No se pudo cambiar el estado. Volvé a intentar." };
    }
    return { ok: true };
  } catch (err) {
    console.error("Error inesperado al marcar en reparación:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}