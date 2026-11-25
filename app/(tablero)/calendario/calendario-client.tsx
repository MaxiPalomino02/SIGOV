"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CalendarDays,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { borrarEvento, crearEvento, editarEvento } from "./actions";
import { formatFechaKey, hoyArgentina, sumarDias } from "@/lib/tablero";
import {
  TIPOS_EVENTO,
  ETIQUETAS_TIPO,
  type Evento,
  type TipoEvento,
  cargarEventos,
  formatearHoraEvento,
} from "@/lib/eventos";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const FILTROS: Array<"todos" | TipoEvento> = ["todos", ...TIPOS_EVENTO];

function capitalizar(texto: string) {
  return texto.length > 0 ? texto[0].toUpperCase() + texto.slice(1) : texto;
}

function nombreMes(anio: number, mes: number) {
  const nombre = new Date(Date.UTC(anio, mes, 1)).toLocaleString("es-AR", {
    month: "long",
    timeZone: "UTC",
  });
  return `${capitalizar(nombre)} ${anio}`;
}

function fechaDeEvento(e: Evento): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Tucuman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(e.inicio));
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

function inicioMesKey(anio: number, mes: number) {
  return `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
}

function finMesKey(anio: number, mes: number) {
  const fin = new Date(Date.UTC(anio, mes + 1, 0));
  return fin.toISOString().slice(0, 10);
}

function generarSemanas(anio: number, mes: number): string[][] {
  const inicioMes = inicioMesKey(anio, mes);
  const finMes = finMesKey(anio, mes);
  const diaSemanaInicio = new Date(`${inicioMes}T00:00:00Z`).getUTCDay();
  const offsetInicio = diaSemanaInicio === 0 ? -6 : 1 - diaSemanaInicio;
  const diaSemanaFin = new Date(`${finMes}T00:00:00Z`).getUTCDay();
  const offsetFin = diaSemanaFin === 0 ? 0 : 7 - diaSemanaFin;
  let cursor = sumarDias(inicioMes, offsetInicio);
  const finGrid = sumarDias(finMes, offsetFin);
  const dias: string[] = [];
  while (cursor <= finGrid) {
    dias.push(cursor);
    cursor = sumarDias(cursor, 1);
  }
  const semanas: string[][] = [];
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));
  return semanas;
}

function semanaDe(fechaKey: string) {
  const d = new Date(`${fechaKey}T00:00:00Z`);
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const lunes = sumarDias(fechaKey, offset);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

function encabezadoDia(fechaKey: string) {
  const [anio, mes, dia] = fechaKey.split("-").map(Number);
  const d = new Date(anio, (mes ?? 1) - 1, dia ?? 1);
  const nombre = d.toLocaleDateString("es-AR", { weekday: "long" }).toUpperCase();
  const dd = String(dia ?? "").padStart(2, "0");
  const mm = String(mes ?? "").padStart(2, "0");
  return `${nombre} ${dd}/${mm}`;
}

function horaRango(inicio: string, fin: string) {
  return `${formatearHoraEvento(inicio)} - ${formatearHoraEvento(fin)}`;
}

function colorBarra(tipo: TipoEvento) {
  if (tipo === "simulacro") return "bg-red";
  if (tipo === "capacitacion" || tipo === "acto") return "bg-yellow";
  return "bg-label-3";
}

function colorPunto(tipo: TipoEvento) {
  if (tipo === "simulacro") return "bg-red";
  if (tipo === "capacitacion" || tipo === "acto") return "bg-yellow";
  return "bg-label-3";
}

function ChipTipo({ tipo }: { tipo: TipoEvento }) {
  const tono =
    tipo === "simulacro"
      ? "bg-red-tint text-red"
      : tipo === "capacitacion" || tipo === "acto"
        ? "bg-yellow-tint text-yellow-ink"
        : "bg-surface-2 text-label-2";
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[13px] font-medium ${tono}`}>
      {ETIQUETAS_TIPO[tipo]}
    </span>
  );
}

type CalendarioClientProps = {
  oficial: boolean;
};

