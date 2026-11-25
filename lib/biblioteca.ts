export const BUCKET_BIBLIOTECA = "biblioteca";
export const TAMANO_MAXIMO_BIBLIOTECA = 20 * 1024 * 1024;

export type CategoriaBiblioteca =
  | "manuales"
  | "protocolos"
  | "formularios"
  | "capacitacion";

export const CATEGORIAS_BIBLIOTECA: {
  value: CategoriaBiblioteca;
  label: string;
}[] = [
  { value: "manuales", label: "Manuales" },
  { value: "protocolos", label: "Protocolos" },
  { value: "formularios", label: "Formularios" },
  { value: "capacitacion", label: "Capacitación" },
];

export const ETIQUETAS_CATEGORIA: Record<CategoriaBiblioteca, string> = {
  manuales: "Manuales",
  protocolos: "Protocolos",
  formularios: "Formularios",
  capacitacion: "Capacitación",
};

export type TipoArchivoBiblioteca = "pdf" | "imagen" | "word" | "excel";

export type TipoPermitido = {
  tipo: TipoArchivoBiblioteca;
  label: string;
  mime: string;
  extensiones: readonly string[];
};

export const TIPOS_PERMITIDOS: readonly TipoPermitido[] = [
  {
    tipo: "pdf",
    label: "PDF",
    mime: "application/pdf",
    extensiones: [".pdf"],
  },
  {
    tipo: "imagen",
    label: "Imagen",
    mime: "image/jpeg",
    extensiones: [".jpg", ".jpeg"],
  },
  {
    tipo: "imagen",
    label: "Imagen",
    mime: "image/png",
    extensiones: [".png"],
  },
  {
    tipo: "imagen",
    label: "Imagen",
    mime: "image/webp",
    extensiones: [".webp"],
  },
  {
    tipo: "imagen",
    label: "Imagen",
    mime: "image/gif",
    extensiones: [".gif"],
  },
  {
    tipo: "word",
    label: "Word",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensiones: [".docx"],
  },
  {
    tipo: "excel",
    label: "Excel",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensiones: [".xlsx"],
  },
];

export const MIME_PERMITIDOS: readonly string[] = Array.from(
  new Set(TIPOS_PERMITIDOS.map((tipo) => tipo.mime))
);

export const ACEPTA_BIBLIOTECA = Array.from(
  new Set(TIPOS_PERMITIDOS.flatMap((tipo) => tipo.extensiones))
).join(",");

export type DocumentoBiblioteca = {
  id: string;
  titulo: string;
  categoria: CategoriaBiblioteca;
  descripcion: string;
  archivo_path: string;
  tamano: number;
  tipo_mime: string;
  subido_por: string;
  subido_por_nombre?: string;
  creado_en: string;
  descargas: number;
};

export type PrepararSubidaInput = {
  nombre: string;
  tamano: number;
  tipo: string;
};

export type ConfirmarSubidaInput = {
  path: string;
  titulo: string;
  categoria: CategoriaBiblioteca;
  descripcion: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function esUUID(valor: unknown): valor is string {
  return typeof valor === "string" && UUID_RE.test(valor);
}

export function esCategoriaBiblioteca(
  valor: unknown
): valor is CategoriaBiblioteca {
  return (
    valor === "manuales" ||
    valor === "protocolos" ||
    valor === "formularios" ||
    valor === "capacitacion"
  );
}

export function normalizarMime(valor: unknown): string {
  if (typeof valor !== "string") return "";
  const mime = valor.split(";")[0]?.trim().toLowerCase() ?? "";
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

export function extensionDeNombre(nombre: string): string {
  const limpio = typeof nombre === "string" ? nombre.trim().toLowerCase() : "";
  const punto = limpio.lastIndexOf(".");
  if (punto < 0 || punto === limpio.length - 1) return "";
  return limpio.slice(punto);
}

export function resolverTipoArchivo(
  nombre: string,
  tipoDeclarado: unknown
): TipoPermitido | null {
  const extension = extensionDeNombre(nombre);
  if (!extension) return null;

  const candidatos = TIPOS_PERMITIDOS.filter((tipo) =>
    tipo.extensiones.includes(extension)
  );
  if (candidatos.length === 0) return null;

  const declarado = normalizarMime(tipoDeclarado);
  if (!declarado || declarado === "application/octet-stream") {
    return candidatos[0] ?? null;
  }

  return candidatos.find((tipo) => tipo.mime === declarado) ?? null;
}

export function tipoDocumentoDesdeMime(
  mime: string
): TipoArchivoBiblioteca | null {
  const normalizado = normalizarMime(mime);
  return (
    TIPOS_PERMITIDOS.find((tipo) => tipo.mime === normalizado)?.tipo ?? null
  );
}

export function etiquetaTipoDocumento(mime: string): string {
  const tipo = tipoDocumentoDesdeMime(mime);
  if (!tipo) return "Archivo";
  return (
    TIPOS_PERMITIDOS.find((permitido) => permitido.tipo === tipo)?.label ??
    "Archivo"
  );
}

export function pillTipoDocumento(
  mime: string
): "pdf" | "imagen" | "word" | "excel" | "archivo" {
  return tipoDocumentoDesdeMime(mime) ?? "archivo";
}

export function normalizarDocumento(
  row: unknown
): DocumentoBiblioteca | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;

  const tamano = typeof r.tamano === "number" ? r.tamano : Number(r.tamano);
  const descargas =
    typeof r.descargas === "number" ? r.descargas : Number(r.descargas);

  if (
    !Number.isFinite(tamano) ||
    tamano <= 0 ||
    tamano > TAMANO_MAXIMO_BIBLIOTECA
  ) {
    return null;
  }
  if (!Number.isInteger(descargas) || descargas < 0) return null;

  if (typeof r.id !== "string" || !esUUID(r.id)) return null;
  if (typeof r.titulo !== "string" || !r.titulo.trim()) return null;
  if (!esCategoriaBiblioteca(r.categoria)) return null;
  if (typeof r.descripcion !== "string") return null;
  if (typeof r.archivo_path !== "string" || !r.archivo_path) return null;
  if (typeof r.tipo_mime !== "string" || !r.tipo_mime) return null;
  if (typeof r.subido_por !== "string" || !esUUID(r.subido_por)) return null;
  if (typeof r.creado_en !== "string") return null;

  return {
    id: r.id,
    titulo: r.titulo.trim(),
    categoria: r.categoria,
    descripcion: r.descripcion,
    archivo_path: r.archivo_path,
    tamano,
    tipo_mime: r.tipo_mime,
    subido_por: r.subido_por,
    subido_por_nombre:
      typeof r.subido_por_nombre === "string"
        ? r.subido_por_nombre
        : undefined,
    creado_en: r.creado_en,
    descargas,
  };
}

export function formatearTamanoDocumento(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: 1,
    }).format(mb)} MB`;
  }
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${new Intl.NumberFormat("es-AR").format(kb)} KB`;
}

export function formatearFechaDocumento(
  iso: string,
  incluirHora = false
): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(incluirHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(fecha);
}
