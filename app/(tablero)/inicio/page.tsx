import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BannerAlarma } from "@/components/banner-alarma";
import { BannerAlerta } from "@/components/banner-alerta";
import { PRODUCTO } from "@/lib/marca";
import { getSession } from "@/lib/session";
import { isOficial } from "@/lib/cargos";
import { createSupabaseClient } from "@/lib/supabase";
import { dateToKey, franjaActual } from "@/lib/tablero";
import {
  AccesosRapidos,
  ahoraTucuman,
  formatearFechaTucuman,
  IndicadoresInicio,
  LineaHuecosOficial,
  ResumenAvisosInicio,
  SkeletonIndicadoresInicio,
  SkeletonLineaHuecos,
  SkeletonResumenAvisos,
  SkeletonTuTurno,
  TuTurno,
} from "./secciones";
import { ProximosEventos, SkeletonProximosEventos } from "./ProximosEventos";

export const metadata: Metadata = {
  title: `Inicio | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

async function contarAvisosNoLeidos(bomberoId: string): Promise<number> {
  try {
    const supabase = createSupabaseClient();
    const { data: avisos } = await supabase.from("avisos").select("id");
    const ids = (avisos ?? []).map((a: any) => a.id);
    if (ids.length === 0) return 0;
    const { data: lecturas } = await supabase
      .from("avisos_lecturas")
      .select("aviso_id")
      .eq("bombero_id", bomberoId)
      .in("aviso_id", ids);
    const leidos = new Set((lecturas ?? []).map((l: any) => l.aviso_id));
    return ids.filter((id) => !leidos.has(id)).length;
  } catch {
    return 0;
  }
}

export default async function InicioPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const ahora = ahoraTucuman();
  const actual = franjaActual(ahora);
  const hoy = dateToKey(ahora);
  const oficial = isOficial(session.cargo);
  const avisosNoLeidos = await contarAvisosNoLeidos(session.bombero_id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <h1 className="heading-display">Inicio</h1>
          <p className="texto-aux">{formatearFechaTucuman(ahora)}</p>
        </header>

        <div className="flex min-h-11 items-center gap-2.5 rounded-[12px] border border-alarm-border bg-alarm-light px-4 py-2 text-[16px] text-ink">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-alarm animate-pulse" aria-hidden />
          <span>
            <span className="font-mono text-[12px] font-semibold uppercase tracking-wider text-alarm">Operativo</span>
            <span className="ml-2">en servicio ahora</span>
          </span>
        </div>

        <BannerAlarma />
        <BannerAlerta />

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Suspense fallback={<SkeletonTuTurno />}>
              <TuTurno
                bomberoId={session.bombero_id}
                hoy={hoy}
                fechaActual={actual.fechaKey}
                franjaActualAhora={actual.franja}
              />
            </Suspense>
          </div>
          <div className="lg:col-span-1">
            <Suspense fallback={<SkeletonIndicadoresInicio />}>
              <IndicadoresInicio
                bomberoId={session.bombero_id}
                fechaActual={actual.fechaKey}
                franjaActualAhora={actual.franja}
                avisosNoLeidos={avisosNoLeidos}
              />
            </Suspense>
          </div>
        </div>

        <AccesosRapidos />

        {oficial ? (
          <Suspense fallback={<SkeletonLineaHuecos />}>
            <LineaHuecosOficial hoy={hoy} />
          </Suspense>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <Suspense fallback={<SkeletonResumenAvisos />}>
            <ResumenAvisosInicio bomberoId={session.bombero_id} />
          </Suspense>
          <Suspense fallback={<SkeletonProximosEventos />}>
            <ProximosEventos />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
