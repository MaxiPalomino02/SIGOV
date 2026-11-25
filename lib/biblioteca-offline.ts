import {
  esCategoriaBiblioteca,
  esUUID,
  type CategoriaBiblioteca,
  type DocumentoBiblioteca,
} from "@/lib/biblioteca";

export type DocumentoOffline = {
  id: string;
  titulo: string;
  categoria: CategoriaBiblioteca;
  tipo_mime: string;
  tamano: number;
  archivo_path: string;
  guardado_en: string;
};

export type MapaOffline = Record<string, DocumentoOffline>;

const CLAVE = "sigov:biblioteca:offline";

function claveOffline(usuarioId: string): string {
  return `${CLAVE}:${usuarioId}`;
}

function leerMapa(usuarioId: string): MapaOffline {
  if (typeof window === "undefined" || !usuarioId) return {};
  try {
    const raw = window.localStorage.getItem(claveOffline(usuarioId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return {};

    const mapa: MapaOffline = {};
    for (const [id, valor] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      if (typeof valor !== "object" || valor === null) continue;
      const r = valor as Record<string, unknown>;
      const tamano = typeof r.tamano === "number" ? r.tamano : Number(r.tamano);

      if (!esUUID(id)) continue;
      if (typeof r.titulo !== "string" || !r.titulo.trim()) continue;
      if (!esCategoriaBiblioteca(r.categoria)) continue;
      if (typeof r.tipo_mime !== "string" || !r.tipo_mime) continue;
      if (!Number.isFinite(tamano) || tamano <= 0) continue;
      if (typeof r.archivo_path !== "string" || !r.archivo_path) continue;
      if (typeof r.guardado_en !== "string") continue;

      mapa[id] = {
        id,
        titulo: r.titulo,
        categoria: r.categoria,
        tipo_mime: r.tipo_mime,
        tamano,
        archivo_path: r.archivo_path,
        guardado_en: r.guardado_en,
      };
    }
    return mapa;
  } catch {
    return {};
  }
}

function escribirMapa(
  usuarioId: string,
  mapa: MapaOffline
): MapaOffline | null {
  if (typeof window === "undefined" || !usuarioId) return null;
  try {
    window.localStorage.setItem(claveOffline(usuarioId), JSON.stringify(mapa));
    return mapa;
  } catch {
    return null;
  }
}

export function leerOffline(usuarioId: string): MapaOffline {
  return leerMapa(usuarioId);
}

export function guardarOffline(
  usuarioId: string,
  documento: DocumentoBiblioteca
): MapaOffline | null {
  const mapa = leerMapa(usuarioId);
  mapa[documento.id] = {
    id: documento.id,
    titulo: documento.titulo,
    categoria: documento.categoria,
    tipo_mime: documento.tipo_mime,
    tamano: documento.tamano,
    archivo_path: documento.archivo_path,
    guardado_en: new Date().toISOString(),
  };
  return escribirMapa(usuarioId, mapa);
}

export function quitarOffline(
  usuarioId: string,
  documentoId: string
): MapaOffline | null {
  const mapa = leerMapa(usuarioId);
  delete mapa[documentoId];
  return escribirMapa(usuarioId, mapa);
}
