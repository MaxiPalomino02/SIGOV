import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PRODUCTO } from "@/lib/marca";
import { getSessionActiva } from "@/lib/session-db";
import { hoyArgentina } from "@/lib/tablero";
import { obtenerActividadesIniciales, obtenerBomberosActivos } from "./actions";
import { PrevencionClient } from "./prevencion-client";

export const metadata: Metadata = {
  title: `Prevención | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

export default async function PrevencionPage() {
  const session = await getSessionActiva();
  if (!session) redirect("/login");

  const [actividades, bomberos] = await Promise.all([
    obtenerActividadesIniciales(),
    obtenerBomberosActivos(),
  ]);

  return (
    <PrevencionClient
      inicial={actividades.actividades}
      cargaError={actividades.error}
      bomberos={bomberos.ok ? bomberos.data : []}
      bomberosError={bomberos.ok ? null : bomberos.error}
      sessionNombre={session.nombre_completo}
      hoy={hoyArgentina()}
    />
  );
}
