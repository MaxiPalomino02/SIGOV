import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BannerAlarma } from "@/components/banner-alarma";
import { BannerAlerta } from "@/components/banner-alerta";
import { PageHeader } from "@/components/page-header";
import { PRODUCTO } from "@/lib/marca";
import { getSession } from "@/lib/session";
import { isOficial } from "@/lib/cargos";
import { createSupabaseClient } from "@/lib/supabase";
import { dateToKey, franjaActual } from "@/lib/tablero";
import {
  AccesosRapidos,
  ahoraTucuman,
  formatearFechaTucuman,
  LineaHuecosOficial,
  ResumenAvisosInicio,
  ResumenInicio,
  SkeletonLineaHuecos,
  SkeletonResumenAvisos,
  SkeletonResumenInicio,
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
    const ids = (avisos ?? []).map((a: { id: string }) => a.id);
    if (ids.length === 0) return 0;
    const { data: lecturas } = await supabase
      .from("avisos_lecturas")
      .select("aviso_id")
      .eq("bombero_id", bomberoId)
      .in("aviso_id", ids);
    const leidos = new Set((lecturas ?? []).map((l: { aviso_id: string }) => l.aviso_id));
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
    <>
      <PageHeader titulo={`Hola, ${session.nombre_completo}`} subtitulo={formatearFechaTucuman(ahora)} />
      <div className="space-y-4 lg:space-y-6">
        <div className="space-y-3">
          <BannerAlarma />
          <BannerAlerta />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="space-y-4 lg:space-y-6">
            <Suspense fallback={<SkeletonTuTurno />}>
              <TuTurno
                bomberoId={session.bombero_id}
                hoy={hoy}
                fechaActual={actual.fechaKey}
                franjaActualAhora={actual.franja}
              />
            </Suspense>

            <Suspense fallback={<SkeletonResumenInicio />}>
              <ResumenInicio
                bomberoId={session.bombero_id}
                fechaActual={actual.fechaKey}
                franjaActualAhora={actual.franja}
                avisosNoLeidos={avisosNoLeidos}
              />
            </Suspense>

            <AccesosRapidos oficial={oficial} />

            {oficial ? (
              <Suspense fallback={<SkeletonLineaHuecos />}>
                <LineaHuecosOficial hoy={hoy} />
              </Suspense>
            ) : null}
          </div>

          <div className="space-y-4 lg:space-y-6">
            <Suspense fallback={<SkeletonResumenAvisos />}>
              <ResumenAvisosInicio bomberoId={session.bombero_id} />
            </Suspense>
            <Suspense fallback={<SkeletonProximosEventos />}>
              <ProximosEventos />
            </Suspense>
          </div>
        </div>
      </div>
    </>
  );
}
