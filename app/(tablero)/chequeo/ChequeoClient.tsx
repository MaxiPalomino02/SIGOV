"use client";

import { useEffect, useState, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Camera,
  X,
  Loader2,
  ClipboardList,
  Calendar,
  FileText,
  AlertTriangle,
  Download,
  Settings,
  Eye,
  MoreVertical,
} from "lucide-react";
import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Hoja } from "@/components/ui/hoja";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatusPill } from "@/components/ui/status-pill";
import { SectionHeading } from "@/components/ui/section-heading";
import { QuickAction } from "@/components/ui/quick-action";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Aviso } from "@/components/ui/aviso";
import { Tabs } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatFechaKey, hoyArgentina, franjaActual, type Franja } from "@/lib/tablero";
import {
  type TipoChequeo,
  type EstadoItem,
  ESTADOS_ITEM,
  ETIQUETAS_TIPO,
  ETIQUETAS_ESTADO_ITEM,
  COLORES_ESTADO_ITEM,
  FONDOS_ESTADO_ITEM,
  type ChequeoPlantilla,
  type ChequeoItem,
  type Chequeo,
  type ChequeoResultado,
  formatearFranja,
  agruparItemsPorGrupo,
} from "@/lib/chequeo";
import { chequeoOffline } from "@/lib/chequeo-offline";
import {
  iniciarChequeo,
  guardarResultado,
  finalizarChequeo,
  firmarSubidaFoto,
  obtenerChequeosFecha,
  obtenerDetalleChequeo,
  obtenerResultadosChequeo,
  type ResultadoAccion,
} from "./actions-ejecucion";
import {
  crearPlantilla,
  editarPlantilla,
  borrarPlantilla,
  crearItem,
  editarItem,
  borrarItem,
  reordenarItems,
  cargarPlantillasAction,
  cargarItemsAction,
  cargarEquiposActivosAction,
  marcarEquipoEnReparacionAction,
} from "./actions";
import { isOficial } from "@/lib/cargos";

const FRANJAS: Franja[] = ["08:00-13:00", "13:00-18:00", "18:00-23:00", "23:00-08:00"];

type ChequeoClientProps = {
  oficial: boolean;
};

