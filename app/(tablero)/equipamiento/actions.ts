"use server";

import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";
import { isOficial } from "@/lib/cargos";
import {
  type Equipo,
  type EquipoMovimiento,
  type EstadoEquipo,
  validarEquipo,
  validarMovimiento,
} from "@/lib/equipos";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };
export type ResultadoConId = { ok: true; data: string } | { ok: false; error: string };
export type ResultadoEquipos = { ok: true; data: Equipo[] } | { ok: false; error: string };
export type ResultadoEquipo = { ok: true; data: Equipo | null } | { ok: false; error: string };
export type ResultadoMovimientos = { ok: true; data: EquipoMovimiento[] } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validarUUID(uuid: string): string | null {
  if (!UUID_RE.test(uuid)) return "Identificador inválido.";
  return null;
}

function validarTexto(valor: string, campo: string, max: number): string | null {
  const v = valor.trim();
  if (!v) return `${campo} es obligatorio.`;
  if (v.length > max) return `${campo} no puede superar los ${max} caracteres.`;
  return null;
}

function mapRpcError(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "P0001") {
    const mensajes: Record<string, string> = {
      SIN_PERMISO: "No tenés permiso para realizar esta acción.",
      BOMBERO_INACTIVO: "Tu usuario no está activo.",
      CODIGO_REQUERIDO: "El código es obligatorio.",
      NOMBRE_REQUERIDO: "El nombre es obligatorio.",
      CATEGORIA_REQUERIDA: "La categoría es obligatoria.",
      CODIGO_DUPLICADO: "Ya existe un equipo con ese código.",
      ESTADO_INVALIDO: "Estado inválido.",
      NOTA_REQUERIDA: "Ingresá una nota para el cambio de estado.",
      EQUIPO_NO_ENCONTRADO: "No encontramos ese equipo.",
    };
    return mensajes[error.message ?? ""] ?? fallback;
  }
  return fallback;
}

async function getSesionObligatoria() {
  const session = await getSessionActiva();
  if (!session) return { ok: false as const, error: "Sesión no válida o expirada." };
  return { ok: true as const, session };
}

