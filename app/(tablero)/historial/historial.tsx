"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  cargarHistorial,
  formatTimestamp,
  type HistorialEntry,
  type HistorialTurno,
} from "@/lib/historial";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import { formatFechaKey, franjaHora, sumarDias } from "@/lib/tablero";
import { EncabezadoIsla } from "@/components/encabezado-isla";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { Input } from "@/components/ui/input";
import {
  ArrowLeftRight,
  CalendarDays,
  MessageSquare,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";

type Filtro = "todas" | "anoto" | "cancelo" | "cambio";
type Rango = { desde: string; hasta: string };

const FILTROS: readonly { valor: Filtro; etiqueta: string }[] = [
  { valor: "todas", etiqueta: "Todos" },
  { valor: "anoto", etiqueta: "Anotaciones" },
  { valor: "cancelo", etiqueta: "Cancelaciones" },
  { valor: "cambio", etiqueta: "Cambios" },
];

const ICONOS = {
  anoto: { Icono: UserPlus, fondo: "bg-green-tint", color: "text-green-ink" },
  cancelo: { Icono: UserMinus, fondo: "bg-red-tint", color: "text-red" },
  cambio: { Icono: ArrowLeftRight, fondo: "bg-yellow-tint", color: "text-yellow-ink" },
} as const;

function claveFecha(iso: string): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Tucuman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const valor = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

function etiquetaDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return "HOY";
  if (fecha === sumarDias(hoy, -1)) return "AYER";
  const [, mes, dia] = fecha.split("-");
  return `${formatFechaKey(fecha).slice(0, 3).toUpperCase()} ${dia}/${mes}`;
}

function horaMovimiento(iso: string): string {
  return formatTimestamp(iso).split(" ")[1] ?? "";
}

function textoGuardia(turno: HistorialTurno | null, porDefecto: string): string {
  if (!turno) return porDefecto;
  const [, mes, dia] = turno.fecha.split("-");
  const diaCorto = formatFechaKey(turno.fecha).slice(0, 3).toLowerCase();
  return `${franjaHora(turno.franja)} del ${diaCorto} ${dia}/${mes}`;
}

