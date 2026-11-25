import { createSupabaseClient } from "@/lib/supabase";

export type TipoEvento =
  | "capacitacion"
  | "reunion"
  | "simulacro"
  | "acto"
  | "otro";

export const TIPOS_EVENTO: TipoEvento[] = [
  "capacitacion",
  "reunion",
  "simulacro",
  "acto",
  "otro",
];

export const ETIQUETAS_TIPO: Record<TipoEvento, string> = {
  capacitacion: "Capacitación",
  reunion: "Reunión",
  simulacro: "Simulacro",
  acto: "Acto",
  otro: "Otro",
};

export const ICONOS_TIPO: Record<TipoEvento, string> = {
  capacitacion: "GraduationCap",
  reunion: "Users",
  simulacro: "Flame",
  acto: "Award",
  otro: "Calendar",
};

export type Evento = {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: TipoEvento;
  inicio: string; // ISO timestamptz
  fin: string; // ISO timestamptz
  lugar: string;
  creado_por: string;
  creado_en: string;
  actualizado_en: string;
};

export type EventoCarga = { ok: true; data: Evento[] } | { ok: false };

function validarEvento(row: unknown): row is Evento {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.titulo === "string" &&
    typeof r.descripcion === "string" &&
    typeof r.tipo === "string" &&
    TIPOS_EVENTO.includes(r.tipo as TipoEvento) &&
    typeof r.inicio === "string" &&
    typeof r.fin === "string" &&
    typeof r.lugar === "string" &&
    typeof r.creado_por === "string" &&
    typeof r.creado_en === "string" &&
    typeof r.actualizado_en === "string"
  );
}

export async function cargarEventos(
  desde?: string,
  hasta?: string,
  tipo?: TipoEvento
): Promise<EventoCarga> {
  try {
    const supabase = createSupabaseClient();
    let query = supabase
      .from("eventos")
      .select("*")
      .order("inicio", { ascending: true });

    if (desde) query = query.gte("inicio", desde);
    if (hasta) query = query.lte("inicio", hasta);
    if (tipo) query = query.eq("tipo", tipo);

    const { data, error } = await query;

    if (error) {
      console.error("No se pudieron cargar los eventos:", error.message);
      return { ok: false };
    }

    const eventos: Evento[] = [];
    for (const fila of data ?? []) {
      if (validarEvento(fila)) eventos.push(fila);
    }
    return { ok: true, data: eventos };
  } catch (error) {
    console.error("Error al consultar eventos:", error);
    return { ok: false };
  }
}

export async function cargarEventosProximos(
  limite = 5
): Promise<EventoCarga> {
  try {
    const supabase = createSupabaseClient();
    const ahora = new Date().toISOString();

    const { data, error } = await supabase
      .from("eventos")
      .select("*")
      .gte("fin", ahora)
      .order("inicio", { ascending: true })
      .limit(limite);

    if (error) {
      console.error("No se pudieron cargar los próximos eventos:", error.message);
      return { ok: false };
    }

    const eventos: Evento[] = [];
    for (const fila of data ?? []) {
      if (validarEvento(fila)) eventos.push(fila);
    }
    return { ok: true, data: eventos };
  } catch (error) {
    console.error("Error al consultar próximos eventos:", error);
    return { ok: false };
  }
}

export function formatearFechaEvento(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fecha);
}

export function formatearHoraEvento(fechaISO: string): string {
  const fecha = new Date(fechaISO);
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
}

export function formatearFechaHoraEvento(fechaISO: string): string {
  return `${formatearFechaEvento(fechaISO)} a las ${formatearHoraEvento(fechaISO)}`;
}

export function obtenerColorTipo(tipo: TipoEvento): string {
  switch (tipo) {
    case "capacitacion":
      return "text-brass";
    case "reunion":
      return "text-alarm";
    case "simulacro":
      return "text-fire-text";
    case "acto":
      return "text-ok";
    case "otro":
      return "text-ink-muted";
  }
}

export function obtenerFondoTipo(tipo: TipoEvento): string {
  switch (tipo) {
    case "capacitacion":
      return "bg-brass/10 border-brass/40";
    case "reunion":
      return "bg-alarm/10 border-alarm/40";
    case "simulacro":
      return "bg-fire/10 border-fire/40";
    case "acto":
      return "bg-ok/10 border-ok/40";
    case "otro":
      return "bg-bg-subtle border-line";
  }
}