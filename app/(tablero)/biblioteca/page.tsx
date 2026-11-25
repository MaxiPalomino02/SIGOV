import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { isOficial } from "@/lib/cargos";
import { PRODUCTO } from "@/lib/marca";
import { obtenerDocumentosIniciales } from "./actions";
import { BibliotecaClient } from "./biblioteca-client";

export const metadata: Metadata = {
  title: `Biblioteca | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

export default async function BibliotecaPage() {
  const session = await getSessionActiva();
  if (!session) redirect("/login");

  const resultado = await obtenerDocumentosIniciales();

  return (
    <BibliotecaClient
      inicial={resultado.documentos}
      cargaError={resultado.error}
      sessionId={session.bombero_id}
      sessionNombre={session.nombre_completo}
      esOficial={isOficial(session.cargo)}
    />
  );
}
