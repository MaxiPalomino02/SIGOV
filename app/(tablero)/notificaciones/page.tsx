import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";
import { PRODUCTO } from "@/lib/marca";
import { NotificacionesClient } from "./notificaciones-client";

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

  return (
    <NotificacionesClient
      activaInicial={data === true}
      claveDisponible={Boolean(process.env.VAPID_PUBLIC_KEY)}
      errorInicial={
        error
          ? "No pudimos consultar el estado de las notificaciones. Intentá de nuevo."
          : null
      }
    />
  );
}
