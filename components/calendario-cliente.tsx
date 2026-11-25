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
import { borrarEvento, crearEvento, editarEvento } from "@/app/(tablero)/calendario/actions";
import {
  dateToKey,
  formatFechaKey,
  hoyArgentina,
  sumarDias,
} from "@/lib/tablero";
import { Aviso } from "@/components/ui/aviso";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Hoja } from "@/components/ui/hoja";
import { QuickAction } from "@/components/ui/quick-action";
import { SectionHeading } from "@/components/ui/section-heading";

const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const TIPOS: string[] = ["capacitacion", "reunion", "simulacro", "acto", "otro"];
const TIPOS_LABEL: Record<string, string> = {
  capacitacion: "Capacitación",
  reunion: "Reunión",
  simulacro: "Simulacro",
  acto: "Acto",
  otro: "Otro",
};

type Evento = {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: string;
  inicio: string;
  fin: string;
  lugar: string;
  creado_por: string | null;
  creada_en: string;
  actualizada_en: string;
};

function fechaDeEvento(e: Evento): string {
  return dateToKey(new Date(e.inicio));
}

function formatearHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Argentina/Tucuman",
  });
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

function chipClase(tipo: string): string {
  switch (tipo) {
    case "capacitacion":
    case "acto":
      return "border-brass-border bg-brass-light text-brass";
    case "reunion":
    case "simulacro":
      return "border-alarm-border bg-alarm-light text-alarm";
    default:
      return "border-line bg-surface-hover text-ink-muted";
  }
}

function generarSemanas(anio: number, mes: number): string[][] {
  const inicio = new Date(Date.UTC(anio, mes, 1));
  const dSemana = inicio.getUTCDay();
  const offset = dSemana === 0 ? -6 : 1 - dSemana;
  inicio.setUTCDate(inicio.getUTCDate() + offset);

  const fin = new Date(Date.UTC(anio, mes + 1, 0));
  const dFin = fin.getUTCDay();
  const offsetFin = dFin === 0 ? 0 : 7 - dFin;
  fin.setUTCDate(fin.getUTCDate() + offsetFin);

  const dias: string[] = [];
  let cursor = dateToKey(inicio);
  const finStr = dateToKey(fin);
  while (cursor <= finStr) {
    dias.push(cursor);
    cursor = sumarDias(cursor, 1);
  }

  const semanas: string[][] = [];
  for (let i = 0; i < dias.length; i += 7) {
    semanas.push(dias.slice(i, i + 7));
  }
  return semanas;
}

type CalendarioClientProps = {
  eventosIniciales: Evento[];
  cargaError: string | null;
  oficial: boolean;
};

