export type TipoActividadPrevencion =
  | "charla"
  | "inspeccion"
  | "simulacro"
  | "otra";

export const TIPOS_ACTIVIDAD_PREVENCION: {
  value: TipoActividadPrevencion;
  label: string;
}[] = [
  { value: "charla", label: "Charla" },
  { value: "inspeccion", label: "Inspección" },
  { value: "simulacro", label: "Simulacro" },
  { value: "otra", label: "Otra" },
];

export const ETIQUETAS_TIPO_ACTIVIDAD: Record<TipoActividadPrevencion, string> = {
  charla: "Charla",
  inspeccion: "Inspección",
  simulacro: "Simulacro",
  otra: "Otra",
};

export const MAX_FOTOS_PREVENCION = 6;

export type ActividadPrevencion = {
  id: string;
  tipo: TipoActividadPrevencion;
  fecha: string;
  lugar: string;
  responsable_id: string | null;
  participantes: string;
  descripcion: string;
  fotos: string[];
  creado_por: string;
  creado_en: string;
  responsable_nombre?: string;
  creador_nombre?: string;
};

export type RegistrarActividadInput = {
  tipo: TipoActividadPrevencion;
  fecha: string;
  lugar: string;
  responsable_id: string | null;
  participantes: string;
  descripcion: string;
  fotos: string[];
};

export type ConteoMensualPrevencion = {
  mes: string;
  total: number;
  charlas: number;
  inspecciones: number;
  simulacros: number;
  otras: number;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MES_RE = /^\d{4}-\d{2}$/;

export function esUUID(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_RE.test(valor);
}

export function esTipoActividad(
  valor: unknown
): valor is TipoActividadPrevencion {
  return (
    valor === "charla" ||
    valor === "inspeccion" ||
    valor === "simulacro" ||
    valor === "otra"
  );
}

export function esFechaActividad(valor: unknown): valor is string {
  if (typeof valor !== "string" || !FECHA_RE.test(valor)) return false;
  const fecha = new Date(`${valor}T12:00:00-03:00`);
  return !Number.isNaN(fecha.getTime());
}

export function esFotoActividad(valor: unknown): valor is string {
  return (
    typeof valor === "string" &&
    valor.trim().length > 0 &&
    valor.trim().length <= 400 &&
    (/^https?:\/\//.test(valor.trim()) || valor.trim().startsWith("/"))
  );
}

export function normalizarFotos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter(esFotoActividad)
    .map((foto) => foto.trim())
    .slice(0, MAX_FOTOS_PREVENCION);
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export function normalizarActividad(row: unknown): ActividadPrevencion | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;

  if (!esUUID(r.id)) return null;
  if (!esTipoActividad(r.tipo)) return null;
  if (!esFechaActividad(r.fecha)) return null;

  const lugar = texto(r.lugar);
  if (!lugar || lugar.length > 200) return null;
  if (!esUUID(r.creado_por)) return null;
  if (typeof r.creado_en !== "string") return null;

  if (r.responsable_id !== null && !esUUID(r.responsable_id)) return null;

  return {
    id: r.id,
    tipo: r.tipo,
    fecha: r.fecha,
    lugar,
    responsable_id: esUUID(r.responsable_id) ? r.responsable_id : null,
    participantes: texto(r.participantes).slice(0, 1000),
    descripcion: texto(r.descripcion).slice(0, 2000),
    fotos: normalizarFotos(r.fotos),
    creado_por: r.creado_por,
    creado_en: r.creado_en,
    responsable_nombre:
      typeof r.responsable_nombre === "string"
        ? r.responsable_nombre
        : undefined,
    creador_nombre:
      typeof r.creador_nombre === "string" ? r.creador_nombre : undefined,
  };
}

export function normalizarConteo(
  row: unknown
): ConteoMensualPrevencion | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;

  if (typeof r.mes !== "string" || !MES_RE.test(r.mes)) return null;

  const valores = [r.total, r.charlas, r.inspecciones, r.simulacros, r.otras];
  const numeros = valores.map((valor) =>
    typeof valor === "number" ? valor : Number(valor)
  );
  if (numeros.some((numero) => !Number.isInteger(numero) || numero < 0)) {
    return null;
  }

  const [total, charlas, inspecciones, simulacros, otras] = numeros;
  return {
    mes: r.mes,
    total: total ?? 0,
    charlas: charlas ?? 0,
    inspecciones: inspecciones ?? 0,
    simulacros: simulacros ?? 0,
    otras: otras ?? 0,
  };
}

export function formatearFechaActividad(fecha: string): string {
  if (!esFechaActividad(fecha)) return fecha;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${fecha}T12:00:00-03:00`));
}

export function etiquetaMes(mes: string): string {
  if (!MES_RE.test(mes)) return mes;
  const textoMes = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    month: "long",
    year: "numeric",
  }).format(new Date(`${mes}-01T12:00:00-03:00`));
  return textoMes.charAt(0).toUpperCase() + textoMes.slice(1);
}
