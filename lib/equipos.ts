export type EstadoEquipo = "operativo" | "en_reparacion" | "baja";

export const ESTADOS_EQUIPO: EstadoEquipo[] = ["operativo", "en_reparacion", "baja"];

export const ETIQUETAS_ESTADO_EQUIPO: Record<EstadoEquipo, string> = {
  operativo: "Operativo",
  en_reparacion: "En reparación",
  baja: "Baja",
};

export type Equipo = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  ubicacion: string;
  estado: EstadoEquipo;
  notas: string;
  foto_path: string | null;
  creado_en: string;
  actualizado_en: string;
};

export type EquipoMovimiento = {
  id: string;
  equipo_id: string;
  accion: string;
  bombero_id: string;
  bombero_nombre?: string;
  nota: string;
  fecha: string;
};

export function esEstadoEquipo(v: unknown): v is EstadoEquipo {
  return v === "operativo" || v === "en_reparacion" || v === "baja";
}

export function validarEquipo(row: unknown): row is Equipo {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.codigo === "string" &&
    typeof r.nombre === "string" &&
    typeof r.categoria === "string" &&
    typeof r.ubicacion === "string" &&
    esEstadoEquipo(r.estado) &&
    typeof r.notas === "string" &&
    (typeof r.foto_path === "string" || r.foto_path === null) &&
    typeof r.creado_en === "string" &&
    typeof r.actualizado_en === "string"
  );
}

export function validarMovimiento(row: unknown): row is EquipoMovimiento {
  if (typeof row !== "object" || row === null) return false;
  const r = row as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.equipo_id === "string" &&
    typeof r.accion === "string" &&
    typeof r.bombero_id === "string" &&
    typeof r.nota === "string" &&
    typeof r.fecha === "string"
  );
}

export function etiquetaAccionMovimiento(accion: string): string {
  if (accion === "alta") return "Alta";
  if (accion === "edicion") return "Edición";
  if (accion.startsWith("cambio_estado:")) {
    const parte = accion.replace("cambio_estado:", "");
    const [desde, hacia] = parte.split("->");
    const d = esEstadoEquipo(desde) ? ETIQUETAS_ESTADO_EQUIPO[desde] : desde;
    const h = esEstadoEquipo(hacia) ? ETIQUETAS_ESTADO_EQUIPO[hacia] : hacia;
    return `Cambio de estado: ${d} → ${h}`;
  }
  return accion;
}
