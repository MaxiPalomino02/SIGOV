"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CUARTEL } from "@/lib/cuartel.config";
import {
  ArrowLeftRight,
  Check,
  CircleHelp,
  Clock,
  Printer,
  Calendar,
  AlertTriangle,
  UserCheck,
  Filter,
} from "lucide-react";
import { Badge, isCargo } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Hoja } from "@/components/ui/hoja";
import { Modal } from "@/components/ui/modal";
import type { SessionBombero } from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import {
  celdaKey,
  FRANJAS,
  fechasAConsultar,
  franjaActual,
  franjaCorta,
  franjaHora,
  normalizeTurnos,
  type Franja,
  type TurnoCelda,
} from "@/lib/tablero";
import { anotarTurno, cambiarTurno, cancelarTurno } from "../actions";

type RosterBombero = {
  numero_ingreso: number;
  nombre_completo: string;
  cargo: string;
};

type DiaTablero = {
  key: string;
  label: string;
};

type TableroProps = {
  session: SessionBombero;
  bomberos: Record<string, RosterBombero>;
  turnos: TurnoCelda[];
  dias: DiaTablero[];
  hoyKey: string;
  cupoMaximo: number;
  nombreCuartel: string;
};

type Dialogo =
  | { tipo: "anotar"; fechaKey: string; franja: Franja }
  | { tipo: "cancelar"; turno: TurnoCelda }
  | { tipo: "cambiar"; turno: TurnoCelda }
  | null;

function legajoLabel(numero: number) {
  return `Legajo N° ${String(numero).padStart(3, "0")}`;
}

// ── Indicador de Capacidad Táctico (Segmentos) ──────────────────────────────
function CapacidadSegmentos({
  ocupados,
  cupoMaximo,
}: {
  ocupados: number;
  cupoMaximo: number;
}) {
  const completo = ocupados >= cupoMaximo;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1" aria-hidden>
        {Array.from({ length: cupoMaximo }).map((_, i) => {
          const lleno = i < ocupados;
          return (
            <span
              key={i}
              className={`h-1.5 w-3.5 rounded-full transition-all duration-200 ${
                lleno
                  ? completo
                    ? "bg-ok shadow-[0_0_6px_rgba(47,125,79,0.35)]"
                    : "bg-alarm shadow-[0_0_6px_rgba(194,105,11,0.30)]"
                  : "bg-segmento-vacio"
              }`}
            />
          );
        })}
      </div>
      <span className="font-mono text-[13px] font-normal text-ink-muted tabular-nums">
        {ocupados}/{cupoMaximo}
      </span>
    </div>
  );
}

// ── Tarjeta de Bombero Anotado en la Celda ───────────────────────────────────
type PersonaAnotadaProps = {
  bombero: RosterBombero;
  turno: TurnoCelda;
  esMio: boolean;
  onCancelar: (turno: TurnoCelda) => void;
  onCambiar: (turno: TurnoCelda) => void;
  showLegajo?: boolean;
};