export function CalendarioClient({ oficial }: CalendarioClientProps) {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | TipoEvento>("todos");
  const hoy = hoyArgentina();
  const [anio, setAnio] = useState<number>(() => {
    const d = new Date(`${hoyArgentina()}T00:00:00`);
    return d.getFullYear();
  });
  const [mes, setMes] = useState<number>(() => {
    const d = new Date(`${hoyArgentina()}T00:00:00`);
    return d.getMonth();
  });
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(hoyArgentina());
  const [hojaDiaOpen, setHojaDiaOpen] = useState(false);
  const [hojaFormOpen, setHojaFormOpen] = useState(false);
  const [hojaDetalleOpen, setHojaDetalleOpen] = useState(false);
  const [eventoDetalle, setEventoDetalle] = useState<Evento | null>(null);
  const [editando, setEditando] = useState<Evento | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorHoja, setErrorHoja] = useState<string | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [formulario, setFormulario] = useState({
    titulo: "",
    descripcion: "",
    tipo: "capacitacion" as TipoEvento,
    inicio: "",
    fin: "",
    lugar: "",
  });
  const refsDias = useRef<Record<string, HTMLDivElement | null>>({});

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

  const filtrados = useMemo(
    () => eventos.filter((e) => filtroTipo === "todos" || e.tipo === filtroTipo),
    [eventos, filtroTipo]
  );

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, Evento[]>();
    for (const e of filtrados) {
      const f = fechaDeEvento(e);
      const arr = mapa.get(f) ?? [];
      arr.push(e);
      mapa.set(f, arr);
    }
    for (const arr of mapa.values()) arr.sort((a, b) => a.inicio.localeCompare(b.inicio));
    return mapa;
  }, [filtrados]);

  const semanas = useMemo(() => generarSemanas(anio, mes), [anio, mes]);
  const semanaActual = useMemo(() => semanaDe(diaSeleccionado), [diaSeleccionado]);
  const diasConEventos = useMemo(() => Array.from(eventosPorDia.keys()).sort(), [eventosPorDia]);
  const eventosDiaSeleccionado = eventosPorDia.get(diaSeleccionado) ?? [];

  const mesAnterior = () => {
    setMes((m) => {
      if (m === 0) {
        setAnio((a) => a - 1);
        return 11;
      }
      return m - 1;
    });
  };
  const mesSiguiente = () => {
    setMes((m) => {
      if (m === 11) {
        setAnio((a) => a + 1);
        return 0;
      }
      return m + 1;
    });
  };
  const irAHoy = () => {
    const d = new Date(`${hoy}T00:00:00`);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
    setDiaSeleccionado(hoy);
  };

  const abrirCrear = (fechaBase?: string) => {
    const base = fechaBase ?? diaSeleccionado;
    const inicio = `${base}T09:00`;
    const fin = `${base}T10:00`;
    setFormulario({
      titulo: "",
      descripcion: "",
      tipo: "capacitacion",
      inicio,
      fin,
      lugar: "",
    });
    setEditando(null);
    setErrorHoja(null);
    setHojaDetalleOpen(false);
    setHojaDiaOpen(false);
    setHojaFormOpen(true);
  };

  const abrirDetalle = (e: Evento) => {
    setEventoDetalle(e);
    setConfirmarBorrar(false);
    setErrorHoja(null);
    setHojaDetalleOpen(true);
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
    setEditando(e);
    setConfirmarBorrar(false);
    setErrorHoja(null);
    setHojaDetalleOpen(false);
    setHojaFormOpen(true);
  };

  const cerrarHojas = () => {
    setHojaDiaOpen(false);
    setHojaFormOpen(false);
    setHojaDetalleOpen(false);
    setEventoDetalle(null);
    setEditando(null);
    setConfirmarBorrar(false);
    setErrorHoja(null);
  };

  const onGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorHoja(null);
    setGuardando(true);
    try {
      const res = editando
        ? await editarEvento(
            editando.id,
            formulario.titulo,
            formulario.descripcion,
            formulario.tipo,
            formulario.inicio,
            formulario.fin,
            formulario.lugar
          )
        : await crearEvento(
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
      cerrarHojas();
      await recargar();
    } catch (err) {
      console.error("Error guardando evento:", err);
      setErrorHoja("Error inesperado. Volvé a intentar.");
    } finally {
      setGuardando(false);
    }
  };

  const onBorrar = async () => {
    if (!eventoDetalle) return;
    setGuardando(true);
    setErrorHoja(null);
    try {
      const res = await borrarEvento(eventoDetalle.id);
      if (!res.ok) {
        setErrorHoja(res.error);
        return;
      }
      cerrarHojas();
      await recargar();
    } catch (err) {
      console.error("Error borrando evento:", err);
      setErrorHoja("Error inesperado. Volvé a intentar.");
    } finally {
      setGuardando(false);
    }
  };

  const saltarADia = (fechaKey: string) => {
    setDiaSeleccionado(fechaKey);
    const d = new Date(`${fechaKey}T00:00:00`);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
    window.requestAnimationFrame(() => {
      refsDias.current[fechaKey]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <>
      <PageHeader
        titulo={nombreMes(anio, mes)}
        acciones={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={mesAnterior}
              aria-label="Mes anterior"
              className="tap flex h-11 w-11 items-center justify-center rounded-[14px] text-label transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
            >
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden />
            </button>
            <button
              type="button"
              onClick={irAHoy}
              className="tap min-h-[44px] rounded-[14px] px-3 text-[15px] font-semibold text-red transition-colors hover:bg-red-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={mesSiguiente}
              aria-label="Mes siguiente"
              className="tap flex h-11 w-11 items-center justify-center rounded-[14px] text-label transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
            >
              <ChevronRight size={22} strokeWidth={1.75} aria-hidden />
            </button>
            {oficial ? (
              <button
                type="button"
                onClick={() => abrirCrear()}
                aria-label="Nuevo evento"
                className="tap flex h-11 w-11 items-center justify-center rounded-[14px] bg-red text-surface transition-colors hover:bg-red-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
              >
                <Plus size={22} strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </div>
        }
      />

      <div className="mx-auto w-full max-w-[1100px] space-y-4 px-4 pb-8 pt-4 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTROS.map((f) => {
            const activo = filtroTipo === f;
            const etiqueta = f === "todos" ? "Todos" : ETIQUETAS_TIPO[f];
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFiltroTipo(f)}
                className={`tap shrink-0 rounded-full px-4 py-2 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
                  activo ? "bg-red text-surface" : "bg-surface text-label-2"
                }`}
              >
                {etiqueta}
              </button>
            );
          })}
        </div>

        {error ? (
          <Grupo>
            <div className="px-4 py-5">
              <p className="text-[17px] font-semibold text-label">No se pudo cargar el calendario</p>
              <p className="mt-1 text-[15px] text-label-2">{error}</p>
            </div>
          </Grupo>
        ) : loading ? (
          <Grupo>
            <div className="px-4 py-8 text-center text-[15px] text-label-2">Cargando calendario…</div>
          </Grupo>
        ) : (
          <>
            <div className="hidden lg:block">
              <Grupo>
                <div className="p-4">
                  <div className="grid grid-cols-7 gap-2">
                    {DIAS.map((d) => (
                      <div key={d} className="py-2 text-center text-[13px] font-semibold text-label-2">
                        {d}
                      </div>
                    ))}
                    {semanas.flat().map((fechaKey) => {
                      const [ya, ma, da] = fechaKey.split("-").map(Number);
                      const esMesActual = ya === anio && ma === mes + 1;
                      const esHoy = fechaKey === hoy;
                      const evs = eventosPorDia.get(fechaKey) ?? [];
                      const visibles = evs.slice(0, 3);
                      const extra = evs.length - visibles.length;
                      return (
                        <button
                          key={fechaKey}
                          type="button"
                          onClick={() => {
                            setDiaSeleccionado(fechaKey);
                            setHojaDiaOpen(true);
                          }}
                          className="tap flex min-h-[112px] flex-col items-center rounded-[14px] bg-surface px-2 py-2 text-center transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
                          aria-label={`Ver eventos del ${formatFechaKey(fechaKey)}`}
                        >
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-[17px] font-semibold ${
                              esHoy
                                ? "bg-red text-surface"
                                : esMesActual
                                  ? "text-label"
                                  : "text-label-3"
                            }`}
                          >
                            {da}
                          </span>
                          <div className="mt-2 flex min-h-[14px] items-center justify-center gap-1">
                            {visibles.map((ev) => (
                              <span
                                key={ev.id}
                                className={`h-[6px] w-[6px] rounded-full ${colorPunto(ev.tipo)}`}
                                aria-hidden
                              />
                            ))}
                            {extra > 0 ? <span className="text-[13px] text-label-2">+{extra}</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Grupo>
            </div>

            <div className="space-y-4 lg:hidden">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {semanaActual.map((fechaKey) => {
                  const dia = Number(fechaKey.slice(8, 10));
                  const seleccionado = fechaKey === diaSeleccionado;
                  const esHoy = fechaKey === hoy;
                  return (
                    <button
                      key={fechaKey}
                      type="button"
                      onClick={() => saltarADia(fechaKey)}
                      aria-label={`Ir al ${formatFechaKey(fechaKey)}`}
                      className={`tap flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[17px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
                        esHoy
                          ? "bg-red text-surface"
                          : seleccionado
                            ? "bg-red-tint text-red"
                            : "bg-surface text-label"
                      }`}
                    >
                      {dia}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                {diasConEventos.length === 0 ? (
                  <Grupo>
                    <div className="px-4 py-8 text-center">
                      <CalendarDays size={22} strokeWidth={1.75} className="mx-auto text-label-3" aria-hidden />
                      <p className="mt-2 text-[15px] text-label-2">Sin eventos</p>
                    </div>
                  </Grupo>
                ) : (
                  diasConEventos.map((fechaKey) => {
                    const evs = eventosPorDia.get(fechaKey) ?? [];
                    return (
                      <div
                        key={fechaKey}
                        ref={(el) => {
                          refsDias.current[fechaKey] = el;
                        }}
                        className="scroll-mt-28"
                      >
                        <p className="mb-2 px-1 text-[13px] font-semibold tracking-[.3px] text-label-2">
                          {encabezadoDia(fechaKey)}
                        </p>
                        <Grupo>
                          {evs.length === 0 ? (
                            <div className="px-4 py-3 text-[15px] text-label-2">Sin eventos</div>
                          ) : (
                            <ul>
                              {evs.map((ev, idx) => (
                                <li key={ev.id} className={idx > 0 ? "border-t border-separator" : ""}>
                                  <button
                                    type="button"
                                    onClick={() => abrirDetalle(ev)}
                                    className="tap flex w-full items-stretch gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
                                  >
                                    <span className={`mt-1 w-1 shrink-0 rounded-full ${colorBarra(ev.tipo)}`} aria-hidden />
                                    <span className="min-w-0 flex-1">
                                      <span className="flex items-start justify-between gap-3">
                                        <span className="min-w-0">
                                          <span className="num block text-[15px] font-semibold text-label">
                                            {horaRango(ev.inicio, ev.fin)}
                                          </span>
                                          <span className="mt-0.5 block text-[17px] font-medium text-label">{ev.titulo}</span>
                                          {ev.lugar ? (
                                            <span className="mt-0.5 block truncate text-[15px] text-label-2">{ev.lugar}</span>
                                          ) : null}
                                        </span>
                                        <ChipTipo tipo={ev.tipo} />
                                      </span>
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </Grupo>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <Hoja
        open={hojaDiaOpen}
        onClose={() => setHojaDiaOpen(false)}
        title={formatFechaKey(diaSeleccionado)}
        footer={
          oficial ? (
            <Button className="w-full" onClick={() => abrirCrear(diaSeleccionado)}>
              <Plus size={22} strokeWidth={1.75} aria-hidden />
              Nuevo evento
            </Button>
          ) : undefined
        }
      >
        {eventosDiaSeleccionado.length === 0 ? (
          <p className="text-[15px] text-label-2">Sin eventos</p>
        ) : (
          <ul className="-mx-5">
            {eventosDiaSeleccionado.map((ev, idx) => (
              <li key={ev.id} className={idx > 0 ? "border-t border-separator" : ""}>
                <button
                  type="button"
                  onClick={() => {
                    setHojaDiaOpen(false);
                    abrirDetalle(ev);
                  }}
                  className="tap flex w-full items-start gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
                >
                  <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${colorPunto(ev.tipo)}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="num block text-[15px] font-semibold text-label">{horaRango(ev.inicio, ev.fin)}</span>
                    <span className="block text-[17px] font-medium text-label">{ev.titulo}</span>
                    {ev.lugar ? <span className="block text-[15px] text-label-2">{ev.lugar}</span> : null}
                  </span>
                  <ChipTipo tipo={ev.tipo} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Hoja>

      <Hoja
        open={hojaDetalleOpen}
        onClose={() => {
          setHojaDetalleOpen(false);
          setEventoDetalle(null);
          setConfirmarBorrar(false);
          setErrorHoja(null);
        }}
        title="Detalle del evento"
        footer={
          oficial && eventoDetalle ? (
            confirmarBorrar ? (
              <div className="space-y-2">
                <p className="text-[15px] text-label-2">¿Querés borrar este evento? Esta acción no se puede deshacer.</p>
                <div className="flex gap-2">
                  <Button variant="danger" className="flex-1" onClick={onBorrar} disabled={guardando}>
                    {guardando ? "Borrando…" : "Borrar"}
                  </Button>
                  <Button variant="secondary" className="flex-1" onClick={() => setConfirmarBorrar(false)} disabled={guardando}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => eventoDetalle && abrirEditar(eventoDetalle)}>
                  <Pencil size={22} strokeWidth={1.75} aria-hidden />
                  Editar
                </Button>
                <Button variant="danger" className="flex-1" onClick={() => setConfirmarBorrar(true)}>
                  <Trash2 size={22} strokeWidth={1.75} aria-hidden />
                  Borrar
                </Button>
              </div>
            )
          ) : undefined
        }
      >
        {eventoDetalle ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-[22px] font-bold text-label">{eventoDetalle.titulo}</h3>
              <div className="mt-2">
                <ChipTipo tipo={eventoDetalle.tipo} />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Clock size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-label-2" aria-hidden />
                <div>
                  <p className="text-[17px] text-label">{formatFechaKey(fechaDeEvento(eventoDetalle))}</p>
                  <p className="num text-[15px] text-label-2">{horaRango(eventoDetalle.inicio, eventoDetalle.fin)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-label-2" aria-hidden />
                <p className="text-[17px] text-label">{eventoDetalle.lugar || "Sin lugar"}</p>
              </div>
              <div className="flex items-start gap-3">
                <CalendarDays size={22} strokeWidth={1.75} className="mt-0.5 shrink-0 text-label-2" aria-hidden />
                <p className="text-[17px] text-label">{eventoDetalle.descripcion || "Sin descripción"}</p>
              </div>
            </div>
            {errorHoja ? <p role="alert" className="text-[15px] font-semibold text-red">{errorHoja}</p> : null}
          </div>
        ) : null}
      </Hoja>

      <Hoja
        open={hojaFormOpen}
        onClose={cerrarHojas}
        title={editando ? "Editar evento" : "Nuevo evento"}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={cerrarHojas} disabled={guardando}>
              Cancelar
            </Button>
            <Button className="flex-1" type="submit" form="form-evento" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        }
      >
        <form id="form-evento" onSubmit={onGuardar} className="space-y-4">
          {errorHoja ? <p role="alert" className="text-[15px] font-semibold text-red">{errorHoja}</p> : null}
          <Input
            label="Título"
            value={formulario.titulo}
            onChange={(e) => setFormulario({ ...formulario, titulo: e.target.value })}
            maxLength={120}
            required
            disabled={guardando}
          />
          <Select
            label="Tipo"
            value={formulario.tipo}
            onChange={(e) => setFormulario({ ...formulario, tipo: e.target.value as TipoEvento })}
            disabled={guardando}
          >
            {TIPOS_EVENTO.map((t) => (
              <option key={t} value={t}>
                {ETIQUETAS_TIPO[t]}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Inicio"
              type="datetime-local"
              value={formulario.inicio}
              onChange={(e) => setFormulario({ ...formulario, inicio: e.target.value })}
              required
              disabled={guardando}
            />
            <Input
              label="Fin"
              type="datetime-local"
              value={formulario.fin}
              onChange={(e) => setFormulario({ ...formulario, fin: e.target.value })}
              required
              disabled={guardando}
            />
          </div>
          <Input
            label="Lugar"
            value={formulario.lugar}
            onChange={(e) => setFormulario({ ...formulario, lugar: e.target.value })}
            maxLength={200}
            disabled={guardando}
          />
          <Textarea
            label="Descripción"
            value={formulario.descripcion}
            onChange={(e) => setFormulario({ ...formulario, descripcion: e.target.value })}
            maxLength={2000}
            rows={4}
            disabled={guardando}
          />
        </form>
      </Hoja>
    </>
  );
}
