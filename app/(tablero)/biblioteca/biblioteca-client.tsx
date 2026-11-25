"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  Download,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  FileType,
  GraduationCap,
  Image as ImageIcon,
  Library,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Aviso } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { QuickAction } from "@/components/ui/quick-action";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ACEPTA_BIBLIOTECA,
  BUCKET_BIBLIOTECA,
  CATEGORIAS_BIBLIOTECA,
  ETIQUETAS_CATEGORIA,
  TAMANO_MAXIMO_BIBLIOTECA,
  formatearFechaDocumento,
  formatearTamanoDocumento,
  pillTipoDocumento,
  resolverTipoArchivo,
  tipoDocumentoDesdeMime,
  type CategoriaBiblioteca,
  type DocumentoBiblioteca,
} from "@/lib/biblioteca";
import {
  guardarOffline,
  leerOffline,
  quitarOffline,
  type MapaOffline,
} from "@/lib/biblioteca-offline";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import {
  confirmarSubidaAction,
  descargarDocumentoAction,
  eliminarDocumentoAction,
  obtenerDocumentos,
  obtenerUrlVistaAction,
  prepararSubidaAction,
} from "./actions";

type Props = {
  inicial: DocumentoBiblioteca[];
  cargaError: string | null;
  sessionId: string;
  sessionNombre: string;
  esOficial: boolean;
};

type Mensaje = {
  tipo: "ok" | "info" | "alerta" | "error";
  texto: string;
};

const ICONOS_CATEGORIA: Record<CategoriaBiblioteca, LucideIcon> = {
  manuales: BookOpen,
  protocolos: ShieldCheck,
  formularios: ClipboardList,
  capacitacion: GraduationCap,
};

const ICONOS_TIPO: Record<
  "pdf" | "imagen" | "word" | "excel" | "archivo",
  LucideIcon
> = {
  pdf: FileText,
  imagen: ImageIcon,
  word: FileType,
  excel: FileSpreadsheet,
  archivo: File,
};

function iconoDocumento(documento: DocumentoBiblioteca): LucideIcon {
  return ICONOS_TIPO[pillTipoDocumento(documento.tipo_mime)];
}

function esPrevisualizable(mime: string): boolean {
  const tipo = tipoDocumentoDesdeMime(mime);
  return tipo === "pdf" || tipo === "imagen";
}