export async function obtenerEquipos(): Promise<ResultadoEquipos> {
  const sesion = await getSesionObligatoria();
  if (!sesion.ok) return { ok: false, error: sesion.error };
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("equipos")
      .select("*")
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true });
    if (error) {
      console.error("Error al cargar equipos:", error.message);
      return { ok: false, error: "No se pudieron cargar los equipos." };
    }
    const equipos: Equipo[] = [];
    for (const row of data ?? []) if (validarEquipo(row)) equipos.push(row);
    return { ok: true, data: equipos };
  } catch (err) {
    console.error("Error inesperado al cargar equipos:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function obtenerEquipo(equipoId: string): Promise<ResultadoEquipo> {
  const sesion = await getSesionObligatoria();
  if (!sesion.ok) return { ok: false, error: sesion.error };
  const errId = validarUUID(equipoId);
  if (errId) return { ok: false, error: errId };
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("equipos")
      .select("*")
      .eq("id", equipoId)
      .maybeSingle();
    if (error) {
      console.error("Error al cargar equipo:", error.message);
      return { ok: false, error: "No se pudo cargar el equipo." };
    }
    if (!data) return { ok: true, data: null };
    return { ok: true, data: validarEquipo(data) ? data : null };
  } catch (err) {
    console.error("Error inesperado al cargar equipo:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function obtenerMovimientosEquipo(equipoId: string): Promise<ResultadoMovimientos> {
  const sesion = await getSesionObligatoria();
  if (!sesion.ok) return { ok: false, error: sesion.error };
  const errId = validarUUID(equipoId);
  if (errId) return { ok: false, error: errId };
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("equipos_movimientos")
      .select("*, bombero:bomberos(nombre_completo)")
      .eq("equipo_id", equipoId)
      .order("fecha", { ascending: false });
    if (error) {
      console.error("Error al cargar movimientos:", error.message);
      return { ok: false, error: "No se pudo cargar el historial." };
    }
    const movimientos: EquipoMovimiento[] = [];
    for (const row of data ?? []) {
      if (validarMovimiento(row)) {
        const r = row as Record<string, unknown>;
        movimientos.push({
          ...(row as EquipoMovimiento),
          bombero_nombre: (r.bombero as { nombre_completo?: string } | null)?.nombre_completo,
        });
      }
    }
    return { ok: true, data: movimientos };
  } catch (err) {
    console.error("Error inesperado al cargar movimientos:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function crearEquipo(input: {
  codigo: string;
  nombre: string;
  categoria: string;
  ubicacion: string;
  estado: EstadoEquipo;
  notas: string;
}): Promise<ResultadoConId> {
  const sesion = await getSesionObligatoria();
  if (!sesion.ok) return { ok: false, error: sesion.error };
  if (!isOficial(sesion.session.cargo)) return { ok: false, error: "No tenés permiso para realizar esta acción." };

  const eCod = validarTexto(input.codigo, "El código", 40);
  const eNom = validarTexto(input.nombre, "El nombre", 120);
  const eCat = validarTexto(input.categoria, "La categoría", 80);
  if (eCod || eNom || eCat) return { ok: false, error: (eCod || eNom || eCat)! };
  if (input.ubicacion.length > 120) return { ok: false, error: "La ubicación no puede superar los 120 caracteres." };
  if (input.notas.length > 1000) return { ok: false, error: "Las notas no pueden superar los 1000 caracteres." };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("crear_equipo", {
      p_bombero_id: sesion.session.bombero_id,
      p_codigo: input.codigo.trim(),
      p_nombre: input.nombre.trim(),
      p_categoria: input.categoria.trim(),
      p_ubicacion: input.ubicacion.trim(),
      p_estado: input.estado,
      p_notas: input.notas.trim(),
    });
    if (error) {
      console.error("Error al crear equipo:", error.message);
      return { ok: false, error: mapRpcError(error, "No se pudo crear el equipo. Volvé a intentar.") };
    }
    return { ok: true, data: data as string };
  } catch (err) {
    console.error("Error inesperado al crear equipo:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function editarEquipo(input: {
  equipoId: string;
  codigo: string;
  nombre: string;
  categoria: string;
  ubicacion: string;
  notas: string;
}): Promise<ResultadoAccion> {
  const sesion = await getSesionObligatoria();
  if (!sesion.ok) return { ok: false, error: sesion.error };
  if (!isOficial(sesion.session.cargo)) return { ok: false, error: "No tenés permiso para realizar esta acción." };

  const errId = validarUUID(input.equipoId);
  if (errId) return { ok: false, error: errId };
  const eCod = validarTexto(input.codigo, "El código", 40);
  const eNom = validarTexto(input.nombre, "El nombre", 120);
  const eCat = validarTexto(input.categoria, "La categoría", 80);
  if (eCod || eNom || eCat) return { ok: false, error: (eCod || eNom || eCat)! };
  if (input.ubicacion.length > 120) return { ok: false, error: "La ubicación no puede superar los 120 caracteres." };
  if (input.notas.length > 1000) return { ok: false, error: "Las notas no pueden superar los 1000 caracteres." };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("editar_equipo", {
      p_bombero_id: sesion.session.bombero_id,
      p_equipo_id: input.equipoId,
      p_codigo: input.codigo.trim(),
      p_nombre: input.nombre.trim(),
      p_categoria: input.categoria.trim(),
      p_ubicacion: input.ubicacion.trim(),
      p_notas: input.notas.trim(),
    });
    if (error) {
      console.error("Error al editar equipo:", error.message);
      return { ok: false, error: mapRpcError(error, "No se pudo editar el equipo. Volvé a intentar.") };
    }
    return { ok: true };
  } catch (err) {
    console.error("Error inesperado al editar equipo:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function cambiarEstadoEquipo(input: {
  equipoId: string;
  estado: EstadoEquipo;
  nota: string;
}): Promise<ResultadoAccion> {
  const sesion = await getSesionObligatoria();
  if (!sesion.ok) return { ok: false, error: sesion.error };

  const errId = validarUUID(input.equipoId);
  if (errId) return { ok: false, error: errId };
  if (!["operativo", "en_reparacion", "baja"].includes(input.estado)) {
    return { ok: false, error: "Estado inválido." };
  }
  if (!input.nota.trim()) return { ok: false, error: "Ingresá una nota para el cambio de estado." };
  if (input.nota.length > 500) return { ok: false, error: "La nota no puede superar los 500 caracteres." };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("cambiar_estado_equipo", {
      p_bombero_id: sesion.session.bombero_id,
      p_equipo_id: input.equipoId,
      p_estado: input.estado,
      p_nota: input.nota.trim(),
    });
    if (error) {
      console.error("Error al cambiar estado:", error.message);
      return { ok: false, error: mapRpcError(error, "No se pudo cambiar el estado. Volvé a intentar.") };
    }
    return { ok: true };
  } catch (err) {
    console.error("Error inesperado al cambiar estado:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}
