"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CUARTEL } from "@/lib/cuartel.config";
import { CalendarDays, ChevronRight, CircleHelp, Printer } from "lucide-react";
import { Badge, isCargo } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Grupo } from "@/components/ui/grupo";
import { Hoja } from "@/components/ui/hoja";
import { EncabezadoIsla } from "@/components/encabezado-isla";
import { Segmentado } from "@/components/ui/segmentado";
import type { SessionBombero } from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import {
  celdaKey,
  FRANJAS,
  fechasAConsultar,
  franjaActual,
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

function rangoFranja(franja: Franja): string {
  const [desde, hasta] = franja.split("-");
  return `${desde} a ${hasta}`;
}

function rangoFranjaCabecera(franja: Franja): string {
  const [desde, hasta] = franja.split("-");
  return `${desde} - ${hasta}`;
}

function BarrasCupo({
  ocupados,
  cupoMaximo,
}: {
  ocupados: number;
  cupoMaximo: number;
}) {
  return (
    <div
      role="img"
      aria-label={`${ocupados} de ${cupoMaximo} lugares cubiertos`}
      className="flex items-center gap-1"
    >
      {Array.from({ length: cupoMaximo }).map((_, i) => (
        <span
          key={i}
          className={`h-1 w-3.5 rounded-[2px] ${i < ocupados ? "bg-yellow" : "bg-separator"}`}
        />
      ))}
    </div>
  );
}

function ChipTurno() {
  return (
    <span className="inline-flex items-center rounded-full bg-yellow px-2.5 py-0.5 text-[13px] font-medium text-yellow-ink">
      Tu turno
    </span>
  );
}

type PersonaProps = {
  bombero: RosterBombero;
  compacta?: boolean;
  showLegajo?: boolean;
};

function Persona({ bombero, compacta = false, showLegajo = false }: PersonaProps) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${compacta ? "py-1" : "py-2"}`}>
      <span
        className={`min-w-0 flex-1 truncate text-label ${
          compacta ? "text-[15px] font-medium" : "text-[17px] font-semibold"
        }`}
      >
        {bombero.nombre_completo}
      </span>
      {isCargo(bombero.cargo) ? (
        <Badge
          cargo={bombero.cargo}
          className={compacta ? "px-2 py-0.5 text-[12px]" : ""}
        />
      ) : null}
      {showLegajo ? (
        <span className="num shrink-0 text-[13px] text-label-2">
          {legajoLabel(bombero.numero_ingreso)}
        </span>
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

  const fechaHoja =
    dialogo?.tipo === "anotar" ? dialogo.fechaKey : dialogo?.turno.fecha;
  const franjaHoja =
    dialogo?.tipo === "anotar" ? dialogo.franja : dialogo?.turno.franja;
  const anotadosHoja =
    fechaHoja && franjaHoja ? turnosDeCelda(fechaHoja, franjaHoja) : [];

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

    const base =
      "flex h-full min-h-[132px] flex-col gap-2 rounded-[16px] border bg-surface p-3 transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)]";

    if (filtro === "mios" && !miTurno && !diaPasado) {
      return (
        <div
          key={franja}
          className={`${base} border-transparent bg-surface-2 text-label-2`}
        >
          <div className="flex items-center justify-between gap-2">
            <BarrasCupo ocupados={ocupados} cupoMaximo={cupoMaximo} />
            <span className="num text-[13px] text-label-2">{ocupados}/{cupoMaximo}</span>
          </div>
          <p className="mt-auto text-[13px] text-label-2">Sin tu legajo</p>
        </div>
      );
    }

    if (filtro === "incompletos" && (completo || diaPasado)) {
      return (
        <div
          key={franja}
          className={`${base} border-transparent bg-surface-2 text-label-2`}
        >
          <div className="flex items-center justify-between gap-2">
            <BarrasCupo ocupados={ocupados} cupoMaximo={cupoMaximo} />
            <span className="num text-[13px] text-label-2">{ocupados}/{cupoMaximo}</span>
          </div>
          <p className="mt-auto text-[13px] text-label-2">
            {completo ? "Completo" : "Pasado"}
          </p>
        </div>
      );
    }

    if (diaPasado) {
      return (
        <div
          key={franja}
          className={`${base} border-transparent bg-surface-2 text-label-2`}
        >
          <div className="flex items-center justify-between gap-2">
            <BarrasCupo ocupados={ocupados} cupoMaximo={cupoMaximo} />
            <span className="num text-[13px] text-label-2">{ocupados}/{cupoMaximo}</span>
          </div>
          <p className="text-[15px] text-label-2">
            {ocupados === 0 ? "Sin asignar" : `${ocupados}/${cupoMaximo} cubiertos`}
          </p>
          {ocupados === 0 ? null : (
            <div className="mt-1 flex flex-col">
              {celda.map((turno) => {
                const bombero = roster[turno.bombero_id];
                return bombero ? (
                  <p
                    key={turno.id}
                    className="truncate text-[13px] text-label-2"
                  >
                    {bombero.nombre_completo}
                  </p>
                ) : null;
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={franja}
        className={`${base} ${
          esActual ? "border-yellow" : "border-transparent"
        } ${miTurno ? "bg-yellow-tint" : "bg-surface"}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarrasCupo ocupados={ocupados} cupoMaximo={cupoMaximo} />
            <span className="num text-[13px] text-label-2">{ocupados}/{cupoMaximo}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {miTurno ? <ChipTurno /> : null}
            {esActual ? (
              <span className="rounded-full bg-red-tint px-2 py-0.5 text-[13px] font-medium text-red">
                En curso
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          {celda.map((turno) => {
            const bombero = roster[turno.bombero_id];
            return bombero ? (
              <Persona key={turno.id} bombero={bombero} compacta />
            ) : null;
          })}
        </div>

        {!miTurno ? (
          completo ? (
            <p className="mt-auto text-center text-[13px] text-label-2">Completo</p>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="mt-auto w-full border-red-tint text-red hover:bg-red hover:text-surface active:bg-red-pressed"
              onClick={() => abrirAnotar(dia.key, franja)}
            >
              Anotarme
            </Button>
          )
        ) : (
          <div className="mt-auto flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-11 flex-1 text-red"
              onClick={() => {
                if (miTurno) abrirCancelar(miTurno);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-11 flex-1 border-red-tint text-red"
              onClick={() => {
                if (miTurno) abrirCambiar(miTurno);
              }}
            >
              Mover
            </Button>
          </div>
        )}
      </div>
    );
  }

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
        <div key={franja} className="fila flex items-center gap-3 px-4 py-2 text-label-2">
          <span className="min-w-0 flex-1">
            <span className="num block text-[17px] font-semibold text-label-2">
              {rangoFranja(franja)}
            </span>
            <span className="mt-1.5 block">
              <BarrasCupo ocupados={ocupados} cupoMaximo={cupoMaximo} />
            </span>
          </span>
          <span className="num shrink-0 text-[15px] text-label-2">
            {ocupados === 0 ? "Sin asignar" : `${ocupados}/${cupoMaximo} cubiertos`}
          </span>
        </div>
      );
    }

    return (
      <button
        key={franja}
        type="button"
        onClick={() => {
          if (miTurno) abrirCancelar(miTurno);
          else abrirAnotar(dia.key, franja);
        }}
        className={`fila tap flex w-full items-center gap-3 px-4 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red ${
          miTurno ? "bg-yellow-tint" : ""
        }`}
      >
        <span className="min-w-0 flex-1">
          <span
            className={`num block text-[17px] font-semibold ${
              esActual ? "text-red" : "text-label"
            }`}
          >
            {rangoFranja(franja)}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <BarrasCupo ocupados={ocupados} cupoMaximo={cupoMaximo} />
            {miTurno ? <ChipTurno /> : null}
            {esActual ? (
              <span className="rounded-full bg-red-tint px-2 py-0.5 text-[13px] font-medium text-red">
                En curso
              </span>
            ) : null}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`block text-[15px] ${completo ? "text-label" : "text-label-2"}`}>
            {completo ? "Completo" : `Quedan ${cupoMaximo - ocupados}`}
          </span>
        </span>
        <ChevronRight size={22} strokeWidth={1.75} className="shrink-0 text-label-3" aria-hidden />
      </button>
    );
  }

  function renderDiasMoviles() {
    return (
      <div className="mt-6 space-y-6 md:hidden">
        {diasVisibles.map((dia) => {
          const filas = FRANJAS.map((franja) => renderFilaMovil(dia, franja)).filter(
            Boolean
          );
          if (filas.length === 0) return null;
          const sufijo =
            dia.key === hoyKey
              ? " - HOY"
              : dia.key < hoyKey
              ? " - PASADO"
              : "";
          return (
            <Grupo key={dia.key} titulo={`${dia.label}${sufijo}`}>
              {filas}
            </Grupo>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <EncabezadoIsla
        titulo="Guardias"
        icono={CalendarDays}
        estado={{
          tono: actual && personasActuales.length > 0 ? "turno" : "neutro",
          texto:
            actual && personasActuales.length > 0
              ? `En servicio ahora, ${rangoFranja(actual.franja)}`
              : "Sin personal anotado",
        }}
        acciones={[
          { icono: CircleHelp, etiqueta: "Ayuda sobre guardias", onClick: () => setAyudaAbierta(true) },
          {
            icono: Printer,
            etiqueta: "Imprimir planilla A4",
            onClick: () => setMenuImpresion(true),
            principal: true,
          },
        ]}
      />

      <div className="no-print mx-auto w-full max-w-[1100px] px-4 pb-8 pt-4">
        <section className="grupo flex items-center gap-3 px-4 py-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-yellow" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold text-label">En servicio ahora</p>
            <p className="num text-[13px] text-label-2">
              {actual ? rangoFranja(actual.franja) : "—"}
            </p>
          </div>
          {personasActuales.length === 0 ? (
            <Chip tono="rojo">Sin personal</Chip>
          ) : (
            <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
              {personasActuales.map(({ turno, bombero }) => (
                <span
                  key={turno.id}
                  className="max-w-[180px] truncate rounded-full bg-surface-2 px-3 py-1 text-[13px] text-label-2"
                >
                  {bombero.nombre_completo}
                </span>
              ))}
            </div>
          )}
        </section>

        <div className="mt-5 space-y-3">
          <Segmentado
            etiqueta="Período"
            opciones={[
              { valor: "semana1", etiqueta: "Esta semana" },
              { valor: "semana2", etiqueta: "Semana siguiente" },
              { valor: "todo", etiqueta: "14 días" },
            ]}
            valor={semanaVista}
            onChange={(valor) =>
              setSemanaVista(valor as "semana1" | "semana2" | "todo")
            }
          />

          <div className="flex flex-wrap items-center gap-2">
            {(["todos", "mios", "incompletos"] as const).map((valor) => {
              const etiqueta =
                valor === "todos"
                  ? "Todos"
                  : valor === "mios"
                  ? `Mis guardias (${totalMisTurnos})`
                  : "Con lugar libre";
              const activo = filtro === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={activo}
                  onClick={() => setFiltro(valor)}
                  className={`tap min-h-11 rounded-full px-4 text-[15px] font-medium transition-colors ${
                    activo
                      ? "bg-label text-surface"
                      : "bg-surface-2 text-label-2 hover:bg-red-tint hover:text-red"
                  }`}
                >
                  {etiqueta}
                </button>
              );
            })}
          </div>
        </div>

        {renderDiasMoviles()}

        <div className="mt-6 hidden overflow-x-auto md:block">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[140px_repeat(4,minmax(0,1fr))] gap-2 px-1">
              <div />
              {FRANJAS.map((franja) => (
                <p
                  key={franja}
                  className="num text-center text-[15px] font-semibold text-label-2"
                >
                  {rangoFranjaCabecera(franja)}
                </p>
              ))}
            </div>

            <div className="mt-2">
              {diasVisibles.map((dia) => {
                const esHoy = dia.key === hoyKey;
                const diaPasado = dia.key < hoyKey;
                return (
                  <div
                    key={dia.key}
                    className={`grid grid-cols-[140px_repeat(4,minmax(0,1fr))] items-stretch gap-2 border-b border-separator py-2 ${
                      esHoy ? "bg-yellow-tint/40" : ""
                    }`}
                  >
                    <div className="flex flex-col justify-center px-1">
                      <p className="num text-[17px] font-semibold text-label">
                        {labelDiaCorto(dia.key)}
                      </p>
                      {esHoy ? (
                        <p className="mt-0.5 text-[13px] text-label-2">Hoy</p>
                      ) : diaPasado ? (
                        <p className="mt-0.5 text-[13px] text-label-2">Pasado</p>
                      ) : null}
                    </div>
                    {FRANJAS.map((franja) => renderCeldaGrilla(dia, franja))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Hoja
        open={ayudaAbierta}
        onClose={() => setAyudaAbierta(false)}
        title="Ayuda de guardias"
        footer={
          <Button className="w-full" onClick={() => setAyudaAbierta(false)}>
            Entendido
          </Button>
        }
      >
        <div className="space-y-2 text-[15px] text-label-2">
          <p>Cada guardia admite hasta {cupoMaximo} bomberos.</p>
          <p>Tocá una franja para ver el detalle y anotarte.</p>
          <p>Si ya estás anotado, podés cancelarla o moverla.</p>
        </div>
      </Hoja>

      <Hoja
        open={dialogo !== null}
        onClose={cerrarDialogo}
        title={
          fechaHoja && franjaHoja
            ? `${labelDia(fechaHoja)} · ${rangoFranja(franjaHoja)}`
            : "Guardia"
        }
        footer={
          dialogo ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {dialogo.tipo === "cancelar" ? (
                <Button
                  variant="secondary"
                  onClick={() => abrirCambiar(dialogo.turno)}
                  disabled={pendiente}
                >
                  Mover
                </Button>
              ) : null}
              {dialogo.tipo === "anotar" ? (
                <Button onClick={ejecutarAccion} disabled={pendiente}>
                  {pendiente ? "Procesando…" : "Anotarme"}
                </Button>
              ) : dialogo.tipo === "cancelar" ? (
                <Button variant="danger" onClick={ejecutarAccion} disabled={pendiente}>
                  {pendiente ? "Procesando…" : "Cancelar guardia"}
                </Button>
              ) : (
                <Button
                  onClick={ejecutarAccion}
                  disabled={pendiente || !objetivo}
                >
                  {pendiente ? "Procesando…" : "Mover"}
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {dialogo ? (
          <div className="space-y-4">
            <div>
              <p className="text-[13px] text-label-2">
                {anotadosHoja.length} de {cupoMaximo} cubiertos
              </p>
              {anotadosHoja.length > 0 ? (
                <div className="grupo mt-2 divide-y divide-separator">
                  {anotadosHoja.map((turno) => {
                    const bombero = roster[turno.bombero_id];
                    return bombero ? (
                      <Persona key={turno.id} bombero={bombero} showLegajo />
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="mt-2 text-[15px] text-label-2">
                  Todavía no hay personal anotado.
                </p>
              )}
            </div>

            {dialogo.tipo === "anotar" ? (
              <p className="text-[15px] text-label-2">
                {session.nombre_completo} · Legajo {session.numero_ingreso}
              </p>
            ) : null}

            {dialogo.tipo === "cancelar" ? (
              <div>
                <label
                  htmlFor="nota-cancelar"
                  className="block text-[13px] text-label-2"
                >
                  Motivo (opcional)
                </label>
                <textarea
                  id="nota-cancelar"
                  value={nota}
                  onChange={(event) => setNota(event.target.value)}
                  placeholder="Escribí un motivo breve"
                  rows={2}
                  maxLength={200}
                  className="mt-1.5 min-h-11 w-full resize-none rounded-[14px] border border-separator bg-surface px-4 py-3 text-[17px] text-label placeholder:text-label-2"
                />
                <p className="num mt-1 text-right text-[13px] text-label-2">
                  {nota.length}/200
                </p>
              </div>
            ) : null}

            {dialogo.tipo === "cambiar" ? (
              <div>
                <p className="text-[13px] text-label-2">Nuevo turno</p>
                {opcionesCambio.length > 0 ? (
                  <div className="mt-2 flex max-h-56 flex-col gap-2 overflow-y-auto">
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
                          className={`tap rounded-[14px] p-3 text-left text-[15px] transition-colors ${
                            seleccionada
                              ? "bg-yellow-tint text-yellow-ink"
                              : "bg-surface-2 text-label"
                          }`}
                        >
                          {opcion.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-2 text-[15px] text-label-2">
                    No hay otros turnos con lugar libre.
                  </p>
                )}
              </div>
            ) : null}

            {error ? <ErrorAviso mensaje={error} /> : null}
          </div>
        ) : null}
      </Hoja>

      <Hoja
        open={menuImpresion}
        onClose={() => setMenuImpresion(false)}
        title="Imprimir planilla A4"
      >
        <div className="space-y-2">
          {[
            { valor: "semana1" as const, titulo: "Esta semana", fechas: dias.slice(0, 7) },
            { valor: "semana2" as const, titulo: "Semana siguiente", fechas: dias.slice(7, 14) },
            { valor: "todo" as const, titulo: "14 días", fechas: dias },
          ].map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => elegirImpresion(opcion.valor)}
              className="tap w-full rounded-[14px] bg-surface-2 p-3 text-left transition-colors hover:bg-red-tint"
            >
              <span className="block text-[17px] font-semibold text-label">
                {opcion.titulo}
              </span>
              <span className="num mt-0.5 block text-[13px] text-label-2">
                {rangoDeDias(opcion.fechas)}
              </span>
            </button>
          ))}
        </div>
      </Hoja>

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
      className="rounded-[14px] border-l border-red bg-red-tint px-4 py-3 text-[15px] font-medium text-red"
    >
      {mensaje}
    </p>
  );
}
