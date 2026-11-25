import { guardarIncidenteAction } from "@/app/(tablero)/incidentes/actions";
import { encolarOperacion } from "@/lib/cola-sincronizacion";
import {
  esTipoIncidente,
  isoParaInputTucuman,
  normalizarPersonal,
  type EstadoIncidente,
  type Incidente,
  type PersonalIncidente,
  type TipoIncidente,
} from "@/lib/incidentes";

export type IncidenteBorrador = {
  local_id: string;
  id: string | null;
  fecha_hora: string;
  tipo: TipoIncidente | null;
  direccion: string;
  descripcion: string;
  unidades: string[];
  personal: PersonalIncidente[];
  estado: EstadoIncidente;
};

export type GuardarIncidenteInput = {
  incidenteId?: string | null;
  localId?: string;
  fecha_hora: string;
  tipo: TipoIncidente;
  direccion: string;
  descripcion: string;
  unidades: string[];
  personal: PersonalIncidente[];
  estado: EstadoIncidente;
};

export type GuardarIncidenteResult =
  | { ok: true; data: string; pendiente?: boolean }
  | { ok: false; error: string; offline?: boolean; pendiente?: boolean };

export type IncidenteGuardado = {
  guardar: (input: GuardarIncidenteInput) => Promise<GuardarIncidenteResult>;
  leerBorradorLocal: (usuarioId: string) => IncidenteBorrador | null;
  guardarBorradorLocal: (usuarioId: string, borrador: IncidenteBorrador) => void;
  limpiarBorradorLocal: (usuarioId: string) => void;
};

const CLAVE_BORRADOR = "sigov:incidente:borrador";

function claveBorrador(usuarioId: string): string {
  return `${CLAVE_BORRADOR}:${usuarioId}`;
}

function nuevoLocalId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function crearBorradorVacio(fechaHora: string): IncidenteBorrador {
  return {
    local_id: nuevoLocalId(),
    id: null,
    fecha_hora: fechaHora,
    tipo: null,
    direccion: "",
    descripcion: "",
    unidades: [],
    personal: [],
    estado: "borrador",
  };
}

export function borradorDesdeIncidente(incidente: Incidente): IncidenteBorrador {
  return {
    local_id: incidente.id,
    id: incidente.id,
    fecha_hora: isoParaInputTucuman(incidente.fecha_hora),
    tipo: incidente.tipo,
    direccion: incidente.direccion,
    descripcion: incidente.descripcion,
    unidades: incidente.unidades,
    personal: incidente.personal,
    estado: incidente.estado,
  };
}

/**
 * Guardado desacoplado: si en el futuro se agrega una cola offline,
 * esta capa es el único punto a modificar.
 */
export const incidenteGuardado: IncidenteGuardado = {
  async guardar(input) {
    const claveLocal = input.localId ?? input.incidenteId ?? nuevoLocalId();
    const encolar = async (error: string): Promise<GuardarIncidenteResult> => {
      await encolarOperacion({
        tipo: "incidente",
        accion: "guardar_incidente",
        clave: `incidente:${claveLocal}`,
        payload: { ...input },
      });
      return { ok: false, error, offline: true, pendiente: true };
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return encolar(
        "Guardado en el dispositivo. Se sincronizará cuando vuelva la conexión."
      );
    }

    try {
      return await guardarIncidenteAction(input);
    } catch (err) {
      console.error("Error inesperado al guardar incidente:", err);
      return encolar("Sin conexión. El borrador quedó guardado localmente.");
    }
  },

  leerBorradorLocal(usuarioId) {
    if (typeof window === "undefined" || !usuarioId) return null;
    try {
      const raw = window.localStorage.getItem(claveBorrador(usuarioId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<IncidenteBorrador>;
      if (typeof parsed.fecha_hora !== "string") return null;
      return {
        local_id:
          typeof parsed.local_id === "string" && parsed.local_id ? parsed.local_id : nuevoLocalId(),
        id: typeof parsed.id === "string" ? parsed.id : null,
        fecha_hora: parsed.fecha_hora,
        tipo: esTipoIncidente(parsed.tipo) ? parsed.tipo : null,
        direccion: typeof parsed.direccion === "string" ? parsed.direccion : "",
        descripcion: typeof parsed.descripcion === "string" ? parsed.descripcion : "",
        unidades: Array.isArray(parsed.unidades)
          ? parsed.unidades.filter((u): u is string => typeof u === "string")
          : [],
        personal: normalizarPersonal(parsed.personal),
        estado: parsed.estado === "cargado" ? "cargado" : "borrador",
      };
    } catch {
      return null;
    }
  },

  guardarBorradorLocal(usuarioId, borrador) {
    if (typeof window === "undefined" || !usuarioId) return;
    try {
      window.localStorage.setItem(claveBorrador(usuarioId), JSON.stringify(borrador));
    } catch {
      // best-effort
    }
  },

  limpiarBorradorLocal(usuarioId) {
    if (typeof window === "undefined" || !usuarioId) return;
    try {
      window.localStorage.removeItem(claveBorrador(usuarioId));
    } catch {
      // best-effort
    }
  },
};