export function ChequeoClient({ oficial }: ChequeoClientProps) {
  const [activeTab, setActiveTab] = useState<"plantillas" | "ejecutar" | "historial" | "fallas">("ejecutar");

  // Plantillas
  const [plantillas, setPlantillas] = useState<ChequeoPlantilla[]>([]);
  const [plantillasLoading, setPlantillasLoading] = useState(true);
  const [plantillasError, setPlantillasError] = useState<string | null>(null);
  const [tipoFiltro, setTipoFiltro] = useState<TipoChequeo | "todos">("todos");

  // Ejecutar
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<string | null>(null);
  const [items, setItems] = useState<ChequeoItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [chequeoId, setChequeoId] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Map<string, ChequeoResultado>>(new Map());
  const [observaciones, setObservaciones] = useState("");
  const [ejecutando, setEjecutando] = useState(false);
  const [errorEjecutar, setErrorEjecutar] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState<string | null>(null);

  // Historial
  const [historialFecha, setHistorialFecha] = useState(() => hoyArgentina());
  const [historial, setHistorial] = useState<Chequeo[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError] = useState<string | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState<string | null>(null);
  const [detalleItems, setDetalleItems] = useState<ChequeoResultado[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);

  // Fallas
  const [fallas, setFallas] = useState<Chequeo[]>([]);
  const [fallasLoading, setFallasLoading] = useState(false);
  const [fallasError, setFallasError] = useState<string | null>(null);

  // Modales/hojas
  const [hojaPlantilla, setHojaPlantilla] = useState<"crear" | "editar" | null>(null);
  const [plantillaEditando, setPlantillaEditando] = useState<ChequeoPlantilla | null>(null);
  const [formPlantilla, setFormPlantilla] = useState({ nombre: "", tipo: "apertura" as TipoChequeo, activa: true });
  const [hojaItem, setHojaItem] = useState<"crear" | "editar" | null>(null);
  const [itemEditando, setItemEditando] = useState<ChequeoItem | null>(null);
  const [formItem, setFormItem] = useState({ nombre: "", grupo: "", orden: 0, equipoId: "" });
  const [equiposOpciones, setEquiposOpciones] = useState<{ id: string; codigo: string; nombre: string; estado: string }[]>([]);
  const [marcarReparacion, setMarcarReparacion] = useState<{ equipoId: string; equipoNombre: string; nota: string } | null>(null);

  // Nota para Falta/Dañado
  const [notaPendiente, setNotaPendiente] = useState<{ itemId: string; estado: EstadoItem } | null>(null);
  const [notaTexto, setNotaTexto] = useState("");

  const supabase = createBrowserSupabaseClient();

  // Cargar plantillas
  const cargarPlantillasData = useCallback(async () => {
    setPlantillasLoading(true);
    setPlantillasError(null);
    try {
      const res = await cargarPlantillasAction(tipoFiltro === "todos" ? undefined : tipoFiltro, false);
      if (res.ok) setPlantillas(res.data);
      else setPlantillasError(res.error);
    } catch {
      setPlantillasError("Error inesperado.");
    } finally {
      setPlantillasLoading(false);
    }
  }, [tipoFiltro]);

  useEffect(() => {
    cargarPlantillasData();
  }, [cargarPlantillasData]);

  useEffect(() => {
    if (!oficial) return;
    let mounted = true;
    cargarEquiposActivosAction().then((res) => {
      if (mounted && res.ok) setEquiposOpciones(res.data);
    });
    return () => { mounted = false; };
  }, [oficial]);

  // Realtime plantillas
  useEffect(() => {
    const canal = supabase.channel("chequeo-plantillas");
    canal.on("postgres_changes", { event: "*", schema: "public", table: "chequeo_plantillas" }, () => {
      cargarPlantillasData();
    });
    canal.subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [cargarPlantillasData, supabase]);

  // Cargar items al seleccionar plantilla
  useEffect(() => {
    if (!plantillaSeleccionada) {
      setItems([]);
      return;
    }
    setItemsLoading(true);
    cargarItemsAction(plantillaSeleccionada).then((res) => {
      if (res.ok) setItems(res.data);
      setItemsLoading(false);
    });
  }, [plantillaSeleccionada]);

  // Cargar chequeo en curso al cambiar plantilla/fecha/franja
  const [fechaEjecutar, setFechaEjecutar] = useState(() => hoyArgentina());
  const [franjaEjecutar, setFranjaEjecutar] = useState<Franja>(() => franjaActual(new Date()).franja);

  const cargarResultadosChequeo = useCallback(async (cid: string) => {
    const res = await obtenerResultadosChequeo(cid);
    if (res.ok) setResultados(new Map(res.data.map((r: any) => [r.item_id, r])));
    else setResultados(new Map());
  }, []);

  useEffect(() => {
    if (!plantillaSeleccionada) {
      setChequeoId(null);
      setResultados(new Map());
      setObservaciones("");
      return;
    }
    let mounted = true;
    setErrorEjecutar(null);
    iniciarChequeo(plantillaSeleccionada, fechaEjecutar, franjaEjecutar).then(async (res) => {
      if (!mounted) return;
      if (res.ok) {
        setChequeoId(res.data);
        await cargarResultadosChequeo(res.data);
      } else {
        setChequeoId(null);
        setErrorEjecutar(res.error);
      }
    });
    return () => {
      mounted = false;
    };
  }, [plantillaSeleccionada, fechaEjecutar, franjaEjecutar, cargarResultadosChequeo]);

  // Historial
  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      setHistorialLoading(true);
      setHistorialError(null);
      const res = await obtenerChequeosFecha(historialFecha);
      if (!mounted) return;
      if (res.ok) setHistorial(res.data);
      else setHistorialError(res.error);
      setHistorialLoading(false);
    };
    cargar();
    return () => { mounted = false; };
  }, [historialFecha]);

  // Fallas
  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      setFallasLoading(true);
      setFallasError(null);
      const hoy = hoyArgentina();
      const res = await obtenerChequeosFecha(hoy);
      if (!mounted) return;
      if (res.ok) {
        const conFallas = res.data.filter((c: any) => (c.fallas_count ?? 0) > 0);
        setFallas(conFallas);
      } else setFallasError(res.error);
      setFallasLoading(false);
    };
    cargar();
    return () => { mounted = false; };
  }, []);

  // Handlers
  const handleGuardarResultado = async (itemId: string, estado: EstadoItem, nota = "") => {
    if (!chequeoId) return;
    setErrorEjecutar(null);
    const res = await guardarResultado(chequeoId, itemId, estado, nota, "");
    let guardadoLocal = res.ok;

    if (!res.ok && typeof navigator !== "undefined" && !navigator.onLine) {
      const local = await chequeoOffline.guardarResultado({
        chequeoId,
        itemId,
        estado,
        nota,
      });
      guardadoLocal = "pendiente" in local && local.pendiente === true;
      if ("error" in local) setErrorEjecutar(local.error);
    } else if (!res.ok) {
      console.error("Error guardando resultado:", res.error);
      setErrorEjecutar(res.error);
    }

    if (guardadoLocal) {
      setResultados((prev) => {
        const next = new Map(prev);
        next.set(itemId, {
          chequeo_id: chequeoId,
          item_id: itemId,
          estado,
          nota,
          foto_path: null,
          actualizado_en: new Date().toISOString(),
        });
        return next;
      });
    }
  };

  const handleSubirFoto = async (itemId: string, file: File) => {
    if (!chequeoId) return;
    setSubiendoFoto(itemId);
    setErrorEjecutar(null);
    try {
      const res = await firmarSubidaFoto(chequeoId, itemId, file.type);
      if (!res.ok) throw new Error(res.error);
      const uploadRes = await fetch(res.data.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Error subiendo archivo");
      const fotoPath = res.data.path;
      const existing = resultados.get(itemId);
      const existingEstado = existing?.estado ?? "danado";
      const existingNota = existing?.nota ?? "";
      setResultados((prev) => {
        const next = new Map(prev);
        const cur = next.get(itemId);
        next.set(itemId, {
          chequeo_id: chequeoId,
          item_id: itemId,
          estado: existingEstado as EstadoItem,
          nota: existingNota,
          foto_path: fotoPath,
          actualizado_en: new Date().toISOString(),
          item_nombre: cur?.item_nombre,
          item_grupo: cur?.item_grupo,
          item_orden: cur?.item_orden,
        });
        return next;
      });
      const saveRes = await guardarResultado(chequeoId, itemId, existingEstado, existingNota, fotoPath);
      if (!saveRes.ok) throw new Error(saveRes.error);
    } catch (err) {
      console.error(err);
      setErrorEjecutar(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendoFoto(null);
    }
  };

  const handleFinalizar = async () => {
    if (!chequeoId) return;
    setEjecutando(true);
    setErrorEjecutar(null);
    const res = await finalizarChequeo(chequeoId, observaciones);
    let finalizadoLocal = res.ok;

    if (!res.ok && typeof navigator !== "undefined" && !navigator.onLine) {
      const local = await chequeoOffline.finalizarChequeo(chequeoId, observaciones);
      finalizadoLocal = "pendiente" in local && local.pendiente === true;
      if ("error" in local) setErrorEjecutar(local.error);
    } else if (!res.ok) {
      setErrorEjecutar(res.error);
    }

    if (finalizadoLocal) {
      setChequeoId(null);
      setResultados(new Map());
      setObservaciones("");
    }
    setEjecutando(false);
  };

  const handleAbrirDetalle = async (cid: string) => {
    setDetalleAbierto(cid);
    setDetalleLoading(true);
    const res = await obtenerDetalleChequeo(cid);
    if (res.ok) setDetalleItems(res.data);
    setDetalleLoading(false);
  };

  // Plantilla CRUD
  const abrirCrearPlantilla = () => {
    setFormPlantilla({ nombre: "", tipo: "apertura", activa: true });
    setHojaPlantilla("crear");
  };
  const abrirEditarPlantilla = (p: ChequeoPlantilla) => {
    setPlantillaEditando(p);
    setFormPlantilla({ nombre: p.nombre, tipo: p.tipo, activa: p.activa });
    setHojaPlantilla("editar");
  };
  const guardarPlantilla = async () => {
    if (!formPlantilla.nombre.trim()) return;
    setEjecutando(true);
    let res: ResultadoAccion;
    if (hojaPlantilla === "crear") res = await crearPlantilla(formPlantilla.nombre, formPlantilla.tipo);
    else res = await editarPlantilla(plantillaEditando!.id, formPlantilla.nombre, formPlantilla.tipo, formPlantilla.activa);
    if (!res.ok) setErrorEjecutar(res.error);
    else { setHojaPlantilla(null); setPlantillaEditando(null); }
    setEjecutando(false);
  };
  const borrarPlantillaConfirm = async (id: string) => {
    if (!confirm("¿Borrar esta plantilla y todos sus items?")) return;
    const res = await borrarPlantilla(id);
    if (!res.ok) setErrorEjecutar(res.error);
  };

  const recargarItems = useCallback(async () => {
    if (!plantillaSeleccionada) return;
    const res = await cargarItemsAction(plantillaSeleccionada);
    if (res.ok) setItems(res.data);
  }, [plantillaSeleccionada]);

  // Item CRUD
  const abrirCrearItem = () => {
    setFormItem({ nombre: "", grupo: "", orden: items.length, equipoId: "" });
    setHojaItem("crear");
  };
  const abrirEditarItem = (it: ChequeoItem) => {
    setItemEditando(it);
    setFormItem({ nombre: it.nombre, grupo: it.grupo, orden: it.orden, equipoId: it.equipo_id ?? "" });
    setHojaItem("editar");
  };
  const guardarItem = async () => {
    if (!formItem.nombre.trim() || !plantillaSeleccionada) return;
    setEjecutando(true);
    let res: ResultadoAccion;
    const equipoId = formItem.equipoId || null;
    if (hojaItem === "crear") res = await crearItem(plantillaSeleccionada, formItem.nombre, formItem.grupo, formItem.orden, equipoId);
    else res = await editarItem(itemEditando!.id, formItem.nombre, formItem.grupo, formItem.orden, equipoId);
    if (!res.ok) setErrorEjecutar(res.error);
    else {
      setHojaItem(null);
      setItemEditando(null);
      await recargarItems();
    }
    setEjecutando(false);
  };
  const borrarItemConfirm = async (id: string) => {
    if (!confirm("¿Borrar este item?")) return;
    const res = await borrarItem(id);
    if (!res.ok) setErrorEjecutar(res.error);
    else await recargarItems();
  };

  const guardarNota = async () => {
    if (!notaPendiente) return;
    await handleGuardarResultado(notaPendiente.itemId, notaPendiente.estado, notaTexto);
    setNotaPendiente(null);
    setNotaTexto("");
  };

  const ICONOS_ESTADO: Record<EstadoItem, LucideIcon> = {
    ok: Lucide.CheckCircle2,
    falta: Lucide.AlertCircle,
    danado: Lucide.Wrench,
  };

  const hoy = hoyArgentina();

  return (
    <div className="space-y-4">
      <SectionHeading
        titulo="Chequeo de unidades"
        descripcion="Gestión de plantillas, ejecución de chequeos y revisión de resultados."
        accion={
          oficial && activeTab === "plantillas" ? (
            <QuickAction icono={Plus} titulo="Nueva plantilla" onClick={abrirCrearPlantilla} />
          ) : activeTab === "ejecutar" && plantillaSeleccionada ? (
            <QuickAction icono={Plus} titulo="Nuevo item" onClick={abrirCrearItem} />
          ) : null
        }
      />

      {/* Tabs navigation */}
      <Tabs
        items={[
          { value: "ejecutar", label: "Ejecutar" },
          { value: "historial", label: "Historial" },
          { value: "fallas", label: "Fallas del día" },
          ...(oficial ? [{ value: "plantillas", label: "Plantillas" }] : []),
        ]}
        value={activeTab}
        onChange={(v) => setActiveTab(v as "plantillas" | "ejecutar" | "historial" | "fallas")}
        className="mb-4"
      />

      {/* EJECUTAR */}
      {activeTab === "ejecutar" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <DashboardCard
            titulo="Selección"
            descripcion="Elegí la plantilla, fecha y franja para iniciar el chequeo."
          >
            <div className="space-y-4">
                <div className="space-y-2">
                  <span className="text-[14px] font-semibold text-ink">Plantilla</span>
                  <Select value={plantillaSeleccionada ?? ""} onChange={(e) => setPlantillaSeleccionada(e.target.value || null)}>
                    <option value="">Seleccionar plantilla</option>
                    {plantillas
                      .filter((p) => p.activa)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} ({ETIQUETAS_TIPO[p.tipo]})
                        </option>
                      ))}
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <span className="text-[14px] font-semibold text-ink">Fecha</span>
                    <Input
                      type="date"
                      value={fechaEjecutar}
                      onChange={(e) => setFechaEjecutar(e.target.value)}
                      min={hoy}
                    />
                  </div>
                  <div className="space-y-2">
                    <span className="text-[14px] font-semibold text-ink">Franja</span>
                    <Select value={franjaEjecutar} onChange={(e) => setFranjaEjecutar(e.target.value as Franja)}>
                      {FRANJAS.map((f) => (
                        <option key={f} value={f}>{formatearFranja(f)}</option>
                      ))}
                    </Select>
                  </div>
                </div>

                {chequeoId && (
                  <div className="rounded-lg border border-ok/40 bg-ok/10 p-3 text-[14px] text-ok">
                    Chequeo iniciado. ID: <code className="font-mono text-[13px]">{chequeoId.slice(0, 8)}...</code>
                  </div>
                )}
              </div>
            </DashboardCard>

            <DashboardCard
              titulo={plantillaSeleccionada ? "Items del chequeo" : "Seleccioná una plantilla"}
              descripcion={plantillaSeleccionada ? "Marcá OK / Falta / Dañado. Falta y Dañado requieren nota." : ""}
              className="lg:col-span-2"
            >
              {errorEjecutar && <Aviso variante="error" className="mb-4">{errorEjecutar}</Aviso>}

              {itemsLoading ? (
                <div className="space-y-3" aria-busy="true">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-line-subtle bg-bg-subtle px-4 py-8 text-center text-ink-muted">
                  <Lucide.ClipboardList className="h-8 w-8" aria-hidden />
                  <p className="text-[14px]">No hay items en esta plantilla.</p>
                </div>
              ) : (
                <>
                  {Array.from(agruparItemsPorGrupo(items).entries()).map(([grupo, itemsGrupo]) => (
                    <div key={grupo} className="space-y-2">
                      <h4 className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">{grupo}</h4>
                      {itemsGrupo.map((item) => {
                        const resultado = resultados.get(item.id);
                        const estadoActual = resultado?.estado ?? "ok";
                        return (
                          <div
                            key={item.id}
                            className={`rounded-xl border p-3 transition-colors hover:bg-surface-hover ${FONDOS_ESTADO_ITEM[estadoActual]} ${COLORES_ESTADO_ITEM[estadoActual]}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-ink">{item.nombre}</p>
                                {resultado?.nota && (
                                  <p className="mt-1 text-[13px] text-ink-muted">{resultado.nota}</p>
                                )}
                                {resultado?.foto_path && (
                                  <a
                                    href={resultado.foto_path}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-[13px] font-mono text-fire-text hover:underline"
                                  >
                                    <Lucide.Image className="h-3 w-3" /> Ver foto
                                  </a>
                                )}
                                {item.equipo ? (
                                  <p className="mt-1 font-mono text-[13px] text-ink-secondary">
                                    Equipo: {item.equipo.codigo} - {item.equipo.nombre}
                                  </p>
                                ) : null}
                                {oficial && item.equipo_id && item.equipo && estadoActual !== "ok" && item.equipo.estado !== "en_reparacion" ? (
                                  <div className="mt-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        setMarcarReparacion({
                                          equipoId: item.equipo_id!,
                                          equipoNombre: `${item.equipo!.codigo} - ${item.equipo!.nombre}`,
                                          nota: `Falla en chequeo: ${item.nombre}${resultado?.nota ? ` (${resultado.nota})` : ""}`,
                                        })
                                      }
                                    >
                                      Marcar en reparación
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {ESTADOS_ITEM.map((est) => {
                                  const Icono = ICONOS_ESTADO[est];
                                  return (
                                    <Button
                                      key={est}
                                      variant={estadoActual === est ? "primary" : "ghost"}
                                      size="sm"
                                      className={estadoActual === est ? "h-12 w-12" : "h-12 w-12"}
                                      onClick={() => {
                                        if (est !== "ok") {
                                          setNotaPendiente({ itemId: item.id, estado: est });
                                          setNotaTexto("");
                                        } else {
                                          handleGuardarResultado(item.id, est, "");
                                        }
                                      }}
                                      disabled={ejecutando}
                                    >
                                      <Icono className="h-5 w-5" aria-hidden />
                                    </Button>
                                  );
                                })}
                                {estadoActual !== "ok" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-12 w-12"
                                    onClick={() => {
                                      const input = document.createElement("input");
                                      input.type = "file";
                                      input.accept = "image/*";
                                      input.onchange = () => input.files?.[0] && handleSubirFoto(item.id, input.files[0]);
                                      input.click();
                                    }}
                                    disabled={subiendoFoto === item.id || ejecutando}
                                  >
                                    {subiendoFoto === item.id ? (
                                      <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                      <Camera className="h-5 w-5" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  <div className="mt-4 pt-4 border-t border-line">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="space-y-2 flex-1">
                        <span className="text-[14px] font-semibold text-ink">Observaciones generales</span>
                        <Textarea
                          value={observaciones}
                          onChange={(e) => setObservaciones(e.target.value)}
                          placeholder="Observaciones finales del chequeo..."
                          rows={3}
                        />
                      </div>
                      <Button
                        size="lg"
                        className="h-12 self-end"
                        onClick={handleFinalizar}
                        disabled={ejecutando || !chequeoId}
                      >
                        {ejecutando ? <Loader2 className="h-5 w-5 animate-spin" /> : "Finalizar chequeo"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </DashboardCard>
          </div>
        )}

        {/* HISTORIAL */}
        {activeTab === "historial" && (
          <DashboardCard
            titulo="Historial de chequeos"
            descripcion="Seleccioná una fecha para ver los chequeos realizados."
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[14px] font-semibold text-ink shrink-0">Fecha</span>
              <Input
                type="date"
                value={historialFecha}
                onChange={(e) => setHistorialFecha(e.target.value)}
                max={hoy}
                className="w-48"
              />
            </div>

            {historialError && <Aviso variante="error" className="mb-4">{historialError}</Aviso>}

            {historialLoading ? (
              <div className="space-y-3" aria-busy="true">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : historial.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-line-subtle bg-bg-subtle px-4 py-8 text-center text-ink-muted">
                <Lucide.FileText className="h-8 w-8" aria-hidden />
                <p className="text-[14px]">No hay chequeos en esta fecha.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historial.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-3 transition-colors hover:bg-surface-hover ${
                      c.estado === "completo" ? "border-ok/40 bg-ok/10" : "border-alarm/40 bg-alarm/10"
                    }`}
                    onClick={() => handleAbrirDetalle(c.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-bg-subtle">
                          <Lucide.ClipboardList className="h-5 w-5 text-ink-muted" aria-hidden />
                        </span>
                        <div>
                          <p className="font-semibold text-ink">{c.plantilla_nombre}</p>
                          <p className="font-mono text-[13px] text-ink-muted">
                            {ETIQUETAS_TIPO[c.plantilla_tipo!]} · {c.bombero_nombre} · {formatearFranja(c.franja)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <StatusPill
                          estado={c.estado === "completo" ? "operativo" : "pendiente"}
                          className="text-[13px]"
                        />
                        {c.fallas_count && c.fallas_count > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-alarm/40 bg-alarm/10 px-2 py-0.5 font-mono text-[13px] font-bold text-alarm">
                            <AlertTriangle className="h-3 w-3" /> {c.fallas_count} fallas
                          </span>
                        )}
                        <Button variant="ghost" size="sm" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleAbrirDetalle(c.id); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        )}

        {/* FALLAS DEL DÍA */}
        {activeTab === "fallas" && (
          <DashboardCard
            titulo="Fallas del día"
            descripcion="Resumen de chequeos con ítems en Falta o Dañado para la fecha de hoy."
          >
            {fallasError && <Aviso variante="error" className="mb-4">{fallasError}</Aviso>}

            {fallasLoading ? (
              <div className="space-y-3" aria-busy="true">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : fallas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-ok/40 bg-ok/10 px-4 py-8 text-center text-ok">
                <Lucide.CheckCircle2 className="h-8 w-8" aria-hidden />
                <p className="text-[14px] font-semibold">¡No hay fallas hoy!</p>
                <p className="text-[13px] text-ok/80">Todos los chequeos completados sin novedades.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fallas.map((c) => (
                  <div key={c.id} className="rounded-xl border border-alarm/40 bg-alarm/10 p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-alarm/40 bg-alarm/10">
                          <AlertTriangle className="h-5 w-5 text-alarm" aria-hidden />
                        </span>
                        <div>
                          <p className="font-semibold text-ink">{c.plantilla_nombre}</p>
                          <p className="font-mono text-[13px] text-ink-muted">
                            {ETIQUETAS_TIPO[c.plantilla_tipo!]} · {c.bombero_nombre} · {formatearFranja(c.franja)}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-alarm/40 bg-alarm/10 px-2 py-0.5 font-mono text-[13px] font-bold text-alarm">
                        <AlertTriangle className="h-3 w-3" /> {c.fallas_count} fallas
                      </span>
                    </div>
                    <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); handleAbrirDetalle(c.id); }}>
                      Ver detalle de fallas
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        )}

        {oficial && activeTab === "plantillas" && (
          <>
          <DashboardCard
            titulo="Plantillas de chequeo"
            descripcion="Gestioná plantillas de apertura y cierre. Arrastrá items para reordenar (próximamente)."
          >
            {plantillasError && <Aviso variante="error" className="mb-4">{plantillasError}</Aviso>}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">Tipo</span>
              <Select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as TipoChequeo | "todos")}>
                <option value="todos">Todos</option>
                <option value="apertura">Apertura</option>
                <option value="cierre">Cierre</option>
              </Select>
            </div>

            {plantillasLoading ? (
                <div className="space-y-3" aria-busy="true">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : plantillas.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-line-subtle bg-bg-subtle px-4 py-8 text-center text-ink-muted">
                  <Lucide.Settings className="h-8 w-8" aria-hidden />
                  <p className="text-[14px]">No hay plantillas. Creá una para empezar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {plantillas.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-colors hover:bg-surface-hover ${
                        p.activa ? "bg-surface" : "bg-bg-subtle"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                          p.tipo === "apertura" ? "border-brass/40 bg-brass/10 text-brass" : "border-alarm/40 bg-alarm/10 text-alarm"
                        }`}>
                          {p.tipo === "apertura" ? <Lucide.Sunrise className="h-5 w-5" /> : <Lucide.Sunset className="h-5 w-5" />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-ink truncate">{p.nombre}</p>
                            <Badge cargo={p.tipo === "apertura" ? "Oficial Principal" : "Oficial Ayudante"} />
                            {!p.activa && <span className="font-mono text-[13px] uppercase tracking-wider text-ink-secondary">Inactiva</span>}
                          </div>
                          <p className="mt-1 font-mono text-[13px] text-ink-secondary">
                            ID: <code>{p.id.slice(0, 8)}...</code>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => abrirEditarPlantilla(p)} aria-label="Editar">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => borrarPlantillaConfirm(p.id)} aria-label="Borrar">
                          <Trash2 className="h-4 w-4 text-fire-text" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setPlantillaSeleccionada(p.id)} aria-label="Ver items">
                          <Lucide.List className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
</DashboardCard>

            {plantillaSeleccionada && plantillas.find((p) => p.id === plantillaSeleccionada) && (
              <DashboardCard
                titulo={`Items de ${plantillas.find((p) => p.id === plantillaSeleccionada)!.nombre}`}
                descripcion="Gestioná los items. Usá los botones para editar/borrar. Reordenar próximamente."
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="heading-display text-base text-ink">Items</h4>
                  <QuickAction icono={Plus} titulo="Nuevo item" onClick={abrirCrearItem} />
                </div>

                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-line-subtle bg-bg-subtle px-4 py-8 text-center text-ink-muted">
                    <Lucide.ClipboardList className="h-8 w-8" aria-hidden />
                    <p className="text-[14px]">No hay items. Agregá el primero.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Array.from(agruparItemsPorGrupo(items).entries()).map(([grupo, itemsGrupo]) => (
                      <div key={grupo} className="space-y-2">
                        <h5 className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">{grupo || "General"}</h5>
                        {itemsGrupo.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="font-mono text-[13px] font-bold text-ink-muted">{item.orden}</span>
                              <p className="font-semibold text-ink truncate">{item.nombre}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button variant="ghost" size="sm" onClick={() => abrirEditarItem(item)} aria-label="Editar">
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => borrarItemConfirm(item.id)} aria-label="Borrar">
                                <Trash2 className="h-4 w-4 text-fire-text" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>
            )}

          </>
        )}

        {/* MODAL PLANTILLA */}
        <Hoja
          open={!!hojaPlantilla}
          onClose={() => { setHojaPlantilla(null); setPlantillaEditando(null); }}
          title={hojaPlantilla === "crear" ? "Nueva plantilla" : "Editar plantilla"}
        >
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); guardarPlantilla(); }}>
            {errorEjecutar && <Aviso variante="error">{errorEjecutar}</Aviso>}
            <div className="space-y-2">
              <span className="text-[14px] font-semibold text-ink">Nombre *</span>
              <Input value={formPlantilla.nombre} onChange={(e) => setFormPlantilla({ ...formPlantilla, nombre: e.target.value })} placeholder="Ej: Chequeo apertura móvil 1" maxLength={120} required />
            </div>
            <div className="space-y-2">
              <span className="text-[14px] font-semibold text-ink">Tipo *</span>
              <Select value={formPlantilla.tipo} onChange={(e) => setFormPlantilla({ ...formPlantilla, tipo: e.target.value as TipoChequeo })}>
                <option value="apertura">Apertura</option>
                <option value="cierre">Cierre</option>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <input type="checkbox" checked={formPlantilla.activa} onChange={(e) => setFormPlantilla({ ...formPlantilla, activa: e.target.checked })} className="h-4 w-4" />
                Activa
              </span>
            </div>
            <div className="flex gap-3 pt-2 border-t border-line">
              <Button type="submit" className="flex-1" disabled={ejecutando}>
                {ejecutando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => { setHojaPlantilla(null); setPlantillaEditando(null); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </Hoja>

        {/* MODAL ITEM */}
        <Hoja
          open={!!hojaItem}
          onClose={() => { setHojaItem(null); setItemEditando(null); }}
          title={hojaItem === "crear" ? "Nuevo item" : "Editar item"}
        >
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); guardarItem(); }}>
            {errorEjecutar && <Aviso variante="error">{errorEjecutar}</Aviso>}
            <div className="space-y-2">
              <span className="text-[14px] font-semibold text-ink">Nombre *</span>
              <Input value={formItem.nombre} onChange={(e) => setFormItem({ ...formItem, nombre: e.target.value })} placeholder="Ej: Extintor carga completa" maxLength={120} required />
            </div>
            <div className="space-y-2">
              <span className="text-[14px] font-semibold text-ink">Grupo</span>
              <Input value={formItem.grupo} onChange={(e) => setFormItem({ ...formItem, grupo: e.target.value })} placeholder="Ej: Móvil 1, Compartimiento A" maxLength={80} />
            </div>
            <div className="space-y-2">
              <span className="text-[14px] font-semibold text-ink">Orden</span>
              <Input type="number" min="0" value={formItem.orden} onChange={(e) => setFormItem({ ...formItem, orden: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <span className="text-[14px] font-semibold text-ink">Equipo vinculado (opcional)</span>
              <Select value={formItem.equipoId} onChange={(e) => setFormItem({ ...formItem, equipoId: e.target.value })}>
                <option value="">Sin equipo</option>
                {equiposOpciones.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.codigo} - {eq.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-3 pt-2 border-t border-line">
              <Button type="submit" className="flex-1" disabled={ejecutando}>
                {ejecutando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => { setHojaItem(null); setItemEditando(null); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </Hoja>

        {/* MODAL NOTA FALTA/DAÑADO */}
        <Hoja
          open={!!notaPendiente}
          onClose={() => { setNotaPendiente(null); setNotaTexto(""); }}
          title={`Nota para ${notaPendiente ? ETIQUETAS_ESTADO_ITEM[notaPendiente.estado] : ""}`}
        >
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); guardarNota(); }}>
            {errorEjecutar && <Aviso variante="error">{errorEjecutar}</Aviso>}
            <div className="space-y-2">
              <span className="text-[14px] font-semibold text-ink">Nota (requerida)</span>
              <Textarea
                value={notaTexto}
                onChange={(e) => setNotaTexto(e.target.value)}
                placeholder="Describí la falla o daño..."
                rows={3}
                required
                autoFocus
              />
            </div>
            <div className="flex gap-3 pt-2 border-t border-line">
              <Button type="submit" className="flex-1" disabled={ejecutando || !notaTexto.trim()}>
                {ejecutando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => { setNotaPendiente(null); setNotaTexto(""); }}>
                Cancelar
              </Button>
            </div>
          </form>
        </Hoja>

        {/* MODAL MARCAR EN REPARACIÓN */}
        <Hoja
          open={!!marcarReparacion}
          onClose={() => setMarcarReparacion(null)}
          title="Marcar equipo en reparación"
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!marcarReparacion) return;
              setEjecutando(true);
              setErrorEjecutar(null);
              const res = await marcarEquipoEnReparacionAction(marcarReparacion.equipoId, marcarReparacion.nota);
              if (!res.ok) setErrorEjecutar(res.error);
              else {
                setMarcarReparacion(null);
                await recargarItems();
              }
              setEjecutando(false);
            }}
          >
            {errorEjecutar ? <Aviso variante="error">{errorEjecutar}</Aviso> : null}
            <p className="text-[14px] text-ink">
              Equipo: <span className="font-semibold">{marcarReparacion?.equipoNombre}</span>
            </p>
            <div className="space-y-2">
              <span className="text-[14px] font-semibold text-ink">Nota *</span>
              <Textarea
                value={marcarReparacion?.nota ?? ""}
                onChange={(e) =>
                  setMarcarReparacion((prev) => (prev ? { ...prev, nota: e.target.value } : prev))
                }
                rows={3}
                maxLength={500}
                required
              />
            </div>
            <p className="text-[13px] text-ink-muted">
              Esta acción queda registrada en el historial del equipo.
            </p>
            <div className="flex gap-3 pt-2 border-t border-line">
              <Button type="submit" className="flex-1" disabled={ejecutando || !marcarReparacion?.nota.trim()}>
                {ejecutando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
              </Button>
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setMarcarReparacion(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Hoja>

        {/* MODAL DETALLE CHEQUEO */}
        <Hoja
          open={!!detalleAbierto}
          onClose={() => { setDetalleAbierto(null); setDetalleItems([]); }}
          title="Detalle de chequeo"
          className="max-w-2xl"
        >
          {detalleLoading ? (
            <div className="space-y-3" aria-busy="true">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from(agruparItemsPorGrupo(detalleItems.map((d) => ({ id: d.item_id, nombre: d.item_nombre!, grupo: d.item_grupo!, orden: d.item_orden! } as ChequeoItem))).entries()).map(([grupo, itemsGrupo]) => (
                <div key={grupo} className="space-y-2">
                  <h5 className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">{grupo || "General"}</h5>
                  {itemsGrupo.map((item) => {
                    const res = detalleItems.find((d) => d.item_id === item.id);
                    const estado = res?.estado ?? "ok";
                    return (
                      <div key={item.id} className={`rounded-lg border p-3 ${FONDOS_ESTADO_ITEM[estado]} ${COLORES_ESTADO_ITEM[estado]}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-ink">{item.nombre}</p>
                            <p className="font-mono text-[13px] text-ink-muted">
                              {ETIQUETAS_ESTADO_ITEM[estado]}
                              {res?.nota && ` — ${res.nota}`}
                            </p>
                          </div>
                          {res?.foto_path && (
                            <a href={res.foto_path} target="_blank" rel="noopener noreferrer" className="text-[13px] font-mono text-fire-text hover:underline">
                              <Lucide.Image className="h-3 w-3 inline" /> Foto
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </Hoja>
     </div>
  );
}


