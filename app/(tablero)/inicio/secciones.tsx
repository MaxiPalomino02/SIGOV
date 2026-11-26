import Link from "next/link";
import { Bell, BookOpen, CalendarPlus, ClipboardCheck, ClipboardList, Siren, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Fila } from "@/components/ui/fila";
import { Grupo } from "@/components/ui/grupo";
import { Skeleton } from "@/components/ui/skeleton";
import { createSupabaseClient } from "@/lib/supabase";
import {
  celdaKey,
  FRANJAS,
  formatFechaKey,
  franjaHora,
  isFranja,
  sumarDias,
  VENTANA_DIAS,
  type Franja,
} from "@/lib/tablero";

const DIAS_HUECOS = 7;

export function ahoraTucuman(): Date {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Tucuman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? 0);
  return new Date(valor("year"), valor("month") - 1, valor("day"), valor("hour") % 24, valor("minute"), 0, 0);
}

export function formatearFechaTucuman(fecha: Date): string {
  const texto = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

type Carga<T> = { ok: true; data: T } | { ok: false };
type MiTurno = { id: string; fecha: string; franja: Franja };

async function cargarMisTurnos(bomberoId: string, hoy: string): Promise<Carga<MiTurno[]>> {
  const hasta = sumarDias(hoy, VENTANA_DIAS - 1);
  try {
    const { data, error } = await createSupabaseClient()
      .from("turnos")
      .select("id, fecha, franja")
      .eq("bombero_id", bomberoId)
      .gte("fecha", hoy)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true })
      .order("franja", { ascending: true });
    if (error) return { ok: false };
    const turnos: MiTurno[] = [];
    for (const fila of data ?? []) {
      const r = fila as Record<string, unknown>;
      if (
        typeof r.id === "string" &&
        typeof r.fecha === "string" &&
        typeof r.franja === "string" &&
        isFranja(r.franja)
      ) {
        turnos.push({ id: r.id, fecha: r.fecha, franja: r.franja });
      }
    }
    return { ok: true, data: turnos };
  } catch {
    return { ok: false };
  }
}

function etiquetaTurno(fecha: string, franja: Franja, hoy: string): string {
  const prefijo = fecha === hoy ? "Hoy" : formatFechaKey(fecha);
  return `${prefijo}, ${franjaHora(franja)}`;
}