function pluralDescargas(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? "descarga" : "descargas"}`;
}

export function BibliotecaClient({
  inicial,
  cargaError,
  sessionId,
  sessionNombre,
  esOficial,
}: Props) {
  const [documentos, setDocumentos] = useState<DocumentoBiblioteca[]>(inicial);
  const [errorLista, setErrorLista] = useState<string | null>(cargaError);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<"todas" | CategoriaBiblioteca>(
    "todas"
  );
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [hojaSubir, setHojaSubir] = useState(false);
  const [offline, setOffline] = useState<MapaOffline>({});

  useEffect(() => {
    const id = window.setTimeout(() => {
      setOffline(leerOffline(sessionId));
    }, 0);
    return () => window.clearTimeout(id);
  }, [sessionId]);

  const seleccionado =
    documentos.find((documento) => documento.id === seleccionadoId) ?? null;

  const conteos = useMemo(() => {
    const resultado: Record<CategoriaBiblioteca, number> = {
      manuales: 0,
      protocolos: 0,
      formularios: 0,
      capacitacion: 0,
    };
    for (const documento of documentos) {
      resultado[documento.categoria] += 1;
    }
    return resultado;
  }, [documentos]);

  const visibles = useMemo(() => {
    const consulta = busqueda.trim().toLocaleLowerCase("es-AR");
    return documentos.filter((documento) => {
      if (categoria !== "todas" && documento.categoria !== categoria) {
        return false;
      }
      if (!consulta) return true;
      return documento.titulo.toLocaleLowerCase("es-AR").includes(consulta);
    });
  }, [documentos, busqueda, categoria]);

  const hayFiltros = busqueda.trim().length > 0 || categoria !== "todas";

  const tabs = [
    {
      value: "todas",
      label: "Todos",
      icon: Library,
      badge: documentos.length,
    },
    ...CATEGORIAS_BIBLIOTECA.map((item) => ({
      value: item.value,
      label: item.label,
      icon: ICONOS_CATEGORIA[item.value],
      badge: conteos[item.value],
    })),
  ];

  const refrescar = useCallback(async () => {
    setCargandoLista(true);
    try {
      const resultado = await obtenerDocumentos();
      if (!resultado.ok) {
        setErrorLista(resultado.error);
        return;
      }
      setDocumentos(resultado.data);
      setErrorLista(null);
    } catch (err) {
      console.error("Error inesperado al actualizar biblioteca:", err);
      setErrorLista("No se pudieron cargar los documentos.");
    } finally {
      setCargandoLista(false);
    }
  }, []);

  const abrirSubir = () => {
    setMensaje(null);
    setHojaSubir(true);
  };

  const alSubir = async () => {
    setHojaSubir(false);
    setMensaje({ tipo: "ok", texto: "Documento subido a la biblioteca." });
    await refrescar();
  };

  const alEliminar = async () => {
    setSeleccionadoId(null);
    setMensaje({ tipo: "ok", texto: "Documento eliminado." });
    await refrescar();
  };

  const alDescargar = (documentoId: string, descargas: number) => {
    setDocumentos((actuales) =>
      actuales.map((documento) =>
        documento.id === documentoId ? { ...documento, descargas } : documento
      )
    );
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setCategoria("todas");
  };

  const descripcionLista =
    documentos.length === 0
      ? "Todavía no hay documentos cargados."
      : hayFiltros
        ? `${visibles.length} de ${documentos.length} documentos.`
        : `${documentos.length} documentos disponibles.`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <SectionHeading
        titulo="Biblioteca"
        descripcion="Consultá manuales, protocolos, formularios y material de capacitación del cuartel."
        accion={
          <Button onClick={abrirSubir} className="gap-2">
            <Upload className="h-4 w-4" aria-hidden />
            Subir documento
          </Button>
        }
      />

      {mensaje ? (
        <div className="mt-4">
          <Aviso variante={mensaje.tipo}>{mensaje.texto}</Aviso>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Buscar por título"
            placeholder="Escribí parte del título..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            autoComplete="off"
            containerClassName="flex-1"
          />
          <Button
            variant="secondary"
            onClick={refrescar}
            disabled={cargandoLista}
            className="gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${cargandoLista ? "animate-spin" : ""}`}
              aria-hidden
            />
            Actualizar
          </Button>
        </div>

        <Tabs
          items={tabs}
          value={categoria}
          onChange={(valor) =>
            setCategoria(valor as "todas" | CategoriaBiblioteca)
          }
          ariaLabel="Categorías de la biblioteca"
        />

        <DashboardCard
          titulo="Documentos"
          descripcion={descripcionLista}
          loading={cargandoLista}
          error={errorLista}
        >
          {visibles.length === 0 ? (
            <EstadoVacio
              icono={hayFiltros ? "Search" : "BookOpen"}
              titulo={
                hayFiltros
                  ? "No encontramos documentos"
                  : "Todavía no hay documentos"
              }
              texto={
                hayFiltros
                  ? "Probá con otro título o cambiá la categoría."
                  : "Subí el primer manual, protocolo o formulario del cuartel."
              }
              accion={
                hayFiltros
                  ? { label: "Limpiar filtros", onClick: limpiarFiltros }
                  : { label: "Subir documento", onClick: abrirSubir }
              }
            />
          ) : (
            <ul className="space-y-3">
              {visibles.map((documento) => {
                const Icono = iconoDocumento(documento);
                const esPdf = pillTipoDocumento(documento.tipo_mime) === "pdf";
                const guardado = Boolean(offline[documento.id]);
                const subidoPor =
                  documento.subido_por_nombre ??
                  (documento.subido_por === sessionId
                    ? sessionNombre
                    : "Bombero");

                return (
                  <li key={documento.id}>
                    <button
                      type="button"
                      onClick={() => setSeleccionadoId(documento.id)}
                      className="flex w-full min-h-12 items-start gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-ink-muted/40 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft"
                    >
                      <span
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${
                          esPdf
                            ? "bg-fire-light text-fire-text ring-fire-border"
                            : "bg-bg-subtle text-ink-muted ring-line-subtle"
                        }`}
                      >
                        <Icono className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="break-words font-semibold text-ink">
                            {documento.titulo}
                          </span>
                          <StatusPill
                            estado={pillTipoDocumento(documento.tipo_mime)}
                          />
                          {guardado ? (
                            <StatusPill estado="guardado-offline" />
                          ) : null}
                        </span>
                        {documento.descripcion ? (
                          <span className="mt-1 line-clamp-2 text-[14px] leading-snug text-ink-muted">
                            {documento.descripcion}
                          </span>
                        ) : null}
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink-secondary">
                          <span>{ETIQUETAS_CATEGORIA[documento.categoria]}</span>
                          <span>{formatearTamanoDocumento(documento.tamano)}</span>
                          <span>{formatearFechaDocumento(documento.creado_en)}</span>
                          <span>{pluralDescargas(documento.descargas)}</span>
                          <span>{subidoPor}</span>
                        </span>
                      </span>
                      <ArrowRight
                        className="mt-2 h-4 w-4 shrink-0 text-ink-muted"
                        aria-hidden
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardCard>
      </div>

      {hojaSubir ? (
        <SubirDocumentoHoja
          onCerrar={() => setHojaSubir(false)}
          onSubido={alSubir}
        />
      ) : null}

      {seleccionado ? (
        <DocumentoHoja
          key={seleccionado.id}
          documento={seleccionado}
          sessionId={sessionId}
          sessionNombre={sessionNombre}
          esOficial={esOficial}
          offline={offline}
          onOfflineChange={setOffline}
          onCerrar={() => setSeleccionadoId(null)}
          onEliminado={alEliminar}
          onDescarga={alDescargar}
        />
      ) : null}
    </div>
  );
}

function SubirDocumentoHoja({
  onCerrar,
  onSubido,
}: {
  onCerrar: () => void;
  onSubido: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] =
    useState<CategoriaBiblioteca>("manuales");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const cerrar = () => {
    if (!subiendo) onCerrar();
  };

  const elegirArchivo = (event: ChangeEvent<HTMLInputElement>) => {
    const seleccionado = event.target.files?.[0] ?? null;
    setArchivo(seleccionado);
    setError(null);
    if (!seleccionado) return;

    const tipo = resolverTipoArchivo(seleccionado.name, seleccionado.type);
    if (!tipo) {
      setError(
        "El archivo debe ser PDF, imagen, Word (docx) o Excel (xlsx)."
      );
      return;
    }
    if (seleccionado.size <= 0) {
      setError("El archivo está vacío.");
      return;
    }
    if (seleccionado.size > TAMANO_MAXIMO_BIBLIOTECA) {
      setError("El archivo supera los 20 MB.");
    }
  };

  const subir = async () => {
    if (subiendo) return;
    setError(null);

    const tituloLimpio = titulo.trim();
    if (!tituloLimpio) {
      setError("Ingresá un título.");
      return;
    }
    if (tituloLimpio.length > 200) {
      setError("El título es demasiado largo.");
      return;
    }

    const descripcionLimpia = descripcion.trim();
    if (descripcionLimpia.length > 1000) {
      setError("La descripción es demasiado larga.");
      return;
    }

    if (!archivo) {
      setError("Elegí un archivo.");
      return;
    }

    const tipoArchivo = resolverTipoArchivo(archivo.name, archivo.type);
    if (!tipoArchivo) {
      setError(
        "El archivo debe ser PDF, imagen, Word (docx) o Excel (xlsx)."
      );
      return;
    }
    if (archivo.size <= 0) {
      setError("El archivo está vacío.");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_BIBLIOTECA) {
      setError("El archivo supera los 20 MB.");
      return;
    }

    setSubiendo(true);
    setProgreso("Preparando la subida...");

    try {
      const preparado = await prepararSubidaAction({
        nombre: archivo.name,
        tamano: archivo.size,
        tipo: archivo.type,
      });

      if (!preparado.ok) {
        setError(preparado.error);
        return;
      }

      setProgreso("Subiendo el archivo...");
      const archivoSubida =
        archivo.type === preparado.data.contentType
          ? archivo
          : new Blob([archivo], { type: preparado.data.contentType });
      const supabase = createBrowserSupabaseClient();
      const { error: errorSubida } = await supabase.storage
        .from(BUCKET_BIBLIOTECA)
        .uploadToSignedUrl(
          preparado.data.path,
          preparado.data.token,
          archivoSubida,
          {
            contentType: preparado.data.contentType,
            cacheControl: "3600",
          }
        );

      if (errorSubida) {
        console.error(
          "Error al subir archivo de biblioteca:",
          errorSubida.message
        );
        setError("No se pudo subir el archivo. Volvé a intentar.");
        return;
      }

      setProgreso("Registrando el documento...");
      const confirmado = await confirmarSubidaAction({
        path: preparado.data.path,
        titulo: tituloLimpio,
        categoria,
        descripcion: descripcionLimpia,
      });

      if (!confirmado.ok) {
        setError(confirmado.error);
        return;
      }

      onSubido();
    } catch (err) {
      console.error("Error inesperado al subir documento:", err);
      setError("No se pudo subir el documento. Revisá tu conexión.");
    } finally {
      setSubiendo(false);
      setProgreso(null);
    }
  };

  return (
    <Hoja
      open
      onClose={cerrar}
      title="Subir documento"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            onClick={cerrar}
            disabled={subiendo}
          >
            Cancelar
          </Button>
          <Button onClick={subir} disabled={subiendo} className="gap-2">
            {subiendo ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            {subiendo ? "Subiendo..." : "Subir documento"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Título"
          placeholder="Ej.: Protocolo de incendio estructural"
          value={titulo}
          onChange={(event) => setTitulo(event.target.value)}
          maxLength={200}
          disabled={subiendo}
        />

        <Select
          label="Categoría"
          value={categoria}
          onChange={(event) =>
            setCategoria(event.target.value as CategoriaBiblioteca)
          }
          disabled={subiendo}
        >
          {CATEGORIAS_BIBLIOTECA.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>

        <Textarea
          label="Descripción"
          placeholder="Para qué sirve o cuándo usarlo..."
          value={descripcion}
          onChange={(event) => setDescripcion(event.target.value)}
          maxLength={1000}
          hint="Opcional."
          disabled={subiendo}
        />

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
            Archivo
          </span>
          <label
            htmlFor="biblioteca-archivo"
            className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-dashed border-line bg-bg-subtle px-4 text-[15px] font-semibold text-ink transition-colors hover:border-fire-border hover:bg-surface-hover focus-within:ring-2 focus-within:ring-fire/20"
          >
            <Upload className="h-4 w-4" aria-hidden />
            {archivo ? "Cambiar archivo" : "Elegir archivo"}
          </label>
          <input
            id="biblioteca-archivo"
            type="file"
            accept={ACEPTA_BIBLIOTECA}
            onChange={elegirArchivo}
            disabled={subiendo}
            className="sr-only"
          />
          {archivo ? (
            <p className="text-[14px] text-ink">
              {archivo.name} · {formatearTamanoDocumento(archivo.size)}
            </p>
          ) : (
            <p className="text-[13px] text-ink-muted">
              PDF, imágenes, Word (docx) o Excel (xlsx). Máximo 20 MB.
            </p>
          )}
        </div>

        {error ? <Aviso variante="error">{error}</Aviso> : null}

        {progreso ? (
          <p
            className="flex items-center gap-2 text-[14px] text-ink-muted"
            aria-live="polite"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {progreso}
          </p>
        ) : null}
      </div>
    </Hoja>
  );
}

function DocumentoHoja({
  documento,
  sessionId,
  sessionNombre,
  esOficial,
  offline,
  onOfflineChange,
  onCerrar,
  onEliminado,
  onDescarga,
}: {
  documento: DocumentoBiblioteca;
  sessionId: string;
  sessionNombre: string;
  esOficial: boolean;
  offline: MapaOffline;
  onOfflineChange: (mapa: MapaOffline) => void;
  onCerrar: () => void;
  onEliminado: () => void;
  onDescarga: (documentoId: string, descargas: number) => void;
}) {
  const [preview, setPreview] = useState<{ url: string } | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{
    tipo: "ok" | "info";
    texto: string;
  } | null>(null);

  const previsualizable = esPrevisualizable(documento.tipo_mime);
  const guardadoOffline = Boolean(offline[documento.id]);
  const puedeBorrar = esOficial || documento.subido_por === sessionId;
  const subidoPor =
    documento.subido_por_nombre ??
    (documento.subido_por === sessionId ? sessionNombre : "Bombero");

  const verPreview = async () => {
    if (!previsualizable) {
      setError(
        "La vista previa no está disponible para este formato. Descargalo para verlo."
      );
      return;
    }
    setCargandoPreview(true);
    setError(null);
    try {
      const resultado = await obtenerUrlVistaAction(documento.id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setPreview({ url: resultado.data.url });
    } catch (err) {
      console.error("Error inesperado al abrir vista previa:", err);
      setError("No se pudo abrir la vista previa.");
    } finally {
      setCargandoPreview(false);
    }
  };

  const descargar = async () => {
    setDescargando(true);
    setError(null);
    try {
      const resultado = await descargarDocumentoAction(documento.id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      const enlace = document.createElement("a");
      enlace.href = resultado.data.url;
      enlace.target = "_blank";
      enlace.rel = "noopener noreferrer";
      enlace.click();
      onDescarga(documento.id, resultado.data.descargas);
    } catch (err) {
      console.error("Error inesperado al descargar documento:", err);
      setError("No se pudo preparar la descarga.");
    } finally {
      setDescargando(false);
    }
  };

  const alternarOffline = () => {
    setError(null);
    setAviso(null);

    if (guardadoOffline) {
      const mapa = quitarOffline(sessionId, documento.id);
      if (!mapa) {
        setError("No pudimos actualizar el guardado sin conexión.");
        return;
      }
      onOfflineChange(mapa);
      setAviso({ tipo: "info", texto: "Se quitó la ficha de sin conexión." });
      return;
    }

    const mapa = guardarOffline(sessionId, documento);
    if (!mapa) {
      setError("No pudimos guardar la ficha en este dispositivo.");
      return;
    }
    onOfflineChange(mapa);
    setAviso({
      tipo: "ok",
      texto: "Ficha guardada para consultar sin conexión.",
    });
  };

  const eliminar = async () => {
    setEliminando(true);
    setError(null);
    try {
      const resultado = await eliminarDocumentoAction(documento.id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      onEliminado();
    } catch (err) {
      console.error("Error inesperado al eliminar documento:", err);
      setError("No se pudo eliminar el documento.");
    } finally {
      setEliminando(false);
    }
  };

  return (
    <Hoja
      open
      onClose={onCerrar}
      title={documento.titulo}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {previsualizable ? (
            <Button
              variant="secondary"
              onClick={verPreview}
              disabled={cargandoPreview}
              className="gap-2"
            >
              {cargandoPreview ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
              {preview ? "Actualizar vista" : "Vista previa"}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={descargar}
            disabled={descargando}
            className="gap-2"
          >
            {descargando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            Descargar
          </Button>
          {puedeBorrar ? (
            <Button
              variant="danger"
              onClick={() => {
                setConfirmarEliminar(true);
                setError(null);
              }}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              Eliminar
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill estado={pillTipoDocumento(documento.tipo_mime)} />
          <span className="inline-flex min-h-8 items-center rounded-full border border-line bg-bg-subtle px-3 py-1 text-[13px] font-semibold text-ink-muted">
            {ETIQUETAS_CATEGORIA[documento.categoria]}
          </span>
          <span className="font-mono text-[13px] text-ink-muted">
            {formatearTamanoDocumento(documento.tamano)}
          </span>
        </div>

        <p className="whitespace-pre-wrap text-[16px] leading-relaxed text-ink">
          {documento.descripcion || "Sin descripción."}
        </p>

        <dl className="grid gap-3 rounded-xl border border-line-subtle bg-bg-subtle p-3 text-[14px] sm:grid-cols-2">
          <div>
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Subido por
            </dt>
            <dd className="mt-0.5 text-ink">{subidoPor}</dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Fecha
            </dt>
            <dd className="mt-0.5 text-ink">
              {formatearFechaDocumento(documento.creado_en, true)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Descargas
            </dt>
            <dd className="mt-0.5 text-ink">
              {pluralDescargas(documento.descargas)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Archivo
            </dt>
            <dd className="mt-0.5 text-ink">
              {formatearTamanoDocumento(documento.tamano)}
            </dd>
          </div>
        </dl>

        <QuickAction
          icono={guardadoOffline ? WifiOff : Download}
          titulo={
            guardadoOffline
              ? "Quitar de sin conexión"
              : "Guardar sin conexión"
          }
          descripcion={
            guardadoOffline
              ? "La ficha está guardada en este dispositivo."
              : "Guardá la ficha para consultarla cuando no tengas señal."
          }
          onClick={alternarOffline}
        />
        <p className="text-[13px] leading-relaxed text-ink-muted">
          {guardadoOffline
            ? "El archivo se sumará al caché sin conexión en una próxima actualización."
            : "Se guarda la ficha del documento. El archivo se sumará al caché sin conexión en una próxima actualización."}
        </p>

        {error ? <Aviso variante="error">{error}</Aviso> : null}
        {aviso ? <Aviso variante={aviso.tipo}>{aviso.texto}</Aviso> : null}

        {confirmarEliminar ? (
          <Aviso variante="alerta" titulo="¿Eliminar el documento?">
            <p className="text-[15px]">Esta acción no se puede deshacer.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={eliminar}
                disabled={eliminando}
                className="gap-2"
              >
                {eliminando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
                Eliminar documento
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmarEliminar(false)}
                disabled={eliminando}
              >
                Cancelar
              </Button>
            </div>
          </Aviso>
        ) : null}

        {!previsualizable ? (
          <Aviso variante="info">
            La vista previa no está disponible para Word o Excel. Descargalo
            para verlo.
          </Aviso>
        ) : null}

        {preview ? (
          <div className="space-y-2">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Vista previa
            </p>
            <iframe
              src={preview.url}
              title={`Vista previa de ${documento.titulo}`}
              className="h-[60vh] w-full rounded-xl border border-line bg-bg-subtle"
            />
          </div>
        ) : null}
      </div>
    </Hoja>
  );
}
