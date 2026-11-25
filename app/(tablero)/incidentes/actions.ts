"use server";

import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";
import { isOficial } from "@/lib/cargos";
import {
  esEstadoIncidente,
  esTipoIncidente,
  franjaActualArgentina,
  normalizarPersonal,
  validarIncidente,
  type Incidente,
  type PersonalIncidente,
} from "@/lib/incidentes";
import type { GuardarIncidenteInput, GuardarIncidenteResult } from "@/lib/incidentes-guardado";

export type ResultadoIncidentes = { ok: true; data: Incidente[] } | { ok: false; error: string };
export type ResultadoPersonal = { ok: true; data: PersonalIncidente[] } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapError(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === "P0001") {
    const mensajes: Record<string, string> = {
      BOMBERO_INACTIVO: "Tu usuario no está activo.",
      TIPO_INVALIDO: "Elegí un tipo de incidente válido.",
      ESTADO_INVALIDO: "El estado del incidente no es válido.",
      DIRECCION_REQUERIDA: "Ingresá la dirección del incidente.",
      INCIDENTE_NO_ENCONTRADO: "No encontramos ese incidente.",
    };
    return mensajes[error.message ?? ""] ?? fallback;
  }
  return fallback;
}

export async function guardarIncidenteAction(
  input: GuardarIncidenteInput
): Promise<GuardarIncidenteResult> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };

  if (!esTipoIncidente(input.tipo)) return { ok: false, error: "Elegí un tipo de incidente válido." };
  if (!esEstadoIncidente(input.estado)) return { ok: false, error: "El estado del incidente no es válido." };

  const fecha = new Date(typeof input.fecha_hora === "string" ? input.fecha_hora : "");
  if (Number.isNaN(fecha.getTime())) return { ok: false, error: "La fecha y hora no son válidas." };

  const direccion = typeof input.direccion === "string" ? input.direccion.trim() : "";
  const descripcion = typeof input.descripcion === "string" ? input.descripcion.trim() : "";
  if (direccion.length > 200) return { ok: false, error: "La dirección es demasiado larga." };
  if (descripcion.length > 2000) return { ok: false, error: "La descripción es demasiado larga." };
  if (input.estado === "cargado" && !direccion) {
    return { ok: false, error: "Ingresá la dirección para guardar el incidente." };
  }

  const unidadesRaw = Array.isArray(input.unidades) ? input.unidades : [];
  const unidades = Array.from(
    new Set(
      unidadesRaw
        .filter((u): u is string => typeof u === "string")
        .map((u) => u.trim())
        .filter((u) => u.length > 0 && u.length <= 40)
    )
  ).slice(0, 20);

  const personal = normalizarPersonal(input.personal)
    .filter((p) => UUID_RE.test(p.bombero_id))
    .map((p) => ({
      bombero_id: p.bombero_id,
      nombre: p.nombre.trim().slice(0, 120),
      cargo: p.cargo ? p.cargo.trim().slice(0, 60) : undefined,
    }))
    .filter((p) => p.nombre.length > 0)
    .slice(0, 60);

  let incidenteId: string | null = null;
  if (typeof input.incidenteId === "string" && input.incidenteId) {
    if (!UUID_RE.test(input.incidenteId)) return { ok: false, error: "Incidente inválido." };
    incidenteId = input.incidenteId;
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("guardar_incidente", {
      p_bombero_id: session.bombero_id,
      p_incidente_id: incidenteId,
      p_fecha_hora: fecha.toISOString(),
      p_tipo: input.tipo,
      p_direccion: direccion,
      p_descripcion: descripcion,
      p_unidades: unidades,
      p_personal: personal,
      p_estado: input.estado,
    });

    if (error) {
      console.error("Error al guardar incidente:", error.message);
      return { ok: false, error: mapError(error, "No se pudo guardar el incidente.") };
    }
    if (typeof data !== "string" || !UUID_RE.test(data)) {
      return { ok: false, error: "No se pudo guardar el incidente." };
    }
    return { ok: true, data };
  } catch (err) {
    console.error("Error inesperado al guardar incidente:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function obtenerIncidentes(): Promise<ResultadoIncidentes> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };

  try {
    const supabase = createServiceRoleClient();
    let query = supabase
      .from("incidentes")
      .select("*, creador:bomberos!incidentes_creado_por_fkey(nombre_completo)")
      .order("fecha_hora", { ascending: false })
      .limit(200);

    if (!isOficial(session.cargo)) query = query.eq("creado_por", session.bombero_id);

    const { data, error } = await query;
    if (error) {
      console.error("Error al cargar incidentes:", error.message);
      return { ok: false, error: "No se pudieron cargar los incidentes." };
    }

    const incidentes: Incidente[] = [];
    for (const row of data ?? []) {
      if (!validarIncidente(row)) continue;
      const registro = row as unknown as Record<string, unknown>;
      const creador = registro.creador as { nombre_completo?: string } | null | undefined;
      const unidades = Array.isArray(registro.unidades)
        ? registro.unidades.filter((u): u is string => typeof u === "string")
        : [];
      incidentes.push({
        ...row,
        unidades,
        personal: normalizarPersonal(registro.personal),
        creador_nombre:
          creador && typeof creador.nombre_completo === "string"
            ? creador.nombre_completo
            : undefined,
      });
    }
    return { ok: true, data: incidentes };
  } catch (err) {
    console.error("Error inesperado al cargar incidentes:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function obtenerPersonalGuardia(): Promise<ResultadoPersonal> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };

  try {
    const { fecha, franja } = franjaActualArgentina();
    const supabase = createServiceRoleClient();
    const { data: turnos, error: turnosError } = await supabase
      .from("turnos")
      .select("bombero_id")
      .eq("fecha", fecha)
      .eq("franja", franja);

    if (turnosError) {
      console.error("Error al cargar guardia actual:", turnosError.message);
      return { ok: false, error: "No se pudo cargar la guardia actual." };
    }

    const ids = Array.from(
      new Set(
        (turnos ?? [])
          .map((t) => (typeof t.bombero_id === "string" ? t.bombero_id : ""))
          .filter((id) => UUID_RE.test(id))
      )
    );
    if (ids.length === 0) return { ok: true, data: [] };

    const { data: bomberos, error: bomberosError } = await supabase
      .from("bomberos")
      .select("id, nombre_completo, cargo")
      .in("id", ids)
      .eq("activo", true)
      .order("nombre_completo", { ascending: true });

    if (bomberosError) {
      console.error("Error al cargar bomberos de guardia:", bomberosError.message);
      return { ok: false, error: "No se pudo cargar el personal de guardia." };
    }

    const personal: PersonalIncidente[] = [];
    for (const b of bomberos ?? []) {
      if (typeof b.id === "string" && typeof b.nombre_completo === "string") {
        personal.push({
          bombero_id: b.id,
          nombre: b.nombre_completo,
          cargo: typeof b.cargo === "string" ? b.cargo : undefined,
        });
      }
    }
    return { ok: true, data: personal };
  } catch (err) {
    console.error("Error inesperado al cargar personal de guardia:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function obtenerIncidentesIniciales(): Promise<{
  incidentes: Incidente[];
  error: string | null;
}> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  const res = await obtenerIncidentes();
  if (!res.ok) return { incidentes: [], error: res.error };
  return { incidentes: res.data, error: null };
}
