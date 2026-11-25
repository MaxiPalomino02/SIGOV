import Link from "next/link";
import { BookOpen, CalendarPlus, ChevronRight, ClipboardCheck, Siren } from "lucide-react";
import { Card } from "@/components/ui/card";
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
    year: "numeric",
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
  const siguiente = enServicio ? turnos.find((t) => !(t.fecha === fechaActual && t.franja === franjaActualAhora)) : turnos[1];

  return (
    <Card acento="brass" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[12px] font-semibold uppercase tracking-wider text-brass">Tu turno</p>
        {enServicio ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-alarm">
            <span className="h-2.5 w-2.5 rounded-full bg-alarm" aria-hidden />
            En servicio ahora
          </span>
        ) : null}
      </div>

      {!resultado.ok ? (
        <p className="mt-4 text-[16px] text-ink-muted">No pudimos cargar tus turnos.</p>
      ) : actual ? (
        <div className="mt-3">
          <p className="heading-display leading-tight text-ink">
            {etiquetaTurno(actual.fecha, actual.franja, hoy)}
          </p>
          {siguiente ? (
            <p className="texto-aux mt-2">
              Próximo turno: {etiquetaTurno(siguiente.fecha, siguiente.franja, hoy)}
            </p>
          ) : (
            <p className="texto-aux mt-2">No tenés más turnos anotados.</p>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-[16px] text-ink-muted">No tenés turnos anotados</p>
          <Link
            href="/guardias"
            className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[10px] bg-fire px-4 font-mono text-[12px] font-semibold uppercase tracking-wider text-surface hover:bg-fire-dark"
          >
            Anotarme en una guardia
          </Link>
        </div>
      )}
    </Card>
  );
}

export function SkeletonTuTurno() {
  return (
    <Card className="p-5">
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

export async function IndicadoresInicio({
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
  const miasPendientes = tareas.filter((t: any) => t.asignada_a === bomberoId).length;
  const tareasPendientes = miasPendientes > 0 ? miasPendientes : tareas.length;
  const deGuardia = guardiaRes.ok ? guardiaRes.data : null;

  const items = [
    {
      href: "/tareas",
      valor: tareasPendientes,
      etiqueta: "Tareas pendientes",
      valorClass: "text-ink",
    },
    {
      href: "/avisos",
      valor: avisosNoLeidos,
      etiqueta: "Avisos sin leer",
      valorClass: avisosNoLeidos > 0 ? "text-fire" : "text-ink",
    },
    {
      href: "/guardias",
      valor: deGuardia,
      etiqueta: "De guardia ahora",
      valorClass: "text-ink",
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-2">
      {items.map((item) => (
        <Link
          key={item.etiqueta}
          href={item.href}
          className="flex min-h-[76px] items-center justify-between rounded-[12px] border border-line bg-surface px-4 py-3 shadow-[0_1px_3px_rgba(20,26,24,0.06)] transition-shadow hover:shadow-[0_4px_14px_rgba(20,26,24,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft lg:min-h-0 lg:px-3 lg:py-2"
        >
          <span className="font-mono text-[12px] font-semibold uppercase tracking-wider text-ink-muted">{item.etiqueta}</span>
          <span className={`heading-display leading-none tabular-nums ${item.valorClass}`}>
            {item.valor === null ? "—" : item.valor}
          </span>
        </Link>
      ))}
    </div>
  );
}

export function SkeletonIndicadoresInicio() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-[12px] border border-line bg-surface px-4 py-3 shadow-[0_1px_3px_rgba(20,26,24,0.06)] lg:px-3 lg:py-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-6 w-10" />
        </div>
      ))}
    </div>
  );
}

const ACCESOS = [
  { href: "/guardias", label: "Anotarme", Icono: CalendarPlus },
  { href: "/incidentes", label: "Incidente", Icono: Siren },
  { href: "/chequeo", label: "Chequeo", Icono: ClipboardCheck },
  { href: "/biblioteca", label: "Biblioteca", Icono: BookOpen },
] as const;

export function AccesosRapidos() {
  return (
    <section aria-label="Accesos rápidos" className="space-y-2">
      <h2 className="font-mono text-[12px] font-semibold uppercase tracking-wider text-ink-muted">Accesos rápidos</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACCESOS.map(({ href, label, Icono }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-[12px] border border-line bg-surface px-3 py-3 font-mono text-[12px] font-semibold uppercase tracking-wider text-ink shadow-[0_1px_3px_rgba(20,26,24,0.06)] transition-shadow hover:shadow-[0_4px_14px_rgba(20,26,24,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft"
          >
            <Icono className="h-5 w-5 text-fire" aria-hidden />
            <span>{label}</span>
          </Link>
        ))}
      </div>
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
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-[12px] border border-brass-border bg-brass-light px-4 py-2 text-[16px] text-ink">
      <span>
        <span className="font-mono text-[12px] font-semibold uppercase tracking-wider text-brass">Cobertura</span>
        <span className="ml-2">Faltan personas en {n} {n === 1 ? "turno" : "turnos"} esta semana</span>
      </span>
      <Link href="/guardias" className="shrink-0 font-mono text-[12px] font-semibold uppercase tracking-wider text-brass hover:underline">
        Revisar
      </Link>
    </div>
  );
}

export function SkeletonLineaHuecos() {
  return <Skeleton className="h-11 w-full rounded-[12px]" />;
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

  const ids = avisos.map((a: any) => a.id);
  let leidos = new Set<string>();
  if (ids.length > 0) {
    const { data: lecturas } = await supabase
      .from("avisos_lecturas")
      .select("aviso_id")
      .eq("bombero_id", bomberoId)
      .in("aviso_id", ids);
    leidos = new Set((lecturas ?? []).map((l: any) => l.aviso_id));
  }
  const lista = avisos.slice(0, 3);
  const noLeidos = ids.filter((id) => !leidos.has(id)).length;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="titulo-tarjeta">Avisos recientes</h2>
        {noLeidos > 0 ? <span className="texto-aux">{noLeidos} sin leer</span> : null}
      </div>
      <ul className="mt-3 divide-y divide-line-subtle">
        {lista.map((a: any) => {
          const sinLeer = !leidos.has(a.id);
          return (
            <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
              <Link href="/avisos" className="flex items-start gap-2 hover:underline">
                {sinLeer ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-fire" aria-hidden /> : <span className="mt-2 h-2 w-2 shrink-0" aria-hidden />}
                <span className="min-w-0">
                  <span className="block text-[16px] text-ink">{a.titulo}</span>
                  <span className="texto-aux block">
                    {a.tipo === "convocatoria" ? "Convocatoria" : a.tipo === "importante" ? "Importante" : "Informativo"}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <Link href="/avisos" className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-[16px] font-medium text-fire hover:underline">
          Ver avisos <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

export function SkeletonResumenAvisos() {
  return (
    <Card className="p-5">
      <Skeleton className="h-5 w-36" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </Card>
  );
}