function PersonaAnotada({
  bombero,
  turno,
  esMio,
  onCancelar,
  onCambiar,
  showLegajo = false,
}: PersonaAnotadaProps) {
  return (
    <div
      className={`relative rounded-xl border bg-surface p-2.5 shadow-[0_1px_3px_rgba(20,26,24,0.06)] transition-all duration-200 ${
        esMio
          ? "border-2 border-brass shadow-[0_2px_8px_rgba(150,112,46,0.12)] ring-1 ring-brass/20"
          : "border-line hover:border-line"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex items-center gap-1.5">
          {esMio ? (
            <span className="flex h-2 w-2 rounded-full bg-brass animate-pulse" aria-hidden />
          ) : null}
          <p
            className={`text-[15px] font-medium leading-tight ${
              esMio ? "text-brass-texto" : "text-ink"
            }`}
          >
            {bombero.nombre_completo}
          </p>
        </div>
        {isCargo(bombero.cargo) ? <Badge cargo={bombero.cargo} /> : null}
      </div>

      <div className="mt-1 flex items-center justify-between">
        {showLegajo ? (
          <p className="font-mono text-[13px] text-ink-secondary">
            {legajoLabel(bombero.numero_ingreso)}
          </p>
        ) : <div />}

        {esMio ? (
          <span className="rounded bg-brass-light px-1.5 py-0.5 font-mono text-[13px] font-normal uppercase tracking-wider text-brass-texto">
            Tu Turno
          </span>
        ) : null}
      </div>

      {esMio ? (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-brass/20 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancelar(turno)}
            className="h-11 px-3 text-[15px] font-normal text-ink-muted hover:text-fire-text hover:bg-fire-light"
          >
            Cancelar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onCambiar(turno)}
            className="h-11 px-3 text-[15px] font-medium text-brass-texto hover:border-brass/40 hover:bg-brass-light"
          >
            <ArrowLeftRight className="h-4 w-4 mr-1" aria-hidden />
            Mover
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ── Tablero Principal ─────────────────────────────────────────────────────────
export function Tablero({
  session,
  bomberos: bomberosIniciales,
  turnos: turnosIniciales,
  dias,
  hoyKey,
  cupoMaximo,
  nombreCuartel,
}: TableroProps) {
  const [turnos, setTurnos] = useState(turnosIniciales);
  const [roster, setRoster] = useState(bomberosIniciales);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [objetivo, setObjetivo] = useState<{
    fechaKey: string;
    franja: Franja;
  } | null>(null);
  const [actual, setActual] = useState<ReturnType<typeof franjaActual> | null>(
    null
  );
  const [menuImpresion, setMenuImpresion] = useState(false);
  const [imprimirRango, setImprimirRango] = useState<
    "semana1" | "semana2" | "todo" | null
  >(null);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);

  // Filtros operativos
  const [filtro, setFiltro] = useState<"todos" | "mios" | "incompletos">("todos");
  const [semanaVista, setSemanaVista] = useState<"semana1" | "semana2" | "todo">("semana1");

  const clientRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(
    null
  );
  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = createBrowserSupabaseClient();
    return clientRef.current;
  }, []);

  const refrescar = useCallback(async () => {
    try {
      const { data } = await getClient()
        .from("turnos")
        .select("id, fecha, franja, bombero_id")
        .in("fecha", fechasAConsultar(dias.map((dia) => dia.key)));
      if (data) setTurnos(normalizeTurnos(data));
    } catch (err) {
      console.error("No se pudo refrescar el tablero:", err);
    }
  }, [dias, getClient]);

  const refrescarBomberos = useCallback(async () => {
    try {
      const { data } = await getClient()
        .from("bomberos")
        .select("id, numero_ingreso, nombre_completo, cargo")
        .eq("activo", true);
      const mapa: Record<string, RosterBombero> = {};
      for (const b of data ?? []) {
        const r = b as Record<string, unknown>;
        if (
          typeof r.id === "string" &&
          typeof r.numero_ingreso === "number" &&
          typeof r.nombre_completo === "string" &&
          typeof r.cargo === "string"
        ) {
          mapa[r.id] = {
            numero_ingreso: r.numero_ingreso,
            nombre_completo: r.nombre_completo,
            cargo: r.cargo,
          };
        }
      }
      setRoster(mapa);
    } catch (err) {
      console.error("No se pudo refrescar el padrón:", err);
    }
  }, [getClient]);

  useEffect(() => {
    const update = () =>
      setActual((prev) => {
        const next = franjaActual(new Date());
        if (
          prev &&
          prev.fechaKey === next.fechaKey &&
          prev.franja === next.franja
        ) {
          return prev;
        }
        return next;
      });
    const intervalId = window.setInterval(update, 20_000);
    const timeoutId = window.setTimeout(update, 0);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let channel: ReturnType<
      ReturnType<typeof createBrowserSupabaseClient>["channel"]
    > | null = null;
    try {
      channel = getClient()
        .channel("tablero-turnos")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "turnos" },
          () => { void refrescar(); }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bomberos" },
          () => { void refrescarBomberos(); }
        )
        .subscribe();
    } catch (err) {
      console.error("No se pudo conectar a Realtime:", err);
    }
    return () => {
      if (channel) getClient().removeChannel(channel);
    };
  }, [getClient, refrescar, refrescarBomberos]);

  useEffect(() => {
    if (!imprimirRango) return;
    const id = window.setTimeout(() => window.print(), 50);
    const cerrar = () => setImprimirRango(null);
    window.addEventListener("afterprint", cerrar);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("afterprint", cerrar);
    };
  }, [imprimirRango]);

  const porCelda = useMemo(() => {
    const mapa = new Map<string, TurnoCelda[]>();
    for (const turno of turnos) {
      const key = celdaKey(turno.fecha, turno.franja);
      const lista = mapa.get(key);
      if (lista) lista.push(turno);
      else mapa.set(key, [turno]);
    }
    return mapa;
  }, [turnos]);

  const turnosDeCelda = useCallback(
    (fechaKey: string, franja: Franja): TurnoCelda[] => {
      return porCelda.get(celdaKey(fechaKey, franja)) ?? [];
    },
    [porCelda]
  );

  // Días visibles según el selector de semana
  const diasVisibles = useMemo(() => {
    if (semanaVista === "todo") return dias;
    if (semanaVista === "semana2") return dias.slice(7, 14);
    return dias.slice(0, 7);
  }, [dias, semanaVista]);

  const diasImpresion = useMemo(() => {
    if (imprimirRango === "todo") return dias;
    if (imprimirRango === "semana2") return dias.slice(7);
    return dias.slice(0, 7);
  }, [dias, imprimirRango]);

  const personasActuales = useMemo(() => {
    if (!actual) return [];
    return turnosDeCelda(actual.fechaKey, actual.franja)
      .map((turno) => ({ turno, bombero: roster[turno.bombero_id] }))
      .filter(
        (x): x is { turno: TurnoCelda; bombero: RosterBombero } =>
          x.bombero != null
      );
  }, [actual, roster, turnosDeCelda]);

  // Mis turnos totales en la ventana
  const totalMisTurnos = useMemo(() => {
    return turnos.filter((t) => t.bombero_id === session.bombero_id).length;
  }, [turnos, session.bombero_id]);

  const opcionesCambio = useMemo(() => {
    if (!dialogo || dialogo.tipo !== "cambiar") return [];
    return dias
      .flatMap((dia) =>
        FRANJAS.map((franja) => ({
          fechaKey: dia.key,
          franja,
          label: `${dia.label} · ${franjaHora(franja)}`,
        }))
      )
      .filter((opcion) => {
        const esElMismo =
          opcion.fechaKey === dialogo.turno.fecha &&
          opcion.franja === dialogo.turno.franja;
        if (opcion.fechaKey < hoyKey || esElMismo) return false;
        const anotados = turnosDeCelda(opcion.fechaKey, opcion.franja);
        const yaAnotado = anotados.some(
          (turno) => turno.bombero_id === session.bombero_id
        );
        return !yaAnotado && anotados.length < cupoMaximo;
      });
  }, [dialogo, dias, hoyKey, session.bombero_id, turnosDeCelda, cupoMaximo]);

  function labelDia(fechaKey: string): string {
    return dias.find((dia) => dia.key === fechaKey)?.label ?? fechaKey;
  }

  function abrirAnotar(fechaKey: string, franja: Franja) {
    setError(null);
    setDialogo({ tipo: "anotar", fechaKey, franja });
  }

  function abrirCancelar(turno: TurnoCelda) {
    setError(null);
    setNota("");
    setDialogo({ tipo: "cancelar", turno });
  }

  function abrirCambiar(turno: TurnoCelda) {
    setError(null);
    setObjetivo(null);
    setDialogo({ tipo: "cambiar", turno });
  }

  function elegirImpresion(rango: "semana1" | "semana2" | "todo") {
    setMenuImpresion(false);
    setImprimirRango(rango);
  }

  function cerrarDialogo() {
    if (pendiente) return;
    setDialogo(null);
    setError(null);
    setObjetivo(null);
    setNota("");
  }

  async function ejecutarAccion() {
    if (!dialogo) return;
    setPendiente(true);
    setError(null);

    let resultado: { ok: boolean; error?: string } | null = null;
    if (dialogo.tipo === "anotar") {
      resultado = await anotarTurno(dialogo.fechaKey, dialogo.franja);
    } else if (dialogo.tipo === "cancelar") {
      resultado = await cancelarTurno(dialogo.turno.id, nota);
    } else if (dialogo.tipo === "cambiar" && objetivo) {
      resultado = await cambiarTurno(
        dialogo.turno.id,
        objetivo.fechaKey,
        objetivo.franja
      );
    }

    setPendiente(false);
    if (resultado?.ok) {
      setDialogo(null);
      setObjetivo(null);
    } else if (resultado) {
      setError(resultado.error ?? "Ocurrió un error. Intentá de nuevo.");
    }
    void refrescar();
  }

  // ── Render Celda Grilla Desktop ───────────────────────────────────────────
  function renderCeldaGrilla(dia: DiaTablero, franja: Franja) {
    const diaPasado = dia.key < hoyKey;
    const celda = turnosDeCelda(dia.key, franja);
    const ocupados = celda.length;
    const completo = ocupados >= cupoMaximo;
    const miTurno = celda.find(
      (turno) => turno.bombero_id === session.bombero_id
    );
    const esActual =
      actual && actual.fechaKey === dia.key && actual.franja === franja;

    // Lógica de Filtros
    if (filtro === "mios" && !miTurno && !diaPasado) {
      return (
        <div
          key={franja}
          className="rounded-xl border border-line bg-celda-pasada p-3"
        >
          <div className="flex h-full flex-col justify-between">
            <CapacidadSegmentos ocupados={ocupados} cupoMaximo={cupoMaximo} />
            <p className="font-mono text-[13px] font-normal text-ink-muted">Sin asignar a tu legajo</p>
          </div>
        </div>
      );
    }

    if (filtro === "incompletos" && (completo || diaPasado)) {
      return (
        <div
          key={franja}
          className="rounded-xl border border-line bg-celda-pasada p-3"
        >
          <div className="flex h-full flex-col justify-between">
            <CapacidadSegmentos ocupados={ocupados} cupoMaximo={cupoMaximo} />
            <p className="font-mono text-[13px] font-normal text-ink-muted">{completo ? "Cupo completo" : "Pasado"}</p>
          </div>
        </div>
      );
    }

    if (diaPasado) {
      return (
        <div
          key={franja}
          className="rounded-xl border border-line bg-celda-pasada p-3"
        >
          <div className="flex h-full flex-col gap-2">
            <CapacidadSegmentos ocupados={ocupados} cupoMaximo={cupoMaximo} />
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[12px] font-normal uppercase tracking-wider text-ink-muted">
                Pasado
              </span>
              {ocupados === 0 ? (
                <span className="font-mono text-[13px] font-normal text-ink-muted">
                  Sin asignar
                </span>
              ) : null}
            </div>
            {ocupados === 0 ? null : (
              <div className="flex flex-col gap-1">
                {celda.map((turno) => {
                  const bombero = roster[turno.bombero_id];
                  return bombero ? (
                    <p key={turno.id} className="text-[15px] font-normal text-ink-muted leading-tight">
                      {bombero.nombre_completo}
                    </p>
                  ) : null;
                })}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        key={franja}
        className={`rounded-2xl bg-surface p-3.5 shadow-[0_1px_3px_rgba(20,26,24,0.06)] transition-all duration-200 ${
          esActual
            ? "border-2 border-servicio-ambar bg-servicio-hoy shadow-[0_2px_10px_rgba(194,105,11,0.12)]"
            : miTurno
            ? "border border-line bg-brass-light"
            : "border border-line hover:shadow-[0_4px_16px_rgba(20,26,24,0.10)]"
        }`}
      >
        <div className="flex h-full flex-col gap-2.5">
          {/* Cabecera de celda: Medidor de cupos */}
          <div className="flex items-center justify-between gap-2">
            <CapacidadSegmentos ocupados={ocupados} cupoMaximo={cupoMaximo} />
            {miTurno ? (
              <span className="flex items-center gap-1 font-mono text-[13px] font-normal uppercase text-brass-texto">
                <Check className="h-4 w-4 text-brass-texto" strokeWidth={2} aria-hidden />
                Anotado
              </span>
            ) : esActual ? (
              <span className="flex items-center gap-1 font-mono text-[13px] font-normal uppercase text-alarm-text animate-pulse">
                En curso
              </span>
            ) : null}
          </div>

          {/* Lista de bomberos en el turno */}
          <div className="flex flex-col gap-1.5 flex-1">
            {celda.map((turno) => {
              const bombero = roster[turno.bombero_id];
              if (!bombero) return null;
              return (
                <PersonaAnotada
                  key={turno.id}
                  bombero={bombero}
                  turno={turno}
                  esMio={turno.bombero_id === session.bombero_id}
                  onCancelar={abrirCancelar}
                  onCambiar={abrirCambiar}
                  showLegajo
                />
              );
            })}
          </div>

          {/* Botón de anotación rápida */}
          {!miTurno ? (
            completo ? (
              <p className="rounded-lg bg-bg-subtle py-1.5 text-center font-mono text-[13px] font-normal uppercase tracking-wider text-ink-muted">
                Cupo completo
              </p>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="btn-anotar mt-auto h-11 w-full font-mono text-[13px] font-semibold uppercase tracking-wider"
                onClick={() => abrirAnotar(dia.key, franja)}
              >
                + ANOTARME
              </Button>
            )
          ) : null}
        </div>
      </div>
    );
  }

  // ── Render Filas Móvil ────────────────────────────────────────────────────
  function renderFilaMovil(dia: DiaTablero, franja: Franja) {
    const diaPasado = dia.key < hoyKey;
    const celda = turnosDeCelda(dia.key, franja);
    const ocupados = celda.length;
    const completo = ocupados >= cupoMaximo;
    const miTurno = celda.find(
      (turno) => turno.bombero_id === session.bombero_id
    );
    const esActual =
      actual && actual.fechaKey === dia.key && actual.franja === franja;

    if (filtro === "mios" && !miTurno && !diaPasado) return null;
    if (filtro === "incompletos" && (completo || diaPasado)) return null;

    if (diaPasado) {
      return (
        <div key={franja} className="border-b border-line bg-celda-pasada px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="heading-display compacta text-ink">{franja}</p>
            <span className="font-mono text-[13px] font-normal text-ink-muted">
              {ocupados}/{cupoMaximo} cubiertos
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        key={franja}
        className={`px-4 py-3.5 transition-colors ${
          esActual ? "bg-servicio-hoy" : miTurno ? "bg-brass-light" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className={`heading-display compacta ${esActual ? "text-alarm-text" : "text-ink"}`}>
              {franja}
            </p>
            {esActual ? (
              <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[12px] font-normal uppercase tracking-wider text-alarm-text ring-1 ring-servicio-borde">
                Ahora
              </span>
            ) : null}
          </div>
          <CapacidadSegmentos ocupados={ocupados} cupoMaximo={cupoMaximo} />
        </div>

        <div className="mt-2.5 flex flex-col gap-2">
          {celda.map((turno) => {
            const bombero = roster[turno.bombero_id];
            if (!bombero) return null;
            return (
              <PersonaAnotada
                key={turno.id}
                bombero={bombero}
                turno={turno}
                esMio={turno.bombero_id === session.bombero_id}
                onCancelar={abrirCancelar}
                onCambiar={abrirCambiar}
              />
            );
          })}
        </div>

        {!miTurno ? (
          completo ? (
            <p className="mt-2.5 text-center font-mono text-[13px] font-normal text-ink-muted">
              Cupo completo
            </p>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="btn-anotar mt-3 h-11 w-full font-mono text-[13px] font-semibold uppercase tracking-wider"
              onClick={() => abrirAnotar(dia.key, franja)}
            >
              + ANOTARME
            </Button>
          )
        ) : null}
      </div>
    );
  }

  function renderDiasMoviles() {
    return (
      <div className="mt-6 space-y-4 md:hidden">
        {diasVisibles.map((dia) => {
          const esHoy = dia.key === hoyKey;
          const diaPasado = dia.key < hoyKey;
          return (
            <section
              key={dia.key}
              className={`overflow-hidden rounded-2xl border ${
                esHoy
                  ? "border-servicio-borde bg-servicio-hoy shadow-[0_2px_10px_rgba(194,105,11,0.08)]"
                  : "border-line bg-surface shadow-[0_1px_3px_rgba(20,26,24,0.04)]"
              }`}
            >
              <header className="flex items-center justify-between gap-2 border-b border-line bg-transparent px-4 py-3">
                <div>
                  <p className="heading-display compacta text-ink">{dia.label}</p>
                  {diaPasado ? (
                    <p className="mt-1 font-mono text-[12px] font-normal uppercase tracking-wider text-ink-muted">Pasado</p>
                  ) : null}
                </div>
                {esHoy ? (
                  <span className="flex items-center gap-1.5 rounded-full border border-servicio-borde bg-surface px-2.5 py-1 font-mono text-[12px] font-normal uppercase tracking-wider text-alarm-text">
                    <span aria-hidden className="h-2 w-2 rounded-full bg-alarm animate-pulse" />
                    Hoy
                  </span>
                ) : null}
              </header>
              <div className="divide-y divide-line">
                {FRANJAS.map((franja) => renderFilaMovil(dia, franja))}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="no-print mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">

        {/* ── 1. Cabecera Principal & Acciones Rápidas ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h1 className="heading-display text-ink">Tablero de guardias</h1>
            <span className="rounded-full border border-line bg-bg-subtle px-2.5 py-0.5 font-mono text-[13px] font-normal text-ink-muted">
              14 Días
            </span>
            <button
              type="button"
              onClick={() => setAyudaAbierta(true)}
              aria-label="Ayuda sobre el tablero de guardias"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-line bg-surface text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <CircleHelp className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setMenuImpresion(true)}
              className="h-11 text-[15px] font-semibold uppercase tracking-wider"
            >
              <Printer className="h-4 w-4 text-ink-secondary" aria-hidden />
              Imprimir planilla A4
            </Button>
          </div>
        </div>

        {/* ── 2. Widget de Despacho en Vivo ("En Servicio Ahora") ── */}
        <section className="mt-6 rounded-2xl border border-servicio-borde bg-servicio-crema p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-servicio-ambar text-surface shadow-[0_2px_8px_rgba(194,105,11,0.18)]">
                <Clock className="h-5 w-5 animate-pulse" fill="currentColor" aria-hidden />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="heading-display compacta text-alarm-text">
                    Operativo en servicio ahora
                  </p>
                  <span className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-[13px] font-normal uppercase text-ink-muted">
                    {actual?.franja}
                  </span>
                </div>
                <p className="font-mono text-[13px] font-normal text-ink-muted">
                  Cuartel {nombreCuartel} · Guardia activa en cuartel
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {personasActuales.length > 0 ? (
                personasActuales.map(({ turno, bombero }) => (
                  <div
                    key={turno.id}
                    className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-1.5 shadow-[0_1px_3px_rgba(20,26,24,0.06)]"
                  >
                    <span className="h-2 w-2 rounded-full bg-ok" aria-hidden />
                    <span className="text-[15px] font-medium text-ink">
                      {bombero.nombre_completo}
                    </span>
                    {isCargo(bombero.cargo) ? <Badge cargo={bombero.cargo} /> : null}
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 rounded-xl border border-aviso-borde bg-aviso-fondo px-3.5 py-1.5 text-fire-text">
                  <AlertTriangle className="h-4 w-4 text-fire-text" aria-hidden />
                  <span className="text-[15px] font-medium">
                    Guardia sin personal asignado actualmente
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── 3. Barra de Filtros Rápidos & Pestañas de Semana ── */}
        <div className="mt-6 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1 font-mono text-[13px] font-normal uppercase tracking-wider text-ink-muted">
              <Filter className="h-4 w-4" aria-hidden /> Filtrar
            </span>
            <button
              type="button"
              onClick={() => setFiltro("todos")}
              className={`h-11 cursor-pointer rounded-xl px-3 text-[15px] font-semibold uppercase tracking-wider transition-all ${
                filtro === "todos"
                  ? "bg-ink text-surface shadow-sm"
                  : "border border-line bg-surface text-ink-secondary hover:bg-bg-subtle"
              }`}
            >
              Todos los turnos
            </button>
            <button
              type="button"
              onClick={() => setFiltro("mios")}
              className={`inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-brass-border px-3 text-[15px] font-medium uppercase tracking-wider transition-all ${
                filtro === "mios"
                  ? "bg-brass-light text-brass-texto"
                  : "bg-surface text-brass-texto hover:bg-brass-light"
              }`}
            >
              <UserCheck className="h-4 w-4" aria-hidden />
              Mis guardias ({totalMisTurnos})
            </button>
            <button
              type="button"
              onClick={() => setFiltro("incompletos")}
              className={`inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-fire-border px-3 text-[15px] font-medium uppercase tracking-wider transition-all ${
                filtro === "incompletos"
                  ? "bg-fire-light text-fire-text"
                  : "bg-surface text-fire-text hover:bg-fire-light"
              }`}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden />
              Con lugar libre
            </button>
          </div>

          <div className="flex items-center gap-1 self-start rounded-xl border border-line bg-surface p-1 shadow-sm sm:self-auto">
            <button
              type="button"
              onClick={() => setSemanaVista("semana1")}
              className={`h-11 cursor-pointer rounded-lg px-3 font-mono text-[13px] font-normal transition-all ${
                semanaVista === "semana1"
                  ? "bg-bg-subtle text-ink shadow-sm"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              Esta semana (7d)
            </button>
            <button
              type="button"
              onClick={() => setSemanaVista("semana2")}
              className={`h-11 cursor-pointer rounded-lg px-3 font-mono text-[13px] font-normal transition-all ${
                semanaVista === "semana2"
                  ? "bg-bg-subtle text-ink shadow-sm"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              Semana siguiente
            </button>
            <button
              type="button"
              onClick={() => setSemanaVista("todo")}
              className={`h-11 cursor-pointer rounded-lg px-3 font-mono text-[13px] font-normal transition-all ${
                semanaVista === "todo"
                  ? "bg-bg-subtle text-ink shadow-sm"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              Todo (14d)
            </button>
          </div>
        </div>

        {/* ── 4. Vista Móvil ── */}
        {renderDiasMoviles()}

        {/* ── 5. Grilla Desktop Operativa ── */}
        <div className="mt-6 hidden overflow-x-auto md:block">
          <div className="min-w-[980px]">
            {/* Cabecera de Franjas */}
            <div className="grid grid-cols-[170px_repeat(4,minmax(0,1fr))] gap-3 px-1">
              <div className="flex items-center font-mono text-[13px] font-normal uppercase tracking-wider text-ink-muted">
                Día / fecha
              </div>
              {FRANJAS.map((franja) => (
                <div
                  key={franja}
                  className="rounded-xl border border-line bg-surface px-3 py-2 text-center shadow-[0_1px_3px_rgba(20,26,24,0.06)]"
                >
                  <p className="heading-display compacta text-ink tabular-nums">
                    {franja}
                  </p>
                </div>
              ))}
            </div>

            {/* Filas de Días */}
            <div className="mt-3 space-y-3">
              {diasVisibles.map((dia) => {
                const esHoy = dia.key === hoyKey;
                const diaPasado = dia.key < hoyKey;
                return (
                  <div
                    key={dia.key}
                    className={`grid grid-cols-[170px_repeat(4,minmax(0,1fr))] items-stretch gap-3 rounded-2xl border border-line p-1.5 transition-all ${
                      esHoy
                        ? "border-servicio-borde bg-servicio-hoy shadow-[0_2px_10px_rgba(194,105,11,0.08)]"
                        : "bg-transparent"
                    }`}
                  >
                    <div className="flex flex-col justify-center rounded-xl border border-line bg-surface px-3.5 py-3 shadow-[0_1px_3px_rgba(20,26,24,0.06)]">
                      <p className="heading-display compacta text-ink">
                        {dia.label}
                      </p>
                      {esHoy ? (
                        <span className="mt-1 inline-flex items-center gap-1 font-mono text-[12px] font-normal uppercase tracking-wider text-alarm-text">
                          <span className="h-1.5 w-1.5 rounded-full bg-alarm animate-pulse" />
                          Hoy
                        </span>
                      ) : diaPasado ? (
                        <p className="mt-1 font-mono text-[12px] font-normal uppercase tracking-wider text-ink-muted">
                          Pasado
                        </p>
                      ) : null}
                    </div>

                    {/* Celdas de las 4 franjas */}
                    {FRANJAS.map((franja) => renderCeldaGrilla(dia, franja))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── 6. Modales / Fichas Tácticas de Guardia ── */}
        <Modal
          open={dialogo?.tipo === "anotar"}
          onClose={cerrarDialogo}
          title="Ficha de Asignación de Guardia"
          confirmLabel="Confirmar y Anotarme"
          cancelLabel="Volver"
          pending={pendiente}
          onConfirm={ejecutarAccion}
        >
          {dialogo?.tipo === "anotar" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-bg-subtle p-4">
                <div className="flex items-center gap-2 text-fire-text font-semibold">
                  <Calendar className="h-4 w-4" aria-hidden />
                  <span className="font-mono text-[13px] font-semibold uppercase tracking-wider">
                    Detalle del turno
                  </span>
                </div>
                <p className="heading-display compacta mt-2 text-ink">
                  {labelDia(dialogo.fechaKey)}
                </p>
                <p className="font-mono text-[13px] font-semibold text-ink-secondary">
                  Horario: {franjaHora(dialogo.franja)} ({dialogo.franja})
                </p>
              </div>

              <div className="rounded-xl border border-line bg-surface p-3.5 text-[15px] text-ink-secondary">
                <p>
                  Bombero: <strong className="text-ink">{session.nombre_completo}</strong> (Legajo {session.numero_ingreso})
                </p>
              </div>
            </div>
          ) : null}
          {error ? <ErrorAviso mensaje={error} /> : null}
        </Modal>

        <Modal
          open={dialogo?.tipo === "cancelar"}
          onClose={cerrarDialogo}
          title="Cancelar Asignación de Guardia"
          confirmLabel="Sí, Cancelar Guardia"
          cancelLabel="Volver"
          pending={pendiente}
          onConfirm={ejecutarAccion}
        >
          {dialogo?.tipo === "cancelar" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-fire-border bg-fire-light p-4 text-fire-text">
                <p className="heading-display compacta">
                  ¿Confirmás la baja de tu turno?
                </p>
                <p className="mt-1 font-mono text-[13px] font-semibold">
                  {labelDia(dialogo.turno.fecha)} · {franjaHora(dialogo.turno.franja)}
                </p>
                <p className="mt-2 text-[15px] font-normal text-ink-secondary">
                  Esta acción liberará el cupo para otro compañero y quedará registrada en el historial.
                </p>
              </div>

              <div>
                <label
                  htmlFor="nota-cancelar"
                  className="block font-mono text-[13px] font-semibold uppercase tracking-wider text-ink-secondary"
                >
                  Motivo de cancelación (opcional)
                </label>
                <textarea
                  id="nota-cancelar"
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  placeholder="Ej.: compromiso laboral o de fuerza mayor"
                  rows={2}
                  maxLength={200}
                  className="mt-1.5 w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-fire focus:outline-none"
                />
                <p className="mt-1 text-right font-mono text-[13px] text-ink-secondary">
                  {nota.length}/200 caracteres
                </p>
              </div>
            </div>
          ) : null}
          {error ? <ErrorAviso mensaje={error} /> : null}
        </Modal>

        <Modal
          open={dialogo?.tipo === "cambiar"}
          onClose={cerrarDialogo}
          title="Mover Guardia a Otro Horario"
          confirmLabel="Confirmar Cambio de Guardia"
          cancelLabel="Volver"
          confirmDisabled={!objetivo}
          pending={pendiente}
          onConfirm={ejecutarAccion}
        >
          {dialogo?.tipo === "cambiar" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-bg-subtle p-3">
                <span className="font-mono text-[13px] font-semibold uppercase tracking-wider text-ink-secondary">
                  Turno actual a mover
                </span>
                <p className="mt-1 text-[15px] font-semibold text-ink">
                  {labelDia(dialogo.turno.fecha)} ({franjaCorta(dialogo.turno.franja)})
                </p>
              </div>

              <div>
                <p className="font-mono text-[13px] font-semibold uppercase tracking-wider text-ink-secondary">
                  Seleccioná el nuevo turno de destino
                </p>
                {opcionesCambio.length > 0 ? (
                  <div className="mt-2.5 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {opcionesCambio.map((opcion) => {
                      const seleccionada =
                        objetivo?.fechaKey === opcion.fechaKey &&
                        objetivo.franja === opcion.franja;
                      return (
                        <button
                          key={`${opcion.fechaKey}|${opcion.franja}`}
                          type="button"
                          onClick={() =>
                            setObjetivo({
                              fechaKey: opcion.fechaKey,
                              franja: opcion.franja,
                            })
                          }
                          aria-pressed={seleccionada}
                          className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-all ${
                            seleccionada
                              ? "border-fire bg-fire-light text-fire-text shadow-sm"
                              : "border-line bg-surface text-ink hover:border-ink-muted/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[15px] font-semibold">{opcion.label}</span>
                            {seleccionada ? (
                              <Check className="h-4 w-4 text-fire" />
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-center text-[15px] text-ink-secondary">
                    No hay otros turnos con cupo disponible en este momento.
                  </p>
                )}
              </div>
            </div>
          ) : null}
          {error ? <ErrorAviso mensaje={error} /> : null}
        </Modal>

        {/* Modal de Impresión */}
        <Modal
          open={menuImpresion}
          onClose={() => setMenuImpresion(false)}
          title="Imprimir Planilla Oficial A4"
        >
          <p className="text-[15px] text-ink-secondary">
            Genera la planilla en formato horizontal A4 blanco y negro para el cuartel.
          </p>
          <div className="mt-4 space-y-2.5">
            <button
              type="button"
              onClick={() => elegirImpresion("semana1")}
              className="w-full cursor-pointer rounded-xl border border-fire-border bg-fire-light p-3.5 text-left text-ink transition-colors hover:border-fire"
            >
              <span className="block text-[15px] font-semibold text-fire-text">Semana actual (7 días)</span>
              <span className="mt-1 block font-mono text-[13px] font-semibold text-ink-secondary">
                {rangoDeDias(dias.slice(0, 7))}
              </span>
            </button>
            <button
              type="button"
              onClick={() => elegirImpresion("semana2")}
              className="w-full cursor-pointer rounded-xl border border-line bg-surface p-3.5 text-left text-ink transition-colors hover:border-ink-muted/40"
            >
              <span className="block text-[15px] font-semibold text-ink">Semana siguiente (7 días)</span>
              <span className="mt-1 block font-mono text-[13px] font-semibold text-ink-secondary">
                {rangoDeDias(dias.slice(7, 14))}
              </span>
            </button>
            <button
              type="button"
              onClick={() => elegirImpresion("todo")}
              className="w-full cursor-pointer rounded-xl border border-line bg-surface p-3.5 text-left text-ink transition-colors hover:border-ink-muted/40"
            >
              <span className="block text-[15px] font-semibold text-ink">Período completo (14 días)</span>
              <span className="mt-1 block font-mono text-[13px] font-semibold text-ink-secondary">
                {rangoDeDias(dias)}
              </span>
            </button>
          </div>
        </Modal>

        <Hoja
          open={ayudaAbierta}
          onClose={() => setAyudaAbierta(false)}
          title="Cómo usar el tablero"
          footer={
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setAyudaAbierta(false)}
            >
              Entendido
            </Button>
          }
        >
          <div className="space-y-3">
            <p>Cada franja admite hasta {cupoMaximo} bomberos.</p>
            <p>Tocá + ANOTARME en una celda con lugar libre para sumarte.</p>
            <p>Si ya estás anotado, podés mover tu guardia o cancelarla desde tu nombre.</p>
          </div>
        </Hoja>
      </div>

      {/* ── Planilla de Impresión Oficial (Solo Print) ── */}
      <PlanillaImpresion
        dias={diasImpresion}
        porCelda={porCelda}
        roster={roster}
        compacta={diasImpresion.length > 7}
        nombreCuartel={nombreCuartel}
      />
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function labelDiaCorto(fechaKey: string): string {
  const [anio, mes, dia] = fechaKey.split("-").map(Number);
  if (!anio || !mes || !dia) return fechaKey;
  const fecha = new Date(anio, mes - 1, dia);
  return `${DIAS_CORTOS[fecha.getDay()]} ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

function formatDDMM(fechaKey: string): string {
  const [, mes, dia] = fechaKey.split("-");
  return `${dia}/${mes}`;
}

function rangoDeDias(dias: DiaTablero[]): string {
  const desde = dias[0]?.key;
  const hasta = dias[dias.length - 1]?.key;
  return desde && hasta ? `Del ${formatDDMM(desde)} al ${formatDDMM(hasta)}` : "";
}

// ── PlanillaImpresion (100% Preservada para A4) ──────────────────────────────
type PlanillaImpresionProps = {
  dias: DiaTablero[];
  porCelda: Map<string, TurnoCelda[]>;
  roster: Record<string, RosterBombero>;
  compacta?: boolean;
  nombreCuartel: string;
};

function PlanillaImpresion({
  dias,
  porCelda,
  roster,
  compacta = false,
  nombreCuartel,
}: PlanillaImpresionProps) {
  const rango = rangoDeDias(dias);

  return (
    <section className="print-only" aria-label="Planilla de guardias para imprimir">
      <div
        className={`planilla-impresion ${compacta ? "planilla-compacta" : "planilla-semana"}`}
      >
        <header className="planilla-encabezado">
          <Image
            src={CUARTEL.escudo}
            alt=""
            width={30}
            height={30}
            priority
            className="planilla-escudo"
          />
          <div>
            <p className="planilla-nombre">{nombreCuartel}</p>
            <p className="planilla-titulo">Planilla de Guardias</p>
            <p className="planilla-rango">{rango}</p>
          </div>
        </header>

        <table className="planilla-tabla">
          <thead>
            <tr>
              <th scope="col">Día</th>
              {FRANJAS.map((franja) => (
                <th scope="col" key={franja}>
                  {franja}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dias.map((dia) => (
              <tr key={dia.key}>
                <th scope="row" className="planilla-dia">
                  {labelDiaCorto(dia.key)}
                </th>
                {FRANJAS.map((franja) => {
                  const anotados =
                    porCelda.get(celdaKey(dia.key, franja)) ?? [];
                  return (
                    <td key={franja}>
                      {anotados.length === 0 ? (
                        <span className="planilla-vacio">—</span>
                      ) : (
                        anotados.map((turno) => {
                          const bombero = roster[turno.bombero_id];
                          return bombero ? (
                            <div key={turno.id} className="planilla-nombre-linea">
                              {bombero.nombre_completo}
                            </div>
                          ) : null;
                        })
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ErrorAviso({ mensaje }: { mensaje: string }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-xl border-l-4 border-fire bg-fire-light px-4 py-3 text-[15px] font-semibold text-ink"
    >
      {mensaje}
    </p>
  );
}
