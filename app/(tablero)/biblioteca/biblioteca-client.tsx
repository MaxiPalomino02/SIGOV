"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Download, Ellipsis, FileSpreadsheet, FileText, FileType, Image as ImageIcon, Loader2, Trash2, Upload, WifiOff, X } from "lucide-react";
import { Aviso } from "@/components/ui/aviso";
import { Buscador } from "@/components/ui/buscador";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Segmentado } from "@/components/ui/segmentado";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ACEPTA_BIBLIOTECA, BUCKET_BIBLIOTECA, CATEGORIAS_BIBLIOTECA, TAMANO_MAXIMO_BIBLIOTECA, formatearFechaDocumento, formatearTamanoDocumento, pillTipoDocumento, resolverTipoArchivo, tipoDocumentoDesdeMime, type CategoriaBiblioteca, type DocumentoBiblioteca } from "@/lib/biblioteca";
import { guardarOffline, leerOffline, quitarOffline, type MapaOffline } from "@/lib/biblioteca-offline";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { confirmarSubidaAction, descargarDocumentoAction, eliminarDocumentoAction, obtenerDocumentos, obtenerUrlVistaAction, prepararSubidaAction } from "./actions";

type Props = { inicial: DocumentoBiblioteca[]; cargaError: string | null; sessionId: string; sessionNombre: string; esOficial: boolean };
type Mensaje = { tipo: "ok" | "info" | "alerta" | "error"; texto: string };
const CATEGORIAS_UI: { valor: "todas" | CategoriaBiblioteca; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todos" }, { valor: "manuales", etiqueta: "Manuales" }, { valor: "protocolos", etiqueta: "Protocolos" }, { valor: "formularios", etiqueta: "Formularios" }, { valor: "capacitacion", etiqueta: "Capacitación" },
];
function etiquetaCategoria(cat: CategoriaBiblioteca): string { return CATEGORIAS_UI.find((c) => c.valor === cat)?.etiqueta ?? cat; }
function esPrevisualizable(mime: string): boolean { const tipo = tipoDocumentoDesdeMime(mime); return tipo === "pdf" || tipo === "imagen"; }
function IconoTipo({ mime }: { mime: string }) {
  const tipo = pillTipoDocumento(mime);
  const base = "flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]";
  if (tipo === "pdf") return <span className={`${base} bg-red-tint text-red`}><FileText size={22} strokeWidth={1.75} aria-hidden /></span>;
  if (tipo === "imagen") return <span className={`${base} bg-yellow-tint text-yellow-ink`}><ImageIcon size={22} strokeWidth={1.75} aria-hidden /></span>;
  if (tipo === "word" || tipo === "excel") {
    const Icono = tipo === "word" ? FileType : FileSpreadsheet;
    return <span className={`${base} bg-surface-2 text-label-2`}><Icono size={22} strokeWidth={1.75} aria-hidden /></span>;
  }
  return <span className={`${base} bg-surface-2 text-label-2`}><FileText size={22} strokeWidth={1.75} aria-hidden /></span>;
}

