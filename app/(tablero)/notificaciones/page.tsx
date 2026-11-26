import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { isOficial } from "@/lib/cargos";
import { createSupabaseClient, createServiceRoleClient } from "@/lib/supabase";
import { PRODUCTO } from "@/lib/marca";
import {
  NotificacionesClient,
  type NoticiaNotificacion,
} from "./notificaciones-client";

export const metadata: Metadata = {
  title: `Notificaciones | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

export default async function PaginaNotificaciones() {
  const session = await getSessionActiva();
  if (!session) redirect("/login");

  const { data, error } = await createServiceRoleClient().rpc(
    "push_tiene_suscripcion",
    { p_bombero_id: session.bombero_id }
  );

  const supabase = createSupabaseClient();
  const [avisosRes, alertasRes] = await Promise.all([
    supabase
      .from("avisos")
      .select("id, titulo, tipo")
      .order("creado_en", { ascending: false })
      .limit(3),
    supabase
      .from("alertas")
      .select("id, titulo, nivel")
      .eq("estado", "vigente")
      .order("creada_en", { ascending: false })
      .limit(2),
  ]);

  const noticias: NoticiaNotificacion[] = [
    ...(avisosRes.data ?? []).map((aviso) => ({
      id: String(aviso.id),
      titulo: String(aviso.titulo ?? "Aviso"),
      subtitulo: aviso.tipo === "convocatoria" ? "Convocatoria" : "Aviso del cuartel",
      tipo: "aviso" as const,
      href: "/avisos",
    })),
    ...(alertasRes.data ?? []).map((alerta) => ({
      id: String(alerta.id),
      titulo: String(alerta.titulo || `Alerta ${alerta.nivel}`),
      subtitulo: `Alerta ${alerta.nivel}`,
      tipo: "alerta" as const,
      href: "/alertas",
    })),
  ];

  return (
    <NotificacionesClient
      activaInicial={data === true}
      claveDisponible={Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY
      )}
      errorInicial={
        error
          ? "No pudimos consultar el estado de las notificaciones. Intentá de nuevo."
          : null
      }
      puedeProbar={isOficial(session.cargo)}
      noticias={noticias}
    />
  );
}
