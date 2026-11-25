"use server";

import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";
import {
  BUCKET_BIBLIOTECA,
  TAMANO_MAXIMO_BIBLIOTECA,
  esCategoriaBiblioteca,
  esUUID,
  extensionDeNombre,
  normalizarDocumento,
  normalizarMime,
  resolverTipoArchivo,
  type ConfirmarSubidaInput,
  type DocumentoBiblioteca,
  type PrepararSubidaInput,
} from "@/lib/biblioteca";

export type ResultadoDocumentos =
  | { ok: true; data: DocumentoBiblioteca[] }
  | { ok: false; error: string };

export type ResultadoPrepararSubida =
  | {
      ok: true;
      data: {
        path: string;
        token: string;
        signedUrl: string;
        contentType: string;
      };
    }
  | { ok: false; error: string };

export type ResultadoConfirmarSubida =
  | { ok: true; data: string }
  | { ok: false; error: string };

export type ResultadoUrlVista =
  | { ok: true; data: { url: string; tipo_mime: string; titulo: string } }
  | { ok: false; error: string };

export type ResultadoDescarga =
  | { ok: true; data: { url: string; descargas: number } }
  | { ok: false; error: string };

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

const PATH_RE =
  /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(pdf|jpe?g|png|webp|gif|docx|xlsx)$/i;

const MIME_DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MIME_XLSX =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function mapError(
  error: { code?: string; message?: string },
  fallback: string
): string {
  if (error.code === "P0001") {
    const mensajes: Record<string, string> = {
      BOMBERO_INACTIVO: "Tu usuario no está activo.",
      TITULO_REQUERIDO: "Ingresá un título.",
      TITULO_LARGO: "El título es demasiado largo.",
      CATEGORIA_INVALIDA: "Elegí una categoría válida.",
      DESCRIPCION_LARGA: "La descripción es demasiado larga.",
      ARCHIVO_REQUERIDO: "Falta el archivo.",
      ARCHIVO_INVALIDO: "El archivo no es válido.",
      TIPO_INVALIDO: "El tipo de archivo no es válido.",
      TAMANO_INVALIDO: "El archivo supera el tamaño permitido.",
      ARCHIVO_DUPLICADO: "Este archivo ya fue registrado.",
      DOCUMENTO_NO_ENCONTRADO: "No encontramos ese documento.",
      SIN_PERMISO: "No tenés permiso para eliminar este documento.",
    };
    return mensajes[error.message ?? ""] ?? fallback;
  }
  return fallback;
}

function nombreDescarga(documento: DocumentoBiblioteca): string {
  const extension = extensionDeNombre(documento.archivo_path);
  const base =
    documento.titulo
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s.-]/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80) || "documento";
  return `${base}${extension}`;
}

function firmaValida(mime: string, bytes: Uint8Array): boolean {
  const normalizado = normalizarMime(mime);

  if (normalizado === "application/pdf") {
    const texto = new TextDecoder("latin1").decode(bytes.slice(0, 1024));
    return texto.includes("%PDF-");
  }

  if (normalizado === "image/jpeg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  if (normalizado === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (normalizado === "image/gif") {
    const texto = new TextDecoder("latin1").decode(bytes.slice(0, 6));
    return texto === "GIF87a" || texto === "GIF89a";
  }

  if (normalizado === "image/webp") {
    const texto = new TextDecoder("latin1").decode(bytes.slice(0, 12));
    return texto.startsWith("RIFF") && texto.slice(8, 12) === "WEBP";
  }

  if (normalizado === MIME_DOCX || normalizado === MIME_XLSX) {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      bytes[2] === 0x03 &&
      bytes[3] === 0x04
    );
  }

  return false;
}

async function eliminarObjeto(
  supabase: ReturnType<typeof createServiceRoleClient>,
  path: string
): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_BIBLIOTECA)
      .remove([path]);
    if (error) {
      console.error("Error al eliminar archivo de biblioteca:", error.message);
    }
  } catch (err) {
    console.error("Error inesperado al eliminar archivo de biblioteca:", err);
  }
}

