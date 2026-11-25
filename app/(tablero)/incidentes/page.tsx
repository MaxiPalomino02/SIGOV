import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { isOficial } from "@/lib/cargos";
import { CUARTEL } from "@/lib/cuartel.config";
import { PRODUCTO } from "@/lib/marca";
import { ahoraParaInput } from "@/lib/incidentes";
import { obtenerIncidentesIniciales, obtenerPersonalGuardia } from "./actions";
import { IncidentesClient } from "./incidentes-client";

export const metadata: Metadata = {
  title: `Incidentes | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

export default async function IncidentesPage() {
  const session = await getSessionActiva();
  if (!session) redirect("/login");

  const [incidentesRes, personalRes] = await Promise.all([
    obtenerIncidentesIniciales(),
    obtenerPersonalGuardia(),
  ]);

  return (
    <IncidentesClient
      inicial={incidentesRes.incidentes}
      cargaError={incidentesRes.error}
      personalGuardia={personalRes.ok ? personalRes.data : []}
      personalError={personalRes.ok ? null : personalRes.error}
      sessionId={session.bombero_id}
      sessionNombre={session.nombre_completo}
      esOficial={isOficial(session.cargo)}
      ahoraInicial={ahoraParaInput()}
      cuartel={{
        nombre: CUARTEL.nombre,
        localidad: CUARTEL.localidad,
        provincia: CUARTEL.provincia,
        escudo: CUARTEL.escudo,
      }}
    />
  );
}