export async function TuTurno({
  bomberoId,
  hoy,
  fechaActual,
  franjaActualAhora,
}: {
  bomberoId: string;
  hoy: string;
  fechaActual: string;
  franjaActualAhora: Franja;
}) {
  const resultado = await cargarMisTurnos(bomberoId, hoy);
  const turnos = resultado.ok ? resultado.data : [];
  const enServicio = turnos.some((t) => t.fecha === fechaActual && t.franja === franjaActualAhora);
  const actual = enServicio
    ? turnos.find((t) => t.fecha === fechaActual && t.franja === franjaActualAhora)
    : turnos[0];
  const siguiente = enServicio
    ? turnos.find((t) => !(t.fecha === fechaActual && t.franja === franjaActualAhora))
    : turnos[1];

  return (
    <Card acento="brass" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-label-2">Tu turno</p>
        {enServicio ? (
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-yellow-ink">
            <span className="h-2 w-2 rounded-full bg-yellow" aria-hidden />
            En servicio ahora
          </span>
        ) : null}
      </div>

      {!resultado.ok ? (
        <p className="mt-4 text-[15px] text-label-2">No pudimos cargar tus turnos.</p>
      ) : actual ? (
        <div className="mt-3">
          <p className="num text-[22px] font-bold leading-tight text-label">
            {etiquetaTurno(actual.fecha, actual.franja, hoy)}
          </p>
          {siguiente ? (
            <p className="mt-2 text-[15px] text-label-2">
              Próximo: {etiquetaTurno(siguiente.fecha, siguiente.franja, hoy)}
            </p>
          ) : (
            <p className="mt-2 text-[15px] text-label-2">No tenés más turnos anotados.</p>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[15px] text-label-2">No tenés turnos anotados</p>
          <Link href="/guardias" className="w-full sm:w-auto">
            <Button size="sm" className="w-full sm:w-auto">
              Anotarme en una guardia
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

export function SkeletonTuTurno() {
  return (
    <Card acento="none" className="p-5">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-4 h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-44" />
    </Card>
  );
}

async function contarGuardiaAhora(fechaKey: string, franja: Franja): Promise<Carga<number>> {
  try {
    const { data, error } = await createSupabaseClient()
      .from("turnos")
      .select("id")
      .eq("fecha", fechaKey)
      .eq("franja", franja)
      .not("bombero_id", "is", null);
    if (error) return { ok: false };
    return { ok: true, data: (data ?? []).length };
  } catch {
    return { ok: false };
  }
}

export async function ResumenInicio({
  bomberoId,
  fechaActual,
  franjaActualAhora,
  avisosNoLeidos,
}: {
  bomberoId: string;
  fechaActual: string;
  franjaActualAhora: Franja;
  avisosNoLeidos: number;
}) {
  const supabase = createSupabaseClient();
  const [tareasRes, guardiaRes] = await Promise.all([
    supabase
      .from("tareas")
      .select("id, asignada_a")
      .eq("estado", "pendiente")
      .limit(200),
    contarGuardiaAhora(fechaActual, franjaActualAhora),
  ]);

  const tareas = tareasRes.data ?? [];
  const miasPendientes = tareas.filter(
    (t: { asignada_a?: unknown }) => t.asignada_a === bomberoId,
  ).length;
  const tareasPendientes = miasPendientes > 0 ? miasPendientes : tareas.length;
  const deGuardia = guardiaRes.ok ? guardiaRes.data : null;

  return (
    <Grupo titulo="Resumen">
      <Link
        href="/tareas"
        className="tap block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red"
      >
        <Fila icono={ClipboardList} titulo="Tareas pendientes" valor={tareasPendientes} chevron />
      </Link>
      <Link
        href="/avisos"
        className="tap block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red"
      >
        <Fila
          icono={Bell}
          titulo="Avisos sin leer"
          valor={
            <span className={avisosNoLeidos > 0 ? "font-semibold text-red" : "text-label-2"}>
              {avisosNoLeidos}
            </span>
          }
          chevron
        />
      </Link>
      <Link
        href="/guardias"
        className="tap block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red"
      >
        <Fila
          icono={Users}
          titulo="De guardia ahora"
          valor={deGuardia === null ? "—" : deGuardia}
          chevron
        />
      </Link>
    </Grupo>
  );
}

export function SkeletonResumenInicio() {
  return (
    <Grupo titulo="Resumen">
      {[0, 1, 2].map((i) => (
        <div key={i} className="fila flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-8" />
        </div>
      ))}
    </Grupo>
  );
}

export function AccesosRapidos({ oficial }: { oficial: boolean }) {
  return (
    <section aria-label="Accesos rápidos" className="space-y-3">
      {oficial ? (
        <Link href="/alarma" className="block">
          <Button className="w-full gap-2">
            <Siren size={22} strokeWidth={1.75} aria-hidden />
            <span>Alarma</span>
          </Button>
        </Link>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/guardias" className="block">
          <Button className="w-full gap-2">
            <CalendarPlus size={22} strokeWidth={1.75} aria-hidden />
            <span>Anotarme</span>
          </Button>
        </Link>
        <Link href="/incidentes" className="block">
          <Button variant="secondary" className="w-full gap-2">
            <Siren size={22} strokeWidth={1.75} aria-hidden />
            <span>Incidente</span>
          </Button>
        </Link>
      </div>
      <Grupo>
        <Link
          href="/chequeo"
          className="tap block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red"
        >
          <Fila icono={ClipboardCheck} titulo="Chequeo" chevron />
        </Link>
        <Link
          href="/biblioteca"
          className="tap block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red"
        >
          <Fila icono={BookOpen} titulo="Biblioteca" chevron />
        </Link>
      </Grupo>
    </section>
  );
}

async function contarHuecos(hoy: string): Promise<Carga<{ sinCubrir: number }>> {
  const hasta = sumarDias(hoy, DIAS_HUECOS - 1);
  try {
    const { data, error } = await createSupabaseClient()
      .from("turnos")
      .select("fecha, franja, bombero_id")
      .gte("fecha", hoy)
      .lte("fecha", hasta)
      .not("bombero_id", "is", null);
    if (error) return { ok: false };
    const ocupadas = new Set<string>();
    for (const fila of data ?? []) {
      const r = fila as Record<string, unknown>;
      if (
        typeof r.fecha === "string" &&
        typeof r.franja === "string" &&
        isFranja(r.franja) &&
        typeof r.bombero_id === "string"
      ) {
        ocupadas.add(celdaKey(r.fecha, r.franja));
      }
    }
    let sinCubrir = 0;
    for (let i = 0; i < DIAS_HUECOS; i += 1) {
      const fecha = sumarDias(hoy, i);
      for (const franja of FRANJAS) {
        if (!ocupadas.has(celdaKey(fecha, franja))) sinCubrir += 1;
      }
    }
    return { ok: true, data: { sinCubrir } };
  } catch {
    return { ok: false };
  }
}

export async function LineaHuecosOficial({ hoy }: { hoy: string }) {
  const resultado = await contarHuecos(hoy);
  if (!resultado.ok || resultado.data.sinCubrir <= 0) return null;
  const n = resultado.data.sinCubrir;
  return (
    <div className="flex min-h-11 items-center gap-3 rounded-[16px] bg-yellow-tint px-4 py-3 text-yellow-ink">
      <span className="min-w-0 flex-1 text-[15px] font-medium">
        Faltan personas en {n} {n === 1 ? "turno" : "turnos"} esta semana
      </span>
      <Link
        href="/guardias"
        className="tap shrink-0 text-[15px] font-semibold text-yellow-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
      >
        Revisar
      </Link>
    </div>
  );
}

export function SkeletonLineaHuecos() {
  return <Skeleton className="h-11 w-full rounded-[14px]" />;
}

export async function ResumenAvisosInicio({ bomberoId }: { bomberoId: string }) {
  const supabase = createSupabaseClient();
  const { data: avisos, error } = await supabase
    .from("avisos")
    .select("id, titulo, tipo, fijado, creado_en")
    .order("fijado", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(10);
  if (error || !avisos || avisos.length === 0) return null;

  const ids = avisos.map((a: { id: string }) => a.id);
  let leidos = new Set<string>();
  if (ids.length > 0) {
    const { data: lecturas } = await supabase
      .from("avisos_lecturas")
      .select("aviso_id")
      .eq("bombero_id", bomberoId)
      .in("aviso_id", ids);
    leidos = new Set((lecturas ?? []).map((l: { aviso_id: string }) => l.aviso_id));
  }
  const lista = avisos.slice(0, 3);

  return (
    <Grupo titulo="Avisos recientes">
      {lista.map((a: { id: string; titulo: string; tipo: string }) => {
        const sinLeer = !leidos.has(a.id);
        const tipo =
          a.tipo === "convocatoria" ? "Convocatoria" : a.tipo === "importante" ? "Importante" : "Informativo";
        return (
          <Link
            key={a.id}
            href="/avisos"
            className="tap block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red"
          >
            <Fila
              titulo={a.titulo}
              subtitulo={tipo}
              valor={sinLeer ? <span className="block h-2.5 w-2.5 rounded-full bg-red" aria-hidden /> : undefined}
              chevron
            />
          </Link>
        );
      })}
    </Grupo>
  );
}

export function SkeletonResumenAvisos() {
  return (
    <Grupo titulo="Avisos recientes">
      {[0, 1, 2].map((i) => (
        <div key={i} className="fila flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-24" />
          </span>
        </div>
      ))}
    </Grupo>
  );
}
