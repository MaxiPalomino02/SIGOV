export type TipoIncidente =
  | "incendio_estructural"
  | "forestal"
  | "vehicular"
  | "rescate"
  | "abeja_enjambre"
  | "inundacion"
  | "apoyo"
  | "otro";

export type EstadoIncidente = "borrador" | "cargado";

export const TIPOS_INCIDENTE: { value: TipoIncidente; label: string }[] = [
  { value: "incendio_estructural", label: "Incendio estructural" },
  { value: "forestal", label: "Forestal" },
  { value: "vehicular", label: "Vehicular" },
  { value: "rescate", label: "Rescate" },
  { value: "abeja_enjambre", label: "Abeja / enjambre" },
  { value: "inundacion", label: "Inundación" },
  { value: "apoyo", label: "Apoyo" },
  { value: "otro", label: "Otro" },
];

export const ETIQUETAS_TIPO_INCIDENTE: Record<TipoIncidente, string> = {
  incendio_estructural: "Incendio estructural",
  forestal: "Forestal",
  vehicular: "Vehicular",
  rescate: "Rescate",
  abeja_enjambre: "Abeja / enjambre",
  inundacion: "Inundación",
  apoyo: "Apoyo",
  otro: "Otro",
};

export const ETIQUETAS_ESTADO_INCIDENTE: Record<EstadoIncidente, string> = {
  borrador: "Borrador",
  cargado: "Cargado",
};

export type PersonalIncidente = {
  bombero_id: string;
  nombre: string;
  cargo?: string;
};

export type Incidente = {
  id: string;
  fecha_hora: string;
  tipo: TipoIncidente;
  direccion: string;
  descripcion: string;
  unidades: string[];
  personal: PersonalIncidente[];
  estado: EstadoIncidente;
  creado_por: string;
  creado_en: string;
  creador_nombre?: string;
};

export function esTipoIncidente(v: unknown): v is TipoIncidente {
  return (
    typeof v === "string" &&
    [
      "incendio_estructural",
      "forestal",
      "vehicular",
      "rescate",
      "abeja_enjambre",
      "inundacion",
      "apoyo",
      "otro",
    ].includes(v)
  );
}

export function esEstadoIncidente(v: unknown): v is EstadoIncidente {
  return v === "borrador" || v === "cargado";
}

export function validarIncidente(row: unknown): row is Incidente {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.fecha_hora === "string" &&
    esTipoIncidente(r.tipo) &&
    typeof r.direccion === "string" &&
    typeof r.descripcion === "string" &&
    Array.isArray(r.unidades) &&
    r.unidades.every((u) => typeof u === "string") &&
    Array.isArray(r.personal) &&
    esEstadoIncidente(r.estado) &&
    typeof r.creado_por === "string" &&
    typeof r.creado_en === "string"
  );
}

export function normalizarPersonal(valor: unknown): PersonalIncidente[] {
  if (!Array.isArray(valor)) return [];
  const salida: PersonalIncidente[] = [];
  for (const item of valor) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.bombero_id === "string" && typeof r.nombre === "string") {
      salida.push({
        bombero_id: r.bombero_id,
        nombre: r.nombre,
        cargo: typeof r.cargo === "string" ? r.cargo : undefined,
      });
    }
  }
  return salida;
}

/** Fecha y franja de guardia actual en America/Argentina/Tucuman. */
export function franjaActualArgentina(now: Date = new Date()): { fecha: string; franja: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Tucuman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const anio = get("year");
  const mes = get("month");
  const dia = get("day");
  const hora = Number(get("hour"));

  const fechaBase = `${anio}-${mes}-${dia}`;
  let fecha = fechaBase;
  let franja = "18:00-23:00";

  if (hora >= 23 || hora < 8) {
    franja = "23:00-08:00";
    if (hora < 8) {
      const d = new Date(`${fechaBase}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      fecha = d.toISOString().slice(0, 10);
    }
  } else if (hora < 13) {
    franja = "08:00-13:00";
  } else if (hora < 18) {
    franja = "13:00-18:00";
  }

  return { fecha, franja };
}

function fechaParaInput(now: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Tucuman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Hora actual de Tucumán como ISO para el input datetime-local. */
export function ahoraParaInput(now: Date = new Date()): string {
  return fechaParaInput(now);
}

/** Convierte una fecha ISO a la hora de Tucumán para el input datetime-local. */
export function isoParaInputTucuman(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return fechaParaInput(d);
}

export function formatearFechaHoraIncidente(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