export function BibliotecaClient({ inicial, cargaError, sessionId, sessionNombre, esOficial }: Props) {
  const [documentos, setDocumentos] = useState<DocumentoBiblioteca[]>(inicial);
  const [errorLista, setErrorLista] = useState<string | null>(cargaError);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState<"todas" | CategoriaBiblioteca>("todas");
  const [mensaje, setMensaje] = useState<Mensaje | null>(null);
  const [hojaSubir, setHojaSubir] = useState(false);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [offline, setOffline] = useState<MapaOffline>({});
  const [guardandoOfflineId, setGuardandoOfflineId] = useState<string | null>(null);

  useEffect(() => { const id = window.setTimeout(() => setOffline(leerOffline(sessionId)), 0); return () => window.clearTimeout(id); }, [sessionId]);
  useEffect(() => {
    if (!menuId) return;
    const cerrar = (e: MouseEvent) => { const t = e.target as HTMLElement | null; if (t?.closest("[data-menu-biblioteca]")) return; setMenuId(null); };
    document.addEventListener("click", cerrar);
    return () => document.removeEventListener("click", cerrar);
  }, [menuId]);

  const detalle = documentos.find((d) => d.id === detalleId) ?? null;
  const previewDoc = documentos.find((d) => d.id === previewId) ?? null;
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase("es-AR");
    return documentos.filter((d) => (categoria === "todas" || d.categoria === categoria) && (!q || d.titulo.toLocaleLowerCase("es-AR").includes(q)));
  }, [documentos, busqueda, categoria]);

  const refrescar = useCallback(async () => {
    setCargandoLista(true);
    try {
      const r = await obtenerDocumentos();
      if (!r.ok) { setErrorLista(r.error); return; }
      setDocumentos(r.data); setErrorLista(null);
    } catch { setErrorLista("No se pudieron cargar los documentos."); }
    finally { setCargandoLista(false); }
  }, []);

  const onDescarga = useCallback((id: string, descargas: number) => { setDocumentos((a) => a.map((d) => d.id === id ? { ...d, descargas } : d)); }, []);
  const descargarDirecto = useCallback(async (doc: DocumentoBiblioteca) => {
    setMensaje(null);
    try {
      const r = await descargarDocumentoAction(doc.id);
      if (!r.ok) { setMensaje({ tipo: "error", texto: r.error }); return; }
      const a = document.createElement("a"); a.href = r.data.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.click();
      onDescarga(doc.id, r.data.descargas);
    } catch { setMensaje({ tipo: "error", texto: "No se pudo preparar la descarga." }); }
  }, [onDescarga]);

  const alternarOffline = useCallback((doc: DocumentoBiblioteca) => {
    setGuardandoOfflineId(doc.id); setMensaje(null);
    try {
      const guardado = Boolean(offline[doc.id]);
      const mapa = guardado ? quitarOffline(sessionId, doc.id) : guardarOffline(sessionId, doc);
      if (!mapa) { setMensaje({ tipo: "error", texto: "No pudimos actualizar el guardado sin conexión." }); return; }
      setOffline(mapa);
    } finally { window.setTimeout(() => setGuardandoOfflineId(null), 250); }
  }, [offline, sessionId]);

  const eliminar = useCallback(async (doc: DocumentoBiblioteca) => {
    setMensaje(null);
    const r = await eliminarDocumentoAction(doc.id);
    if (!r.ok) { setMensaje({ tipo: "error", texto: r.error }); return; }
    setDetalleId(null); setPreviewId(null); setMenuId(null);
    setMensaje({ tipo: "ok", texto: "Documento eliminado." }); await refrescar();
  }, [refrescar]);

  const alSubir = async () => { setHojaSubir(false); setMensaje({ tipo: "ok", texto: "Documento subido a la biblioteca." }); await refrescar(); };
  const abrirDoc = (doc: DocumentoBiblioteca) => { setMenuId(null); if (esPrevisualizable(doc.tipo_mime)) setPreviewId(doc.id); else setDetalleId(doc.id); };

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <PageHeader titulo="Biblioteca" subtitulo="Manuales, protocolos, formularios y capacitación del cuartel." acciones={<Button onClick={() => { setMensaje(null); setHojaSubir(true); }} className="gap-2"><Upload size={22} strokeWidth={1.75} aria-hidden /><span className="hidden sm:inline">Subir</span></Button>} />
      <div className="mx-auto w-full max-w-3xl px-4 py-5">
        {mensaje ? <div role={mensaje.tipo === "error" ? "alert" : "status"} className={`mb-4 rounded-[16px] px-4 py-3 text-[15px] ${mensaje.tipo === "ok" ? "bg-green-tint text-green-ink" : mensaje.tipo === "error" ? "bg-red-tint text-red" : "bg-yellow-tint text-yellow-ink"}`}>{mensaje.texto}</div> : null}
        {errorLista ? <div role="alert" className="mb-4 rounded-[16px] bg-red-tint px-4 py-3 text-[15px] text-red">{errorLista}</div> : null}
        <div className="space-y-3">
          <Buscador value={busqueda} onChange={setBusqueda} etiqueta="Buscar por título" placeholder="Buscar por título" />
          <div className="overflow-x-auto pb-1"><Segmentado opciones={CATEGORIAS_UI} valor={categoria} onChange={(v) => setCategoria(v as "todas" | CategoriaBiblioteca)} etiqueta="Categoría" className="min-w-max" /></div>
        </div>
        <div className="mt-5">
          {cargandoLista ? <div className="rounded-[16px] bg-surface p-4 text-[15px] text-label-2">Cargando documentos...</div> : visibles.length === 0 ? (
            documentos.length === 0 ? <EstadoVacio icono="BookOpen" titulo="Todavía no hay documentos" texto="Subí el primer manual, protocolo o formulario del cuartel." accion={{ label: "Subir el primero", onClick: () => setHojaSubir(true) }} /> : <EstadoVacio icono="Search" titulo="No encontramos documentos" texto="Probá con otro título o cambiá la categoría." />
          ) : (
            <Grupo>
              {visibles.map((doc) => {
                const puedeBorrar = esOficial || doc.subido_por === sessionId;
                const guardado = Boolean(offline[doc.id]);
                const menuAbierto = menuId === doc.id;
                return (
                  <div key={doc.id} className="fila relative flex items-center gap-3 px-4 py-3">
                    <button type="button" onClick={() => abrirDoc(doc)} className="tap flex min-w-0 flex-1 items-center gap-3 text-left">
                      <IconoTipo mime={doc.tipo_mime} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-[17px] font-semibold leading-snug text-label">{doc.titulo}</span>
                        <span className="mt-0.5 block text-[13px] text-label-2">{etiquetaCategoria(doc.categoria)} · {formatearTamanoDocumento(doc.tamano)} · {formatearFechaDocumento(doc.creado_en)}</span>
                        {guardado ? <span className="mt-0.5 block text-[13px] text-green-ink">Guardado sin conexión</span> : null}
                      </span>
                    </button>
                    <button type="button" onClick={() => descargarDirecto(doc)} aria-label={`Descargar ${doc.titulo}`} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-label-2 hover:bg-surface-2"><Download size={22} strokeWidth={1.75} aria-hidden /></button>
                    <div className="relative" data-menu-biblioteca>
                      <button type="button" onClick={() => setMenuId(menuAbierto ? null : doc.id)} aria-label={`Más acciones para ${doc.titulo}`} aria-expanded={menuAbierto} className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-label-2 hover:bg-surface-2"><Ellipsis size={22} strokeWidth={1.75} aria-hidden /></button>
                      {menuAbierto ? (
                        <div className="absolute right-0 top-12 z-20 min-w-[220px] overflow-hidden rounded-[16px] border border-separator bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)]">
                          <button type="button" onClick={() => { alternarOffline(doc); setMenuId(null); }} className="tap flex w-full min-h-[44px] items-center gap-3 px-4 text-left text-[17px] text-label hover:bg-surface-2"><WifiOff size={22} strokeWidth={1.75} aria-hidden />{guardado ? "Quitar sin conexión" : "Guardar sin conexión"}</button>
                          {puedeBorrar ? <button type="button" onClick={() => { setMenuId(null); void eliminar(doc); }} className="tap flex w-full min-h-[44px] items-center gap-3 border-t border-separator px-4 text-left text-[17px] text-red hover:bg-red-tint"><Trash2 size={22} strokeWidth={1.75} aria-hidden />Borrar</button> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </Grupo>
          )}
        </div>
      </div>
      {hojaSubir ? <SubirDocumentoHoja onCerrar={() => setHojaSubir(false)} onSubido={alSubir} /> : null}
      {previewDoc ? <PreviewHoja documento={previewDoc} onCerrar={() => setPreviewId(null)} onDescargar={() => descargarDirecto(previewDoc)} guardado={Boolean(offline[previewDoc.id])} guardando={guardandoOfflineId === previewDoc.id} onToggleOffline={() => alternarOffline(previewDoc)} puedeBorrar={esOficial || previewDoc.subido_por === sessionId} onBorrar={() => void eliminar(previewDoc)} /> : null}
      {detalle ? <DetalleHoja documento={detalle} subidoPor={detalle.subido_por_nombre ?? (detalle.subido_por === sessionId ? sessionNombre : "Bombero")} guardado={Boolean(offline[detalle.id])} guardando={guardandoOfflineId === detalle.id} onToggleOffline={() => alternarOffline(detalle)} onCerrar={() => setDetalleId(null)} onDescargar={() => descargarDirecto(detalle)} puedeBorrar={esOficial || detalle.subido_por === sessionId} onBorrar={() => void eliminar(detalle)} /> : null}
    </div>
  );
}


function SubirDocumentoHoja({ onCerrar, onSubido }: { onCerrar: () => void; onSubido: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState<CategoriaBiblioteca>("manuales");
  const [descripcion, setDescripcion] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cerrar = () => { if (!subiendo) onCerrar(); };
  const elegirArchivo = (e: ChangeEvent<HTMLInputElement>) => { setArchivo(e.target.files?.[0] ?? null); setError(null); };
  const subir = async () => {
    if (subiendo) return; setError(null);
    const tituloLimpio = titulo.trim();
    if (!tituloLimpio) { setError("Ingresá un título."); return; }
    if (tituloLimpio.length > 200) { setError("El título es demasiado largo."); return; }
    const descripcionLimpia = descripcion.trim();
    if (descripcionLimpia.length > 1000) { setError("La descripción es demasiado larga."); return; }
    if (!archivo) { setError("Elegí un archivo."); return; }
    const tipoArchivo = resolverTipoArchivo(archivo.name, archivo.type);
    if (!tipoArchivo) { setError("El archivo debe ser PDF, imagen, Word (docx) o Excel (xlsx)."); return; }
    if (archivo.size <= 0) { setError("El archivo está vacío."); return; }
    if (archivo.size > TAMANO_MAXIMO_BIBLIOTECA) { setError("El archivo supera los 20 MB."); return; }
    setSubiendo(true); setProgreso("Preparando la subida...");
    try {
      const preparado = await prepararSubidaAction({ nombre: archivo.name, tamano: archivo.size, tipo: archivo.type });
      if (!preparado.ok) { setError(preparado.error); return; }
      setProgreso("Subiendo el archivo...");
      const archivoSubida = archivo.type === preparado.data.contentType ? archivo : new Blob([archivo], { type: preparado.data.contentType });
      const supabase = createBrowserSupabaseClient();
      const { error: errorSubida } = await supabase.storage.from(BUCKET_BIBLIOTECA).uploadToSignedUrl(preparado.data.path, preparado.data.token, archivoSubida, { contentType: preparado.data.contentType, cacheControl: "3600" });
      if (errorSubida) { setError("No se pudo subir el archivo. Volvé a intentar."); return; }
      setProgreso("Registrando el documento...");
      const confirmado = await confirmarSubidaAction({ path: preparado.data.path, titulo: tituloLimpio, categoria, descripcion: descripcionLimpia });
      if (!confirmado.ok) { setError(confirmado.error); return; }
      onSubido();
    } catch { setError("No se pudo subir el documento. Revisá tu conexión."); }
    finally { setSubiendo(false); setProgreso(null); }
  };
  return (
    <Hoja open onClose={cerrar} title="Subir documento" footer={<div className="flex gap-2"><Button variant="secondary" onClick={cerrar} disabled={subiendo} className="flex-1">Cancelar</Button><Button onClick={subir} disabled={subiendo} className="flex-1 gap-2">{subiendo ? <Loader2 size={22} strokeWidth={1.75} className="animate-spin" aria-hidden /> : <Upload size={22} strokeWidth={1.75} aria-hidden />}{subiendo ? "Subiendo..." : "Subir"}</Button></div>}>
      <div className="space-y-4">
        <div className="flex flex-col gap-2">
          <span className="text-[15px] text-label-2">Archivo</span>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={subiendo} className="tap flex h-[120px] w-full flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-separator bg-surface-2 px-4 text-center text-label-2 hover:bg-surface disabled:text-label-2 disabled:bg-surface-2">
            <Upload size={22} strokeWidth={1.75} aria-hidden />
            <span className="text-[17px] font-medium text-label">{archivo ? archivo.name : "Elegir archivo"}</span>
            <span className="text-[13px] text-label-2">{archivo ? formatearTamanoDocumento(archivo.size) : "PDF, imagen, Word o Excel. Máximo 20 MB."}</span>
          </button>
          <input ref={inputRef} type="file" accept={ACEPTA_BIBLIOTECA} onChange={elegirArchivo} disabled={subiendo} className="sr-only" />
        </div>
        <Input label="Título" placeholder="Ej.: Protocolo de incendio estructural" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} disabled={subiendo} />
        <Select label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaBiblioteca)} disabled={subiendo}>{CATEGORIAS_BIBLIOTECA.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
        <Textarea label="Descripción" placeholder="Para qué sirve o cuándo usarlo..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={1000} hint="Opcional." disabled={subiendo} />
        {error ? <Aviso variante="error">{error}</Aviso> : null}
        {progreso ? <div aria-live="polite"><p className="mb-2 flex items-center gap-2 text-[15px] text-label-2"><Loader2 size={18} strokeWidth={1.75} className="animate-spin" aria-hidden />{progreso}</p><div className="h-1 overflow-hidden rounded-full bg-separator"><div className="h-full w-2/3 animate-pulse rounded-full bg-red" /></div></div> : null}
      </div>
    </Hoja>
  );
}

function PreviewHoja({ documento, onCerrar, onDescargar, guardado, guardando, onToggleOffline, puedeBorrar, onBorrar }: { documento: DocumentoBiblioteca; onCerrar: () => void; onDescargar: () => void; guardado: boolean; guardando: boolean; onToggleOffline: () => void; puedeBorrar: boolean; onBorrar: () => void; }) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const tipo = tipoDocumentoDesdeMime(documento.tipo_mime);
  useEffect(() => {
    let vivo = true; setCargando(true); setError(null); setUrl(null);
    obtenerUrlVistaAction(documento.id).then((res) => { if (!vivo) return; if (!res.ok) { setError(res.error); return; } setUrl(res.data.url); }).catch(() => { if (vivo) setError("No se pudo abrir la vista previa."); }).finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [documento.id]);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <header className="glass flex min-h-[56px] items-center gap-2 border-b border-separator px-4 py-2">
        <div className="min-w-0 flex-1"><p className="truncate text-[17px] font-semibold text-label">{documento.titulo}</p><p className="text-[13px] text-label-2">{etiquetaCategoria(documento.categoria)} · {formatearTamanoDocumento(documento.tamano)}</p></div>
        <Button variant="secondary" size="sm" onClick={onDescargar} className="shrink-0 gap-2"><Download size={22} strokeWidth={1.75} aria-hidden />Descargar</Button>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="tap flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-label-2 hover:bg-surface-2"><X size={22} strokeWidth={1.75} aria-hidden /></button>
      </header>
      <div className="flex-1 overflow-auto p-4">
        {cargando ? <div className="flex h-full items-center justify-center text-[15px] text-label-2"><Loader2 size={22} strokeWidth={1.75} className="mr-2 animate-spin" aria-hidden />Cargando vista previa...</div> : null}
        {error ? <Aviso variante="error">{error}</Aviso> : null}
        {url && tipo === "pdf" ? <iframe src={url} title={`Vista previa de ${documento.titulo}`} className="h-full min-h-[70vh] w-full rounded-[16px] border border-separator bg-surface" /> : null}
        {url && tipo === "imagen" ? <div className="flex min-h-full items-center justify-center overflow-auto rounded-[16px] bg-surface p-2">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={documento.titulo} className="max-h-none w-auto max-w-full touch-pinch-zoom" /></div> : null}
      </div>
      <div className="border-t border-separator bg-surface px-4 py-3">
        <Switch checked={guardado} onChange={onToggleOffline} etiqueta="Disponible sin conexión" descripcion={guardando ? "Guardando..." : guardado ? "Guardado" : "Guardá la ficha en este dispositivo"} disabled={guardando} className="px-0" />
        {puedeBorrar ? (confirmarBorrar ? <div className="mt-2 flex gap-2"><Button variant="secondary" size="sm" onClick={() => setConfirmarBorrar(false)} className="flex-1">Cancelar</Button><Button variant="danger" size="sm" onClick={onBorrar} className="flex-1">Borrar</Button></div> : <Button variant="ghost" onClick={() => setConfirmarBorrar(true)} className="mt-1 w-full justify-start text-red">Borrar documento</Button>) : null}
      </div>
    </div>
  );
}

function DetalleHoja({ documento, subidoPor, guardado, guardando, onToggleOffline, onCerrar, onDescargar, puedeBorrar, onBorrar }: { documento: DocumentoBiblioteca; subidoPor: string; guardado: boolean; guardando: boolean; onToggleOffline: () => void; onCerrar: () => void; onDescargar: () => void; puedeBorrar: boolean; onBorrar: () => void; }) {
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  return (
    <Hoja open onClose={onCerrar} title={documento.titulo} footer={<div className="flex gap-2"><Button variant="secondary" onClick={onDescargar} className="flex-1 gap-2"><Download size={22} strokeWidth={1.75} aria-hidden />Descargar</Button>{puedeBorrar ? <Button variant="danger" onClick={() => setConfirmarBorrar(true)} className="gap-2"><Trash2 size={22} strokeWidth={1.75} aria-hidden />Borrar</Button> : null}</div>}>
      <div className="space-y-4">
        <div className="flex items-center gap-3"><IconoTipo mime={documento.tipo_mime} /><div className="min-w-0"><p className="text-[17px] font-semibold text-label">{etiquetaCategoria(documento.categoria)}</p><p className="text-[13px] text-label-2">{formatearTamanoDocumento(documento.tamano)} · {formatearFechaDocumento(documento.creado_en)}</p></div></div>
        {documento.descripcion ? <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-label-2">{documento.descripcion}</p> : null}
        <p className="text-[13px] text-label-2">Subido por {subidoPor}</p>
        <div className="overflow-hidden rounded-[16px] border border-separator"><Switch checked={guardado} onChange={onToggleOffline} etiqueta="Disponible sin conexión" descripcion={guardando ? "Guardando..." : guardado ? "Guardado" : "Guardá la ficha en este dispositivo"} disabled={guardando} /></div>
        <Aviso variante="info">La vista previa no está disponible para este formato. Descargalo para verlo.</Aviso>
        {confirmarBorrar ? <Aviso variante="error" titulo="¿Borrar documento?"><p className="mt-1 text-[15px] text-label-2">Esta acción no se puede deshacer.</p><div className="mt-3 flex gap-2"><Button variant="secondary" size="sm" onClick={() => setConfirmarBorrar(false)} className="flex-1">Cancelar</Button><Button variant="danger" size="sm" onClick={onBorrar} className="flex-1">Borrar</Button></div></Aviso> : null}
      </div>
    </Hoja>
  );
}
