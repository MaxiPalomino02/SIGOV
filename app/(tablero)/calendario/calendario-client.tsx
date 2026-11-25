"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  X,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { borrarEvento, crearEvento, editarEvento } from "./actions";
import {
  dateToKey,
  formatFechaKey,
  hoyArgentina,
  sumarDias,
} from "@/lib/tablero";
import {
  TipoEvento,
  TIPOS_EVENTO,
  ETIQUETAS_TIPO,
  ICONOS_TIPO,
  type Evento,
  obtenerColorTipo,
  obtenerFondoTipo,
  formatearHoraEvento,
  cargarEventos,
} from "@/lib/eventos";
import { Aviso } from "@/components/ui/aviso";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Hoja } from "@/components/ui/hoja";
import { QuickAction } from "@/components/ui/quick-action";
import { SectionHeading } from "@/components/ui/section-heading";
import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const ICONOS_MAP: Record<string, LucideIcon> = {
  GraduationCap: Lucide.GraduationCap,
  Users: Lucide.Users,
  Flame: Lucide.Flame,
  Award: Lucide.Award,
  Calendar: Lucide.Calendar,
  AlertTriangle: Lucide.AlertTriangle,
  Edit2: Lucide.Edit2,
};

const getIcon = (nombre: string): LucideIcon => ICONOS_MAP[nombre] ?? Lucide.AlertTriangle;