export async function obtenerDocumentos(): Promise<ResultadoDocumentos> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("documentos")
      .select("*, autor:bomberos!documentos_subido_por_fkey(nombre_completo)")
      .order("creado_en", { ascending: false })
      .limit(500);

    if (error) {
      console.error("Error al cargar documentos:", error.message);
      return {
        ok: false,
        error:
          "No se pudieron cargar los documentos. Revisá que la migración de la biblioteca esté aplicada.",
      };
    }

    const documentos: DocumentoBiblioteca[] = [];
    for (const row of data ?? []) {
      const registro = row as unknown as Record<string, unknown>;
      const autorRaw = registro.autor;
      const autor = Array.isArray(autorRaw) ? autorRaw[0] : autorRaw;
      const nombreAutor =
        autor && typeof autor === "object"
          ? (autor as { nombre_completo?: unknown }).nombre_completo
          : undefined;

      const documento = normalizarDocumento({
        ...registro,
        subido_por_nombre:
          typeof nombreAutor === "string" ? nombreAutor : undefined,
      });
      if (documento) documentos.push(documento);
    }

    return { ok: true, data: documentos };
  } catch (err) {
    console.error("Error inesperado al cargar documentos:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function obtenerDocumentosIniciales(): Promise<{
  documentos: DocumentoBiblioteca[];
  error: string | null;
}> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");

  const resultado = await obtenerDocumentos();
  if (!resultado.ok) return { documentos: [], error: resultado.error };
  return { documentos: resultado.data, error: null };
}

