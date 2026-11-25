"use server";

import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";
import { isOficial } from "@/lib/cargos";

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

function validarTitulo(titulo: string): string | null {
  const t = titulo.trim();
  if (t.length === 0) return "El título es obligatorio.";
  if (t.length > 120) return "El título no puede superar los 120 caracteres.";
  return null;
}

function validarDescripcion(descripcion: string): string | null {
  if (descripcion.length > 2000) return "La descripción no puede superar los 2000 caracteres.";
  return null;
}

function validarLugar(lugar: string): string | null {
  if (lugar.length > 200) return "El lugar no puede superar los 200 caracteres.";
  return null;
}

function validarTipo(tipo: string): string | null {
  const tipos = ["capacitacion", "reunion", "simulacro", "acto", "otro"];
  if (!tipos.includes(tipo)) return "Tipo de evento inválido.";
  return null;
}

function validarFechas(inicio: string, fin: string): string | null {
  const ini = new Date(inicio);
  const fn = new Date(fin);
  if (Number.isNaN(ini.getTime())) return "Fecha de inicio inválida.";
  if (Number.isNaN(fn.getTime())) return "Fecha de fin inválida.";
  if (fn <= ini) return "La fecha de fin debe ser posterior a la de inicio.";
  return null;
}

function validarUUID(uuid: string): string | null {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!regex.test(uuid)) return "Identificador inválido.";
  return null;
}

/** Convierte "YYYY-MM-DDTHH:mm" (local Tucumán) a ISO con zona horaria. */
function toTucumanISO(localStr: string): string {
  const [fecha, hora] = localStr.split("T");
  if (!fecha || !hora) return localStr;
  // Construir Date en zona horaria de Tucumán
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [horas, minutos] = hora.split(":").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia, horas, minutos, 0));
  // Ajustar por offset de Tucumán (-3 horas = UTC-3)
  const offset = -3 * 60 * 60 * 1000;
  return new Date(d.getTime() - offset).toISOString();
}

async function verificarOficial(): Promise<{ ok: true; bomberoId: string } | { ok: false; error: string }> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };
  if (!isOficial(session.cargo)) return { ok: false, error: "Solo los oficiales pueden realizar esta acción." };
  return { ok: true, bomberoId: session.bombero_id };
}

export async function crearEvento(
  titulo: string,
  descripcion: string,
  tipo: string,
  inicio: string,
  fin: string,
  lugar: string
): Promise<ResultadoAccion> {
  const permiso = await verificarOficial();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const errTitulo = validarTitulo(titulo);
  if (errTitulo) return { ok: false, error: errTitulo };

  const errDesc = validarDescripcion(descripcion);
  if (errDesc) return { ok: false, error: errDesc };

  const errTipo = validarTipo(tipo);
  if (errTipo) return { ok: false, error: errTipo };

  const errFechas = validarFechas(inicio, fin);
  if (errFechas) return { ok: false, error: errFechas };

  const errLugar = validarLugar(lugar);
  if (errLugar) return { ok: false, error: errLugar };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("crear_evento", {
      p_bombero_id: permiso.bomberoId,
      p_titulo: titulo.trim(),
      p_descripcion: descripcion.trim(),
      p_tipo: tipo,
      p_inicio: toTucumanISO(inicio),
      p_fin: toTucumanISO(fin),
      p_lugar: lugar.trim(),
    });

    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          SIN_PERMISO: "Solo los oficiales pueden crear eventos.",
          TIPO_INVALIDO: "Tipo de evento inválido.",
          TITULO_REQUERIDO: "El título es obligatorio.",
          FECHAS_REQUERIDAS: "Las fechas son obligatorias.",
          FIN_DESPUES_INICIO: "La fecha de fin debe ser posterior a la de inicio.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo crear el evento." };
      }
      console.error("Error al crear evento:", error.message);
      return { ok: false, error: "No se pudo crear el evento. Volvé a intentar." };
    }

    return { ok: true };
  } catch (err) {
    console.error("Error inesperado al crear evento:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function editarEvento(
  eventoId: string,
  titulo: string,
  descripcion: string,
  tipo: string,
  inicio: string,
  fin: string,
  lugar: string
): Promise<ResultadoAccion> {
  const permiso = await verificarOficial();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const errId = validarUUID(eventoId);
  if (errId) return { ok: false, error: errId };

  const errTitulo = validarTitulo(titulo);
  if (errTitulo) return { ok: false, error: errTitulo };

  const errDesc = validarDescripcion(descripcion);
  if (errDesc) return { ok: false, error: errDesc };

  const errTipo = validarTipo(tipo);
  if (errTipo) return { ok: false, error: errTipo };

  const errFechas = validarFechas(inicio, fin);
  if (errFechas) return { ok: false, error: errFechas };

  const errLugar = validarLugar(lugar);
  if (errLugar) return { ok: false, error: errLugar };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("editar_evento", {
      p_bombero_id: permiso.bomberoId,
      p_evento_id: eventoId,
      p_titulo: titulo.trim(),
      p_descripcion: descripcion.trim(),
      p_tipo: tipo,
      p_inicio: toTucumanISO(inicio),
      p_fin: toTucumanISO(fin),
      p_lugar: lugar.trim(),
    });

    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          SIN_PERMISO: "Solo los oficiales pueden editar eventos.",
          TIPO_INVALIDO: "Tipo de evento inválido.",
          TITULO_REQUERIDO: "El título es obligatorio.",
          FECHAS_REQUERIDAS: "Las fechas son obligatorias.",
          FIN_DESPUES_INICIO: "La fecha de fin debe ser posterior a la de inicio.",
          EVENTO_NO_ENCONTRADO: "El evento no existe o ya fue borrado.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo editar el evento." };
      }
      console.error("Error al editar evento:", error.message);
      return { ok: false, error: "No se pudo editar el evento. Volvé a intentar." };
    }

    return { ok: true };
  } catch (err) {
    console.error("Error inesperado al editar evento:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function borrarEvento(eventoId: string): Promise<ResultadoAccion> {
  const permiso = await verificarOficial();
  if (!permiso.ok) return { ok: false, error: permiso.error };

  const errId = validarUUID(eventoId);
  if (errId) return { ok: false, error: errId };

  try {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.rpc("borrar_evento", {
      p_bombero_id: permiso.bomberoId,
      p_evento_id: eventoId,
    });

    if (error) {
      if (error.code === "P0001") {
        const mensajes: Record<string, string> = {
          SIN_PERMISO: "Solo los oficiales pueden borrar eventos.",
          EVENTO_NO_ENCONTRADO: "El evento no existe o ya fue borrado.",
        };
        return { ok: false, error: mensajes[error.message] ?? "No se pudo borrar el evento." };
      }
      console.error("Error al borrar evento:", error.message);
      return { ok: false, error: "No se pudo borrar el evento. Volvé a intentar." };
    }

    return { ok: true };
  } catch (err) {
    console.error("Error inesperado al borrar evento:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}