const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function fechaDeEvento(e: Evento): string {
  const d = new Date(e.inicio);
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Tucuman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function aInputLocal(iso: string): string {
  const d = new Date(iso);
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Tucuman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function generarSemanas(anio: number, mes: number): string[][] {
  // Usar zona horaria de Tucumán para la grilla del calendario
  const inicio = new Date();
  inicio.setFullYear(anio, mes, 1);
  inicio.setHours(0, 0, 0, 0);
  // Ajustar a zona horaria de Tucumán
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Tucuman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(inicio);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const anioTuc = parseInt(get("year"));
  const mesTuc = parseInt(get("month")) - 1;
  const diaTuc = parseInt(get("day"));

  const inicioTuc = new Date(anioTuc, mesTuc, diaTuc);
  const dSemana = inicioTuc.getDay(); // 0 = Domingo
  const offset = dSemana === 0 ? -6 : 1 - dSemana;
  inicioTuc.setDate(inicioTuc.getDate() + offset);

  // Último día del mes en Tucumán
  const finTuc = new Date(anioTuc, mesTuc + 1, 0);
  const dFin = finTuc.getDay();
  const offsetFin = dFin === 0 ? 0 : 7 - dFin;
  finTuc.setDate(finTuc.getDate() + offsetFin);

  const dias: string[] = [];
  let cursor = inicioTuc;
  while (cursor <= finTuc) {
    const anioStr = cursor.getFullYear();
    const mesStr = String(cursor.getMonth() + 1).padStart(2, "0");
    const diaStr = String(cursor.getDate()).padStart(2, "0");
    dias.push(`${anioStr}-${mesStr}-${diaStr}`);
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }

  const semanas: string[][] = [];
  for (let i = 0; i < dias.length; i += 7) {
    semanas.push(dias.slice(i, i + 7));
  }
  return semanas;
}

type CalendarioClientProps = {
  oficial: boolean;
};

export function CalendarioClient({ oficial }: CalendarioClientProps) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [anio, setAnio] = useState<number>(() => {
    const hoy = new Date(hoyArgentina());
    return hoy.getFullYear();
  });
  const [mes, setMes] = useState<number>(() => {
    const hoy = new Date(hoyArgentina());
    return hoy.getMonth();
  });
  const [hojaOpen, setHojaOpen] = useState(false);
  const [hojaModo, setHojaModo] = useState<"detalle" | "crear" | "editar">("detalle");
  const [hojaEvento, setHojaEvento] = useState<Evento | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorHoja, setErrorHoja] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [eventoEliminandoId, setEventoEliminandoId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState({
    titulo: "",
    descripcion: "",
    tipo: "capacitacion" as TipoEvento,
    inicio: "",
    fin: "",
    lugar: "",
  });

  const recargar = useCallback(async () => {
    try {
      const resultado = await cargarEventos();
      if (resultado.ok) setEventos(resultado.data);
      else setError("No se pudieron cargar los eventos.");
    } catch {
      setError("No se pudieron cargar los eventos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const canal = supabase.channel("calendario-eventos");
    canal.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "eventos" },
      async () => {
        await recargar();
      }
    );
    void canal.subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [recargar]);

  const filtrados = eventos.filter(
    (e) => filtroTipo === "todos" || e.tipo === filtroTipo
  );

  const eventosPorDia = new Map<string, Evento[]>();
  for (const e of filtrados) {
    const f = fechaDeEvento(e);
    const arr = eventosPorDia.get(f) ?? [];
    arr.push(e);
    eventosPorDia.set(f, arr);
  }

  const semanas = generarSemanas(anio, mes);
  const hoy = hoyArgentina();

  const mesAnterior = () => {
    setMes((m) => (m === 0 ? 11 : m - 1));
    setAnio((a) => (mes === 0 ? a - 1 : a));
  };
  const mesSiguiente = () => {
    setMes((m) => (m === 11 ? 0 : m + 1));
    setAnio((a) => (mes === 11 ? a + 1 : a));
  };
  const irAHoy = () => {
    const hoyDate = new Date(hoy);
    setMes(hoyDate.getMonth());
    setAnio(hoyDate.getFullYear());
  };

  const abrirCrear = () => {
    const ahora = new Date();
    const inicio = new Date(ahora.getTime() + 60 * 60 * 1000);
    const fin = new Date(inicio.getTime() + 2 * 60 * 60 * 1000);
    setFormulario({
      titulo: "",
      descripcion: "",
      tipo: "capacitacion",
      inicio: aInputLocal(inicio.toISOString()),
      fin: aInputLocal(fin.toISOString()),
      lugar: "",
    });
    setHojaModo("crear");
    setHojaEvento(null);
    setHojaOpen(true);
    setErrorHoja(null);
  };

  const abrirDetalle = (e: Evento) => {
    setHojaModo("detalle");
    setHojaEvento(e);
    setHojaOpen(true);
    setErrorHoja(null);
  };

  const abrirEditar = (e: Evento) => {
    setFormulario({
      titulo: e.titulo,
      descripcion: e.descripcion,
      tipo: e.tipo,
      inicio: aInputLocal(e.inicio),
      fin: aInputLocal(e.fin),
      lugar: e.lugar,
    });
    setHojaModo("editar");
    setHojaEvento(e);
    setHojaOpen(true);
    setErrorHoja(null);
  };

  const cerrarHoja = () => {
    setHojaOpen(false);
    setHojaEvento(null);
    setErrorHoja(null);
  };

  const onGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorHoja(null);
    setGuardando(true);

    try {
      if (hojaModo === "editar" && hojaEvento) {
        const res = await editarEvento(
          hojaEvento.id,
          formulario.titulo,
          formulario.descripcion,
          formulario.tipo,
          formulario.inicio,
          formulario.fin,
          formulario.lugar
        );
        if (!res.ok) {
          setErrorHoja(res.error);
          return;
        }
      } else {
        const res = await crearEvento(
          formulario.titulo,
          formulario.descripcion,
          formulario.tipo,
          formulario.inicio,
          formulario.fin,
          formulario.lugar
        );
        if (!res.ok) {
          setErrorHoja(res.error);
          return;
        }
      }
      cerrarHoja();
      recargar();
    } catch (err) {
      console.error("Error guardando evento:", err);
      setErrorHoja("Error inesperado. Volvé a intentar.");
    } finally {
      setGuardando(false);
    }
  };

  const onBorrar = async () => {
    if (!hojaEvento) return;
    setEliminando(true);
    setEventoEliminandoId(hojaEvento.id);
    try {
      const res = await borrarEvento(hojaEvento.id);
      if (!res.ok) {
        setErrorHoja(res.error);
        return;
      }
      cerrarHoja();
      recargar();
    } catch (err) {
      console.error("Error borrando evento:", err);
      setErrorHoja("Error inesperado. Volvé a intentar.");
    } finally {
      setEliminando(false);
      setEventoEliminandoId(null);
    }
  };

  if (loading) {
    return (
      <DashboardCard
        titulo="Calendario"
        descripcion="Agenda institucional del cuartel."
        loading
      />
    );
  }

  if (error) {
    return (
      <DashboardCard
        titulo="Calendario"
        descripcion="Agenda institucional del cuartel."
        error={error}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        titulo="Calendario"
        descripcion="Agenda institucional del cuartel. Filtrá por tipo para ver solo lo que necesitás."
        accion={
          oficial ? (
            <QuickAction
              icono={Plus}
              titulo="Nuevo evento"
              onClick={abrirCrear}
              className="hidden sm:inline-flex"
            />
          ) : null
        }
      />

      <DashboardCard
        titulo="Filtros"
        descripcion="Seleccioná un tipo para filtrar la vista."
        className="hidden lg:block"
      >
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="filtro-tipo" className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">
            Tipo
          </label>
          <Select id="filtro-tipo" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="w-48">
            <option value="todos">Todos los tipos</option>
            {TIPOS_EVENTO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS_TIPO[t]}
              </option>
            ))}
          </Select>
        </div>
      </DashboardCard>

      <div className="hidden lg:block">
        <DashboardCard>
          <div className="space-y-4">
            <header className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" className="h-11 w-11 p-0" onClick={mesAnterior} aria-label="Mes anterior">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <h3 className="heading-display text-xl text-ink">
                  {new Date(Date.UTC(anio, mes, 1)).toLocaleString("es-AR", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
                <Button variant="ghost" size="sm" className="h-11 w-11 p-0" onClick={mesSiguiente} aria-label="Mes siguiente">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <Button variant="secondary" size="sm" onClick={irAHoy}>
                <Clock className="h-4 w-4 mr-2" />
                Hoy
              </Button>
            </header>

            <div className="grid grid-cols-7 gap-0.5 text-center font-mono text-[13px] uppercase tracking-wider text-ink-muted">
              {DIAS.map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {semanas.flatMap((semana, sIdx) =>
                semana.map((diaKey, dIdx) => {
                  const evs = eventosPorDia.get(diaKey) ?? [];
                  const dia = new Date(diaKey + "T00:00:00");
                  const esHoyDia = diaKey === hoy;
                  const esMes = dia.getMonth() === mes && dia.getFullYear() === anio;
                  return (
                    <div
                      key={`${sIdx}-${dIdx}`}
                      className={`relative min-h-[100px] p-2 transition-colors ${
                        esMes ? "bg-surface" : "bg-bg-subtle/50"
                      } ${esHoyDia ? "ring-2 ring-alarm" : ""} border border-line-subtle`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`font-mono text-[13px] font-bold ${
                            esHoyDia ? "text-alarm" : esMes ? "text-ink" : "text-ink-secondary"
                          }`}
                        >
                          {dia.getDate()}
                        </span>
                        {esHoyDia && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-alarm/40 bg-alarm/10 px-1.5 py-0.5 font-mono text-[13px] font-bold text-alarm">
                            <span className="h-1.5 w-1.5 rounded-full bg-alarm" aria-hidden />
                            Hoy
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 max-h-[70px] overflow-y-auto pr-1">
                        {evs.slice(0, 3).map((ev) => {
                          const Icono = getIcon(ICONOS_TIPO[ev.tipo]);
                          return (
                            <button
                              key={ev.id}
                              className={`w-full text-left rounded px-1.5 py-1 text-[13px] leading-snug ${obtenerFondoTipo(ev.tipo)} ${obtenerColorTipo(ev.tipo)}`}
                              onClick={() => abrirDetalle(ev)}
                            >
                              <div className="flex items-center gap-1">
                                <Icono className="h-3 w-3 shrink-0" aria-hidden />
                                <span className="font-medium truncate">{ev.titulo}</span>
                              </div>
                              <div className="font-mono text-[13px] font-semibold text-ink-secondary">
                                {formatearHoraEvento(ev.inicio)}
                              </div>
                            </button>
                          );
                        })}
                        {evs.length > 3 && (
                          <button
                            className="w-full text-[13px] text-ink-muted hover:text-ink px-1.5 py-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirDetalle(evs[0]);
                            }}
                          >
                            +{evs.length - 3} más
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DashboardCard>
      </div>

      <div className="lg:hidden">
        <DashboardCard>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-11 w-11 p-0" onClick={mesAnterior} aria-label="Mes anterior">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h3 className="heading-display text-lg text-ink">
                {new Date(Date.UTC(anio, mes, 1)).toLocaleString("es-AR", {
                  month: "long",
                  year: "numeric",
                })}
              </h3>
              <Button variant="ghost" size="sm" className="h-11 w-11 p-0" onClick={mesSiguiente} aria-label="Mes siguiente">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select
                aria-label="Filtrar eventos por tipo"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-40"
              >
                <option value="todos">Todos</option>
                {TIPOS_EVENTO.map((t) => (
                  <option key={t} value={t}>
                    {ETIQUETAS_TIPO[t]}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" size="sm" onClick={irAHoy}>
                <Clock className="h-4 w-4 mr-1" />
                Hoy
              </Button>
            </div>
          </div>

          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-line-subtle bg-bg-subtle px-4 py-8 text-center text-ink-muted">
              <Lucide.Calendar className="h-8 w-8" aria-hidden />
              <p className="text-[14px]">No hay eventos en este mes.</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {Array.from(
                new Set(filtrados.map((e) => fechaDeEvento(e)))
              )
                .sort()
                .map((fechaKey) => {
                  const evs = filtrados.filter((e) => fechaDeEvento(e) === fechaKey);
                  const fecha = new Date(fechaKey + "T00:00:00");
                  const esHoyDia = fechaKey === hoy;
                  return (
                    <div key={fechaKey} className="space-y-2">
                      <div className="flex items-center gap-3 rounded-lg border border-line-subtle bg-bg-subtle px-3 py-2">
                        <div className={`flex flex-col items-center min-w-[56px] ${esHoyDia ? "bg-alarm/10 border border-alarm/40 rounded-xl p-2" : ""}`}>
                          <span className={`font-mono text-lg font-bold ${esHoyDia ? "text-alarm" : "text-ink"}`}>
                            {fecha.getDate()}
                          </span>
                          <span className={`font-mono text-[13px] uppercase tracking-wider ${esHoyDia ? "text-alarm" : "text-ink-muted"}`}>
                            {new Date(fecha).toLocaleString("es-AR", { month: "short" })}
                          </span>
                          {esHoyDia && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-alarm/40 bg-alarm/10 px-1.5 py-0.5 font-mono text-[13px] font-bold text-alarm">
                              <span className="h-1.5 w-1.5 rounded-full bg-alarm" aria-hidden />
                              Hoy
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="heading-display text-base text-ink">
                            {formatFechaKey(fechaKey)}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 ml-14">
                        {evs.map((ev) => {
                          const Icono = getIcon(ICONOS_TIPO[ev.tipo]);
                          return (
                            <button
                              key={ev.id}
                              className={`w-full text-left rounded-xl border p-3 transition-colors hover:bg-surface-hover ${obtenerFondoTipo(ev.tipo)} ${obtenerColorTipo(ev.tipo)}`}
                              onClick={() => abrirDetalle(ev)}
                            >
                              <div className="flex items-start gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-bg-subtle">
                                  <Icono className="h-4 w-4" aria-hidden />
                                </span>
                                <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold text-ink truncate">{ev.titulo}</p>
                                  <span className="font-mono text-[13px] uppercase tracking-wider text-ink-muted shrink-0">
                                    {ETIQUETAS_TIPO[ev.tipo]}
                                  </span>
                                </div>
                                <p className="mt-1 font-mono text-[13px] text-ink-muted">
                                  {formatearHoraEvento(ev.inicio)} - {formatearHoraEvento(ev.fin)}
                                </p>
                                {ev.lugar && (
                                  <p className="mt-1 text-[13px] text-ink-muted truncate">{ev.lugar}</p>
                                )}
                              </div>
                              {oficial && (
                                <Button variant="ghost" size="sm" className="h-10 w-10 p-0" onClick={(e) => { e.stopPropagation(); abrirEditar(ev); }} aria-label="Editar">
                                  <Lucide.Edit2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    </div>
                  );
                })}
            </div>
          )}
        </DashboardCard>
      </div>

      {oficial && (
        <QuickAction
          icono={Plus}
          titulo="Nuevo evento"
          descripcion="Crear capacitación, reunión, simulacro, acto u otra actividad."
          onClick={abrirCrear}
          className="lg:hidden"
        />
      )}

      <Hoja
        open={hojaOpen}
        onClose={cerrarHoja}
        title={hojaModo === "crear" ? "Nuevo evento" : hojaModo === "editar" ? "Editar evento" : hojaEvento?.titulo ?? "Detalle"}
        className="max-w-lg"
      >
        <form onSubmit={onGuardar} className="space-y-4">
          {errorHoja && (
            <Aviso variante="error">{errorHoja}</Aviso>
          )}

          <div className="space-y-2">
            <label htmlFor="titulo" className="text-[14px] font-semibold text-ink">
              Título *
            </label>
            <Input
              id="titulo"
              value={formulario.titulo}
              onChange={(e) => setFormulario({ ...formulario, titulo: e.target.value })}
              placeholder="Título del evento"
              maxLength={120}
              required
              disabled={guardando || eliminando}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="descripcion" className="text-[14px] font-semibold text-ink">
              Descripción
            </label>
            <Textarea
              id="descripcion"
              value={formulario.descripcion}
              onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })}
              placeholder="Detalles, temario, observaciones..."
              maxLength={2000}
              rows={3}
              disabled={guardando || eliminando}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="tipo" className="text-[14px] font-semibold text-ink">
              Tipo *
            </label>
            <Select id="tipo" value={formulario.tipo} onChange={(e) => setFormulario({ ...formulario, tipo: e.target.value as TipoEvento })}>
              {TIPOS_EVENTO.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETAS_TIPO[t]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="inicio" className="text-[14px] font-semibold text-ink">
                Inicio *
              </label>
              <Input
                id="inicio"
                type="datetime-local"
                value={formulario.inicio}
                onChange={(e) => setFormulario({ ...formulario, inicio: e.target.value })}
                required
                disabled={guardando || eliminando}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="fin" className="text-[14px] font-semibold text-ink">
                Fin *
              </label>
              <Input
                id="fin"
                type="datetime-local"
                value={formulario.fin}
                onChange={(e) => setFormulario({ ...formulario, fin: e.target.value })}
                required
                disabled={guardando || eliminando}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="lugar" className="text-[14px] font-semibold text-ink">
              Lugar
            </label>
            <Input
              id="lugar"
              value={formulario.lugar}
              onChange={(e) => setFormulario({ ...formulario, lugar: e.target.value })}
              placeholder="Cuartel, salón, dirección..."
              maxLength={200}
              disabled={guardando || eliminando}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-line">
            {hojaModo === "editar" && hojaEvento && !eliminando && (
              <Button
                type="button"
                variant="secondary"
                className="flex-1 border-fire bg-transparent text-fire-text hover:bg-fire-light"
                onClick={() => {
                  if (errorHoja?.includes("Confirmá")) {
                    onBorrar();
                  } else {
                    setErrorHoja("Confirmá borrando de nuevo.");
                  }
                }}
                disabled={guardando}
              >
                {eliminando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Borrando...
                  </>
                ) : errorHoja?.includes("Confirmá") ? (
                  "Confirmar borrado"
                ) : (
                  "Borrar evento"
                )}
              </Button>
            )}
            <Button type="submit" className="flex-1" disabled={guardando}>
              {guardando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Guardando...
                </>
              ) : hojaModo === "editar" ? (
                "Guardar cambios"
              ) : (
                "Crear evento"
              )}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={cerrarHoja} disabled={guardando || eliminando}>
              Cancelar
            </Button>
          </div>
        </form>
      </Hoja>
    </div>
  );
}