export async function prepararSubidaAction(
  input: PrepararSubidaInput
): Promise<ResultadoPrepararSubida> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };

  const nombre = typeof input?.nombre === "string" ? input.nombre.trim() : "";
  const tamano = Number(input?.tamano);
  const tipo = typeof input?.tipo === "string" ? input.tipo : "";

  if (!nombre) return { ok: false, error: "Elegí un archivo." };

  const tipoArchivo = resolverTipoArchivo(nombre, tipo);
  if (!tipoArchivo) {
    return {
      ok: false,
      error: "El archivo debe ser PDF, imagen, Word (docx) o Excel (xlsx).",
    };
  }

  const extension = extensionDeNombre(nombre);
  if (!extension || !tipoArchivo.extensiones.includes(extension)) {
    return { ok: false, error: "La extensión del archivo no es válida." };
  }

  if (!Number.isFinite(tamano) || tamano <= 0) {
    return { ok: false, error: "El archivo está vacío o no es válido." };
  }

  if (tamano > TAMANO_MAXIMO_BIBLIOTECA) {
    return { ok: false, error: "El archivo supera los 20 MB." };
  }

  try {
    const supabase = createServiceRoleClient();
    const path = `${session.bombero_id}/${crypto.randomUUID()}${extension}`;
    const { data, error } = await supabase.storage
      .from(BUCKET_BIBLIOTECA)
      .createSignedUploadUrl(path);

    if (error || !data?.signedUrl || !data.token) {
      console.error(
        "Error al preparar subida de biblioteca:",
        error?.message ?? "sin datos"
      );
      return {
        ok: false,
        error:
          "No se pudo preparar la subida. Revisá que el bucket de la biblioteca exista.",
      };
    }

    return {
      ok: true,
      data: {
        path,
        token: data.token,
        signedUrl: data.signedUrl,
        contentType: tipoArchivo.mime,
      },
    };
  } catch (err) {
    console.error("Error inesperado al preparar subida de biblioteca:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function confirmarSubidaAction(
  input: ConfirmarSubidaInput
): Promise<ResultadoConfirmarSubida> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };

  const path = typeof input?.path === "string" ? input.path.trim() : "";
  const titulo = typeof input?.titulo === "string" ? input.titulo.trim() : "";
  const descripcion =
    typeof input?.descripcion === "string" ? input.descripcion.trim() : "";
  const categoria = input?.categoria;

  const match = PATH_RE.exec(path);
  if (
    !match ||
    match[1]?.toLowerCase() !== session.bombero_id.toLowerCase()
  ) {
    return { ok: false, error: "El archivo no es válido." };
  }

  if (!titulo) return { ok: false, error: "Ingresá un título." };
  if (titulo.length > 200) {
    return { ok: false, error: "El título es demasiado largo." };
  }
  if (!esCategoriaBiblioteca(categoria)) {
    return { ok: false, error: "Elegí una categoría válida." };
  }
  if (descripcion.length > 1000) {
    return { ok: false, error: "La descripción es demasiado larga." };
  }

  try {
    const supabase = createServiceRoleClient();

    const { data: existente, error: errorExistente } = await supabase
      .from("documentos")
      .select("id, subido_por")
      .eq("archivo_path", path)
      .maybeSingle();

    if (errorExistente) {
      console.error(
        "Error al verificar documento existente:",
        errorExistente.message
      );
      return {
        ok: false,
        error:
          "No se pudo registrar el documento. Revisá que la migración de la biblioteca esté aplicada.",
      };
    }

    if (existente) {
      if (existente.subido_por === session.bombero_id) {
        return { ok: true, data: existente.id };
      }
      return { ok: false, error: "Este archivo ya fue registrado." };
    }

    const { data: info, error: infoError } = await supabase.storage
      .from(BUCKET_BIBLIOTECA)
      .info(path);

    if (infoError || !info) {
      console.error(
        "Error al leer información del archivo:",
        infoError?.message ?? "sin datos"
      );
      return {
        ok: false,
        error: "No encontramos el archivo subido. Volvé a intentar.",
      };
    }

    const { data: blob, error: downloadError } = await supabase.storage
      .from(BUCKET_BIBLIOTECA)
      .download(path);

    if (downloadError || !blob) {
      console.error(
        "Error al verificar archivo de biblioteca:",
        downloadError?.message ?? "sin datos"
      );
      await eliminarObjeto(supabase, path);
      return {
        ok: false,
        error: "No pudimos verificar el archivo. Volvé a intentar.",
      };
    }

    if (blob.size <= 0 || blob.size > TAMANO_MAXIMO_BIBLIOTECA) {
      await eliminarObjeto(supabase, path);
      return {
        ok: false,
        error: "El archivo supera los 20 MB o está vacío.",
      };
    }

    const tipoArchivo = resolverTipoArchivo(path, info.contentType ?? "");
    if (!tipoArchivo) {
      await eliminarObjeto(supabase, path);
      return { ok: false, error: "El tipo de archivo no es válido." };
    }

    const firma = new Uint8Array(
      await blob.slice(0, 1024).arrayBuffer()
    );
    if (!firmaValida(tipoArchivo.mime, firma)) {
      await eliminarObjeto(supabase, path);
      return {
        ok: false,
        error: "El contenido del archivo no coincide con el tipo declarado.",
      };
    }

    const { data, error } = await supabase.rpc("registrar_documento", {
      p_bombero_id: session.bombero_id,
      p_titulo: titulo,
      p_categoria: categoria,
      p_descripcion: descripcion,
      p_archivo_path: path,
      p_tamano: blob.size,
      p_tipo_mime: tipoArchivo.mime,
    });

    if (error) {
      console.error("Error al registrar documento:", error.message);
      if (error.message !== "ARCHIVO_DUPLICADO") {
        await eliminarObjeto(supabase, path);
      }
      return {
        ok: false,
        error: mapError(error, "No se pudo registrar el documento."),
      };
    }

    if (typeof data !== "string" || !esUUID(data)) {
      return { ok: false, error: "No se pudo registrar el documento." };
    }

    return { ok: true, data };
  } catch (err) {
    console.error("Error inesperado al registrar documento:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function obtenerUrlVistaAction(
  documentoId: string
): Promise<ResultadoUrlVista> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };
  if (!esUUID(documentoId)) {
    return { ok: false, error: "Documento inválido." };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("documentos")
      .select("titulo, archivo_path, tipo_mime")
      .eq("id", documentoId)
      .maybeSingle();

    if (error || !data) {
      console.error(
        "Error al cargar documento para vista previa:",
        error?.message ?? "sin datos"
      );
      return { ok: false, error: "No encontramos ese documento." };
    }

    if (
      typeof data.archivo_path !== "string" ||
      typeof data.titulo !== "string" ||
      typeof data.tipo_mime !== "string"
    ) {
      return { ok: false, error: "No encontramos ese documento." };
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from(BUCKET_BIBLIOTECA)
      .createSignedUrl(data.archivo_path, 120);

    if (urlError || !urlData?.signedUrl) {
      console.error(
        "Error al crear URL de vista previa:",
        urlError?.message ?? "sin datos"
      );
      return { ok: false, error: "No se pudo abrir la vista previa." };
    }

    return {
      ok: true,
      data: {
        url: urlData.signedUrl,
        tipo_mime: data.tipo_mime,
        titulo: data.titulo,
      },
    };
  } catch (err) {
    console.error("Error inesperado al abrir vista previa:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function descargarDocumentoAction(
  documentoId: string
): Promise<ResultadoDescarga> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };
  if (!esUUID(documentoId)) {
    return { ok: false, error: "Documento inválido." };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("documentos")
      .select(
        "id, titulo, categoria, descripcion, archivo_path, tamano, tipo_mime, subido_por, creado_en, descargas"
      )
      .eq("id", documentoId)
      .maybeSingle();

    if (error || !data) {
      console.error(
        "Error al cargar documento para descarga:",
        error?.message ?? "sin datos"
      );
      return { ok: false, error: "No encontramos ese documento." };
    }

    const documento = normalizarDocumento(data);
    if (!documento) {
      return { ok: false, error: "No encontramos ese documento." };
    }

    const { data: urlData, error: urlError } = await supabase.storage
      .from(BUCKET_BIBLIOTECA)
      .createSignedUrl(documento.archivo_path, 120, {
        download: nombreDescarga(documento),
      });

    if (urlError || !urlData?.signedUrl) {
      console.error(
        "Error al crear URL de descarga:",
        urlError?.message ?? "sin datos"
      );
      return { ok: false, error: "No se pudo preparar la descarga." };
    }

    const { data: nuevasDescargas, error: rpcError } = await supabase.rpc(
      "registrar_descarga_documento",
      { p_documento_id: documento.id }
    );

    if (rpcError) {
      console.error(
        "Error al registrar descarga de documento:",
        rpcError.message
      );
      return {
        ok: true,
        data: {
          url: urlData.signedUrl,
          descargas: documento.descargas,
        },
      };
    }

    const descargas =
      typeof nuevasDescargas === "number" &&
      Number.isInteger(nuevasDescargas) &&
      nuevasDescargas >= 0
        ? nuevasDescargas
        : documento.descargas;

    return {
      ok: true,
      data: { url: urlData.signedUrl, descargas },
    };
  } catch (err) {
    console.error("Error inesperado al preparar descarga:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}

export async function eliminarDocumentoAction(
  documentoId: string
): Promise<ResultadoAccion> {
  const session = await getSessionActiva();
  if (!session) return { ok: false, error: "Sesión no válida o expirada." };
  if (!esUUID(documentoId)) {
    return { ok: false, error: "Documento inválido." };
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase.rpc("borrar_documento", {
      p_bombero_id: session.bombero_id,
      p_documento_id: documentoId,
    });

    if (error) {
      console.error("Error al eliminar documento:", error.message);
      return {
        ok: false,
        error: mapError(error, "No se pudo eliminar el documento."),
      };
    }

    if (typeof data === "string" && data) {
      await eliminarObjeto(supabase, data);
    }

    return { ok: true };
  } catch (err) {
    console.error("Error inesperado al eliminar documento:", err);
    return { ok: false, error: "Error inesperado. Volvé a intentar." };
  }
}