function textoEntrada(entrada: HistorialEntry) {
  let frase: ReactNode;
  if (entrada.accion === "anoto") {
    frase = (
      <>
        <span className="font-semibold">{entrada.bomberoNombre}</span> se anotó{" "}
        <span className="num">{textoGuardia(entrada.nuevo, "en un turno")}</span>
      </>
    );
  } else if (entrada.accion === "cancelo") {
    frase = (
      <>
        <span className="font-semibold">{entrada.bomberoNombre}</span> canceló su guardia{" "}
        <span className="num">{textoGuardia(entrada.nuevo, "sin turno asociado")}</span>
      </>
    );
  } else {
    frase = (
      <>
        <span className="font-semibold">{entrada.bomberoNombre}</span> cambió{" "}
        <span className="num">{textoGuardia(entrada.anterior, "de un turno")}</span> a{" "}
        <span className="num">{textoGuardia(entrada.nuevo, "otro turno")}</span>
      </>
    );
  }

  return (
    <span className="block text-[15px] leading-snug text-label">
      {frase}
      {entrada.nota ? (
        <span className="mt-1 flex items-start gap-1.5 text-[13px] text-label-2">
          <MessageSquare
            size={14}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-label-3"
            aria-hidden
          />
          <span>{entrada.nota}</span>
        </span>
      ) : null}
    </span>
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
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [rango, setRango] = useState<Rango>({ desde: "", hasta: "" });
  const [fechasAbiertas, setFechasAbiertas] = useState(false);
  const [visible, setVisible] = useState(20);

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

  const hoy = useMemo(() => claveFecha(ahora.toISOString()), [ahora]);

  const entradasFiltradas = useMemo(
    () =>
      entradas.filter((entrada) => {
        if (filtro !== "todas" && entrada.accion !== filtro) return false;
        const dia = claveFecha(entrada.timestamp);
        if (rango.desde && dia < rango.desde) return false;
        if (rango.hasta && dia > rango.hasta) return false;
        return true;
      }),
    [entradas, filtro, rango]
  );

  const grupos = useMemo(() => {
    const agrupadas = new Map<string, HistorialEntry[]>();
    for (const entrada of entradasFiltradas.slice(0, visible)) {
      const dia = claveFecha(entrada.timestamp);
      const lista = agrupadas.get(dia) ?? [];
      lista.push(entrada);
      agrupadas.set(dia, lista);
    }
    return Array.from(agrupadas.entries());
  }, [entradasFiltradas, visible]);

  const rangoInvalido = Boolean(desde && hasta && desde > hasta);

  function limpiarFiltros() {
    setFiltro("todas");
    setDesde("");
    setHasta("");
    setRango({ desde: "", hasta: "" });
    setVisible(20);
  }

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <EncabezadoIsla
        titulo="Historial"
        subtitulo="Movimientos de las guardias"
        icono={ArrowLeftRight}
        estado={{
          tono: "neutro",
          texto:
            rango.desde || rango.hasta
              ? `${rango.desde || "…"} – ${rango.hasta || "…"}`
              : "Últimos 7 días",
        }}
        acciones={[
          {
            icono: CalendarDays,
            etiqueta: "Elegir fechas",
            onClick: () => setFechasAbiertas(true),
            principal: true,
          },
        ]}
      />

      <div className="mx-auto w-full max-w-[1100px] px-4 py-5 lg:px-8">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar movimientos">
          {FILTROS.map((opcion) => {
            const activo = filtro === opcion.valor;
            return (
              <button
                key={opcion.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => {
                  setFiltro(opcion.valor);
                  setVisible(20);
                }}
                className={`tap min-h-11 rounded-full px-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
                  activo
                    ? "bg-red text-surface"
                    : "bg-surface-2 text-label-2 hover:bg-red-tint hover:text-red"
                }`}
              >
                {opcion.etiqueta}
              </button>
            );
          })}
        </div>

        {rango.desde || rango.hasta ? (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="tap mt-3 flex min-h-11 items-center gap-2 rounded-full bg-yellow-tint px-4 text-[15px] text-yellow-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
          >
            <span className="num">
              {rango.desde || "…"} – {rango.hasta || "…"}
            </span>
            <X size={18} strokeWidth={1.75} aria-hidden />
            <span className="sr-only">Quitar filtro de fechas</span>
          </button>
        ) : null}

        {grupos.length === 0 ? (
          <EstadoVacio
            icono="History"
            titulo="No hay movimientos"
            texto="Los cambios en las guardias van a aparecer acá."
            className="mt-5"
            accion={
              filtro !== "todas" || rango.desde || rango.hasta
                ? { label: "Limpiar filtros", onClick: limpiarFiltros }
                : undefined
            }
          />
        ) : (
          <div className="mt-5 space-y-5">
            {grupos.map(([dia, entradasDia]) => (
              <Grupo key={dia} titulo={etiquetaDia(dia, hoy)}>
                {entradasDia.map((entrada) => {
                  const { Icono, fondo, color } = ICONOS[entrada.accion];
                  return (
                    <div key={entrada.id} className="fila flex items-start gap-3 px-4 py-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${fondo} ${color}`}
                      >
                        <Icono size={18} strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5">{textoEntrada(entrada)}</span>
                      <span className="num shrink-0 pt-0.5 text-[13px] text-label-2">
                        {horaMovimiento(entrada.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </Grupo>
            ))}

            {visible < entradasFiltradas.length ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setVisible((cantidad) => cantidad + 20)}
              >
                Ver más
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <Hoja
        open={fechasAbiertas}
        onClose={() => setFechasAbiertas(false)}
        title="Elegir fechas"
        footer={
          <div className="flex flex-col-reverse gap-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setFechasAbiertas(false)}
            >
              Cancelar
            </Button>
            <Button
              className="w-full"
              disabled={rangoInvalido}
              onClick={() => {
                setRango({ desde, hasta });
                setVisible(20);
                setFechasAbiertas(false);
              }}
            >
              Aplicar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            type="date"
            label="Desde"
            value={desde}
            onChange={(evento) => setDesde(evento.target.value)}
          />
          <Input
            type="date"
            label="Hasta"
            value={hasta}
            onChange={(evento) => setHasta(evento.target.value)}
          />
          {rangoInvalido ? (
            <p className="text-[13px] text-red">
              La fecha «Desde» no puede ser posterior a «Hasta».
            </p>
          ) : null}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setDesde("");
              setHasta("");
              setRango({ desde: "", hasta: "" });
              setVisible(20);
            }}
          >
            Limpiar fechas
          </Button>
        </div>
      </Hoja>
    </div>
  );
}
