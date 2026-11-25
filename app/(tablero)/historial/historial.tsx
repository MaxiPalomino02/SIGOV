"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cargarHistorial,
  formatTimestamp,
  tiempoRelativo,
  type HistorialEntry,
  type HistorialTurno,
} from "@/lib/historial";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { formatFechaKey, franjaCorta } from "@/lib/tablero";
import { ArrowLeftRight, History, MessageSquare, UserMinus, UserPlus } from "lucide-react";

function TurnoMono({ turno }: { turno: HistorialTurno }) {
  return (
    <span className="dato-mono rounded bg-brass-light px-2 py-0.5 text-[13px] text-brass">
      {formatFechaKey(turno.fecha)} · {franjaCorta(turno.franja)}
    </span>
  );
}

function textoEntrada(entrada: HistorialEntry) {
  if (entrada.accion === "anoto") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[16px]">
        <span className="font-medium text-ink">{entrada.bomberoNombre}</span>
        <span className="text-ink-muted">se anotó en la guardia de</span>
        {entrada.nuevo ? <TurnoMono turno={entrada.nuevo} /> : <span>un turno</span>}
      </div>
    );
  }
  if (entrada.accion === "cancelo") {
    return (
      <div className="flex flex-wrap items-center gap-1.5 text-[16px]">
        <span className="font-medium text-ink">{entrada.bomberoNombre}</span>
        <span className="text-ink-muted">canceló su guardia de</span>
        {entrada.nuevo ? <TurnoMono turno={entrada.nuevo} /> : <span>un turno</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[16px]">
      <span className="font-medium text-ink">{entrada.bomberoNombre}</span>
      <span className="text-ink-muted">cambió del turno</span>
      {entrada.anterior ? <TurnoMono turno={entrada.anterior} /> : <span>su turno</span>}
      <span className="text-ink-muted">al</span>
      {entrada.nuevo ? <TurnoMono turno={entrada.nuevo} /> : <span>otro turno</span>}
    </div>
  );
}

export function Historial({
  entradas: iniciales,
  ahoraServer,
}: {
  entradas: HistorialEntry[];
  ahoraServer: number;
}) {
  const [entradas, setEntradas] = useState(iniciales);
  const [ahora, setAhora] = useState<Date>(() => new Date(ahoraServer));
  const [filtroAccion, setFiltroAccion] = useState<"todas" | "anoto" | "cancelo" | "cambio">("todas");

  const clientRef = useRef<ReturnType<typeof createBrowserSupabaseClient> | null>(null);
  const getClient = useCallback(() => {
    if (!clientRef.current) clientRef.current = createBrowserSupabaseClient();
    return clientRef.current;
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(
      () => setAhora((prev) => new Date(prev.getTime() + 60_000)),
      60_000
    );
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createBrowserSupabaseClient>["channel"]> | null = null;
    try {
      channel = getClient()
        .channel("historial-cambios")
        .on("postgres_changes", { event: "*", schema: "public", table: "historial_cambios" }, () => {
          void cargarHistorial(getClient()).then(setEntradas);
        })
        .subscribe();
    } catch (err) {
      console.error("No se pudo conectar a Realtime:", err);
    }
    return () => {
      if (channel) getClient().removeChannel(channel);
    };
  }, [getClient]);

  const entradasFiltradas = useMemo(() => {
    if (filtroAccion === "todas") return entradas;
    return entradas.filter((e) => e.accion === filtroAccion);
  }, [entradas, filtroAccion]);

  const filtroBtn = (key: typeof filtroAccion, label: string, active: string) =>
    `min-h-11 rounded-[10px] px-3 text-[13px] font-medium transition-colors ${
      filtroAccion === key ? active : "text-ink-muted hover:bg-surface-hover"
    }`;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="titulo-pagina">Historial de movimientos</h1>
          <p className="texto-aux mt-1">Asignaciones, cancelaciones y cambios de guardia.</p>
        </div>

        <div className="flex flex-wrap items-center gap-1 self-start sm:self-auto">
          <button type="button" onClick={() => setFiltroAccion("todas")} className={filtroBtn("todas", "Todos", "bg-ink text-bg")}>
            Todos
          </button>
          <button type="button" onClick={() => setFiltroAccion("anoto")} className={filtroBtn("anoto", "Altas", "bg-ok-light text-ok")}>
            Altas
          </button>
          <button type="button" onClick={() => setFiltroAccion("cancelo")} className={filtroBtn("cancelo", "Bajas", "bg-fire-light text-fire")}>
            Bajas
          </button>
          <button type="button" onClick={() => setFiltroAccion("cambio")} className={filtroBtn("cambio", "Cambios", "bg-alarm-light text-alarm")}>
            Cambios
          </button>
        </div>
      </div>

      {entradasFiltradas.length === 0 ? (
        <div className="mt-6 rounded-[12px] bg-surface p-8 text-center shadow-[0_1px_2px_rgba(20,26,24,0.08)]">
          <History className="mx-auto mb-3 h-8 w-8 text-ink-muted" aria-hidden />
          <p className="text-[16px] font-medium text-ink">No hay movimientos</p>
          <p className="texto-aux mt-1">Los cambios en las guardias van a aparecer acá.</p>
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {entradasFiltradas.map((entrada) => {
            const esAlta = entrada.accion === "anoto";
            const esBaja = entrada.accion === "cancelo";
            return (
              <li key={entrada.id} className="rounded-[12px] bg-surface p-4 shadow-[0_1px_2px_rgba(20,26,24,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        esAlta ? "bg-ok-light text-ok" : esBaja ? "bg-fire-light text-fire" : "bg-alarm-light text-alarm"
                      }`}
                    >
                      {esAlta ? <UserPlus className="h-4 w-4" aria-hidden /> : esBaja ? <UserMinus className="h-4 w-4" aria-hidden /> : <ArrowLeftRight className="h-4 w-4" aria-hidden />}
                    </div>
                    <div>
                      {textoEntrada(entrada)}
                      {entrada.nota ? (
                        <div className="mt-2 flex items-start gap-1.5 text-[13px] text-ink-muted">
                          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>{entrada.nota}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right sm:block">
                    <p className="dato-mono text-[13px] text-ink">{tiempoRelativo(entrada.timestamp, ahora)}</p>
                    <p className="dato-mono text-[13px] text-ink-muted">{formatTimestamp(entrada.timestamp)}</p>
                  </div>
                </div>
                <p className="dato-mono mt-2 text-[13px] text-ink-muted sm:hidden">
                  {tiempoRelativo(entrada.timestamp, ahora)} · {formatTimestamp(entrada.timestamp)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
