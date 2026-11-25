import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isOficial } from "@/lib/cargos";
import { createServiceRoleClient } from "@/lib/supabase";
import { estadoVigenteCalculado, FUENTE_SMN, refrescarSmnSiCorresponde } from "@/lib/alertas";
import { AlertasClient, type AlertaVista, type FuenteEstado } from "./alertas-client";

export const metadata: Metadata = {
  title: "Alertas | SIGOV",
};

export const dynamic = "force-dynamic";

export default async function AlertasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const oficial = isOficial(session.cargo);

  await refrescarSmnSiCorresponde();

  const supabase = createServiceRoleClient();
  await supabase.rpc("marcar_alertas_vencidas");

  const [{ data: filas, error }, { data: fuentes }] = await Promise.all([
    supabase
      .from("alertas")
      .select("id, tipo_fuente, id_externo, nivel, fenomeno, titulo, descripcion, area, desde, hasta, fuente_nombre, fuente_url, origen, estado, creada_en, actualizada_en, ultima_verificacion")
      .order("actualizada_en", { ascending: false })
      .limit(200),
    supabase
      .from("alertas_fuentes_estado")
      .select("fuente, ultima_verificacion, ultimo_ok, ultimo_error"),
  ]);

  const ahora = new Date();
  const alertas: AlertaVista[] = (filas ?? []).map((a: any) => ({
    ...a,
    estado_calculado: estadoVigenteCalculado(a.estado, a.hasta, ahora),
  }));

  const fuenteSmn: FuenteEstado = (fuentes ?? []).find((f: any) => f.fuente === FUENTE_SMN) ?? {
    fuente: FUENTE_SMN,
    ultima_verificacion: null,
    ultimo_ok: null,
    ultimo_error: null,
  };

  return (
    <AlertasClient
      alertasIniciales={alertas}
      fuenteSmn={fuenteSmn}
      oficial={oficial}
      errorCarga={error ? "No se pudieron cargar las alertas." : null}
    />
  );
}