export function CalendarioClient({
  eventosIniciales,
  cargaError,
  oficial,
}: CalendarioClientProps) {
  const [eventos, setEventos] = useState<Evento[]>(eventosIniciales);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const hoy = hoyArgentina();
  const ahora = new Date();
  const [anio, setAnio] = useState<number>(ahora.getFullYear());
  const [mes, setMes] = useState<number>(ahora.getMonth());
  const [hojaOpen, setHojaOpen] = useState(false);
  const [hojaModo, setHojaModo] = useState<"detalle" | "crear" | "editar">("detalle");
  const [hojaEvento, setHojaEvento] = useState<Evento | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aplicarCambioTiempoReal = useCallback(
    (payload: unknown) => {
      const row = payload as Record<string, unknown>;
      const tipo = (row as Record<string, string>)?.eventType;
      if (tipo === "INSERT") {
        const e = (row as Record<string, unknown>).new as unknown as Evento;
        if (e?.id) setEventos((prev) => [...prev, e]);
      } else if (tipo === "UPDATE") {
        const e = (row as Record<string, unknown>).new as unknown as Evento;
        if (e?.id)
          setEventos((prev) =>
            prev.map((x) => (x.id === e.id ? e : x))
          );
      } else if (tipo === "DELETE") {
        const id = (row as Record<string, unknown>).old as unknown as { id: string };
        if (id?.id) setEventos((prev) => prev.filter((x) => x.id !== id.id));
      }
    },
    []
  );

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const canal = supabase.channel("calendario-eventos");
    canal.on("postgres_changes", { event: "INSERT", schema: "public", table: "eventos" }, aplicarCambioTiempoReal);
    canal.on("postgres_changes", { event: "UPDATE", schema: "public", table: "eventos" }, aplicarCambioTiempoReal);
    canal.on("postgres_changes", { event: "DELETE", schema: "public", table: "eventos" }, aplicarCambioTiempoReal);
    void canal.subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [aplicarCambioTiempoReal]);

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
  const nombreMes = new Date(Date.UTC(anio, mes, 1)).toLocaleString("es-AR", {
    month: "long",
    year: "numeric",
  });

  const mesAnterior = () => {
    setMes((m) => (m === 0 ? 11 : m - 1));
    setAnio((a) => (mes === 0 ? a - 1 : a));
  };
  const mesSiguiente = () => {
    setMes((m) => (m === 11 ? 0 : m + 1));
    setAnio((a) => (mes === 11 ? a + 1 : a));
  };

  const abrirCrear = () => {
    setHojaModo("crear");
    setHojaEvento(null);
    setHojaOpen(true);
  };

  const abrirDetalle = (e: Evento) => {
    setHojaModo("detalle");
    setHojaEvento(e);
    setHojaOpen(true);
  };

  const cerrarHoja = () => {
    setHojaOpen(false);
    setHojaEvento(null);
    setError(null);
  };

  const onGuardar = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setGuardando(true);
    setError(null);
    const form = evt.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const titulo = String(fd.get("titulo") ?? "").trim();
    const descripcion = String(fd.get("descripcion") ?? "").trim();
    const tipo = String(fd.get("tipo") ?? "").trim();
    const lugar = String(fd.get("lugar") ?? "").trim();
    const inicio = String(fd.get("inicio") ?? "").trim();
    const fin = String(fd.get("fin") ?? "").trim();

    let res: { ok: boolean; error?: string };
    if (hojaModo === "crear") {
      res = await crearEvento(titulo, descripcion, tipo, inicio, fin, lugar);
    } else {
      res = await editarEvento(
        hojaEvento?.id ?? "",
        titulo,
        descripcion,
        tipo,
        inicio,
        fin,
        lugar
      );
    }
    setGuardando(false);
    if (res.ok) {
      cerrarHoja();
    } else {
      setError(res.error ?? "Ocurrió un error. Intentá de nuevo.");
    }
  };

  const onBorrar = async () => {
    if (!hojaEvento) return;
    if (!window.confirm("¿Borrar este evento?")) return;
    setGuardando(true);
    const res = await borrarEvento(hojaEvento.id);
    setGuardando(false);
    if (res.ok) {
      cerrarHoja();
    } else {
      setError(res.error ?? "Ocurrió un error. Intentá de nuevo.");
    }
  };

  const esHoy = (fechaKey: string) => fechaKey === hoy;

  const diasConEventos = Array.from(eventosPorDia.keys()).sort();

  return (
    <div className="space-y-4">
      <SectionHeading
        titulo="Calendario de eventos"
        descripcion="Capacitaciones, reuniones, simulacros y actos programados del cuartel."
      />

      {cargaError ? (
        <DashboardCard
          titulo="Calendario"
          error={cargaError}
          empty={true}
          emptyTexto="No se pudo cargar el calendario. Intentá de nuevo más tarde."
        />
      ) : (
        <DashboardCard
          titulo="Eventos del cuartel"
          descripcion="Seleccioná un evento para ver su detalle. Los oficiales pueden crear, editar y borrar eventos."
          empty={filtrados.length === 0}
          emptyTexto="No hay eventos programados."
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] uppercase tracking-widest text-ink-muted">
                Tipo
              </span>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="rounded-xl border border-line bg-surface px-3 py-1.5 text-[13px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire"
              >
                <option value="todos">Todos</option>
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{TIPOS_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={mesAnterior}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink hover:bg-surface-hover"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <span className="font-mono text-[13px] font-bold text-ink">
                {nombreMes}
              </span>
              <button
                type="button"
                onClick={mesSiguiente}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink hover:bg-surface-hover"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {oficial ? (
              <QuickAction
                icono={Plus}
                titulo="Nuevo evento"
                descripcion="Cargar capacitación, reunión, simulacro o acto."
                onClick={abrirCrear}
              />
            ) : null}
          </div>

          {/* Vista mes (escritorio) */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {DIAS.map((d) => (
                <div
                  key={d}
                  className="font-mono text-[13px] font-bold text-ink-secondary"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {semanas.map((semana, si) => (
                <div key={si} className="grid grid-cols-7 gap-1">
                  {semana.map((fechaKey) => {
                    const esDiaHoy = esHoy(fechaKey);
                    const esDelMes =
                      new Date(fechaKey).getMonth() === mes;
                    const diaEventos =
                      (eventosPorDia.get(fechaKey) ?? []).sort(
                        (a, b) =>
                          a.inicio.localeCompare(b.inicio)
                      );
                    return (
                      <div
                        key={fechaKey}
                        className={`flex flex-col gap-1 p-1.5 rounded-xl border min-h-[100px] ${
                          esDiaHoy
                            ? "border-alarm-border bg-alarm-light"
                            : "border-line bg-surface-hover"
                        } ${!esDelMes ? "text-ink-secondary" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[13px] font-bold">
                            {new Date(fechaKey).getDate()}
                          </span>
                          {esDiaHoy && (
                            <span className="h-1.5 w-1.5 rounded-full bg-alarm" aria-hidden />
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {diaEventos.slice(0, 3).map((e) => (
                            <div
                              key={e.id}
                              onClick={() => abrirDetalle(e)}
                              className="cursor-pointer truncate text-[13px] leading-none px-1 py-0.5 rounded bg-surface text-ink-muted hover:bg-surface-hover"
                              title={e.titulo}
                            >
                              {e.titulo}
                            </div>
                          ))}
                          {diaEventos.length > 3 && (
                            <span className="text-[13px] text-ink-secondary">
                              +{diaEventos.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[13px] text-ink-secondary">
              Vista de mes. En celular se muestra como lista agrupada por día.
            </p>
          </div>

          {/* Vista lista (celular) */}
          <div className="lg:hidden space-y-2">
            {diasConEventos.length === 0 && (
              <EstadoVacio
                icono="CalendarDays"
                titulo="Sin eventos"
                texto="No hay eventos programados para los filtros seleccionados."
              />
            )}
            {diasConEventos.map((fechaKey) => {
              const diaEventos =
                (eventosPorDia.get(fechaKey) ?? []).sort(
                  (a, b) => a.inicio.localeCompare(b.inicio)
                );
              return (
                <div key={fechaKey} className="space-y-1">
                  <h3
                    className={`font-mono text-[13px] uppercase tracking-widest mb-1 ${
                      esHoy(fechaKey) ? "text-alarm" : "text-ink-muted"
                    }`}
                  >
                    {formatFechaKey(fechaKey)}
                    {esHoy(fechaKey) && (
                      <span className="ml-2 text-[13px]">· Hoy</span>
                    )}
                  </h3>
                  <div className="space-y-1">
                    {diaEventos.map((e) => (
                      <div
                        key={e.id}
                        onClick={() => abrirDetalle(e)}
                        className="cursor-pointer flex items-center justify-between gap-2 rounded-xl border border-line bg-surface p-3 text-left hover:bg-surface-hover"
                      >
                        <div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[13px] font-semibold ${chipClase(
                              e.tipo
                            )}`}
                          >
                            {TIPOS_LABEL[e.tipo]}
                          </span>
                          <p className="mt-0.5 text-[14px] font-bold text-ink">
                            {e.titulo}
                          </p>
                          <p className="text-[13px] text-ink-muted">
                            {formatearHora(e.inicio)} - {formatearHora(e.fin)}
                          </p>
                          {e.lugar && (
                            <p className="mt-0.5 text-[13px] text-ink-secondary flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                              {e.lugar}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-ink-secondary" aria-hidden />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DashboardCard>
      )}

      {error && (
        <Aviso variante="error">{error}</Aviso>
      )}

      <Hoja
        open={hojaOpen}
        onClose={cerrarHoja}
        title={hojaModo === "crear" ? "Nuevo evento" : "Detalle del evento"}
      >
        {hojaModo === "detalle" && hojaEvento ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold ${chipClase(
                  hojaEvento.tipo
                )}`}
              >
                {TIPOS_LABEL[hojaEvento.tipo]}
              </span>
              {oficial && (
                <button
                  type="button"
                  onClick={() => {
                    setHojaModo("editar");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-[13px] text-ink hover:bg-surface-hover"
                >
                  <X className="h-4 w-4" aria-hidden /> Editar
                </button>
              )}
            </div>
            <h3 className="heading-display text-lg text-ink">
              {hojaEvento.titulo}
            </h3>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-muted">
              {hojaEvento.descripcion || "Sin descripción."}
            </p>
            <div className="mt-3 space-y-1 text-[14px]">
              <p className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                {formatFechaKey(fechaDeEvento(hojaEvento))} ·{" "}
                {formatearHora(hojaEvento.inicio)} - {formatearHora(hojaEvento.fin)}
              </p>
              {hojaEvento.lugar && (
                <p className="flex items-center gap-2 text-[14px] text-ink-muted">
                  <MapPin className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                  {hojaEvento.lugar}
                </p>
              )}
            </div>
            {oficial ? (
              <button
                type="button"
                onClick={onBorrar}
                disabled={guardando}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-fire bg-transparent px-4 py-2 text-[14px] font-semibold text-fire-text hover:bg-fire-light disabled:opacity-60"
              >
                <X className="h-4 w-4" aria-hidden /> Borrar evento
              </button>
            ) : null}
          </div>
        ) : (
          <form
            onSubmit={onGuardar}
            className="space-y-3"
            key={hojaEvento?.id ?? "nuevo"}
          >
            <input type="hidden" name="id" defaultValue={hojaEvento?.id ?? ""} />
            <div>
              <label className="block text-[13px] font-bold uppercase tracking-widest text-ink-muted">
                Título
              </label>
              <input
                name="titulo"
                defaultValue={hojaModo === "editar" ? hojaEvento?.titulo ?? "" : ""}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire"
                required
              />
            </div>
            <div>
              <label className="block text-[13px] font-bold uppercase tracking-widest text-ink-muted">
                Tipo
              </label>
              <select
                name="tipo"
                defaultValue={
                  hojaModo === "editar" ? hojaEvento?.tipo ?? "capacitacion" : ""
                }
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire"
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {TIPOS_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-bold uppercase tracking-widest text-ink-muted">
                  Inicio
                </label>
                <input
                  type="datetime-local"
                  name="inicio"
                  defaultValue={
                    hojaModo === "editar"
                      ? aInputLocal(hojaEvento?.inicio ?? "")
                      : ""
                  }
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire"
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold uppercase tracking-widest text-ink-muted">
                  Fin
                </label>
                <input
                  type="datetime-local"
                  name="fin"
                  defaultValue={
                    hojaModo === "editar"
                      ? aInputLocal(hojaEvento?.fin ?? "")
                      : ""
                  }
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-bold uppercase tracking-widest text-ink-muted">
                Lugar
              </label>
              <input
                name="lugar"
                defaultValue={hojaModo === "editar" ? hojaEvento?.lugar ?? "" : ""}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire"
              />
            </div>
            <div>
              <label className="block text-[13px] font-bold uppercase tracking-widest text-ink-muted">
                Descripción
              </label>
              <textarea
                name="descripcion"
                rows={3}
                defaultValue={
                  hojaModo === "editar"
                    ? hojaEvento?.descripcion ?? ""
                    : ""
                }
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarHoja}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-[14px] text-ink hover:bg-surface-hover"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brass bg-brass px-4 py-2 text-[14px] font-semibold text-bg disabled:opacity-60 hover:bg-brass/90"
              >
                {guardando ? "Guardando…" : "Guardar evento"}
              </button>
            </div>
          </form>
        )}
      </Hoja>
    </div>
  );
}
