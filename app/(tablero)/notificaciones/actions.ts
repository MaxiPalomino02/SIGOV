"use server";

import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";

export type SuscripcionResult = { ok: true } | { ok: false; error: string };

const CLAVE_RE = /^[A-Za-z0-9_-]{1,512}={0,2}$/;

function datoInvalido(): SuscripcionResult {
  return { ok: false, error: "Los datos de la suscripción son inválidos." };
}

export async function activarSuscripcionPush(datos: unknown): Promise<SuscripcionResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!datos || typeof datos !== "object") return datoInvalido();

  const { endpoint, p256dh, auth } = datos as Record<string, unknown>;
  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    endpoint.length > 2048 ||
    typeof p256dh !== "string" ||
    !CLAVE_RE.test(p256dh) ||
    typeof auth !== "string" ||
    !CLAVE_RE.test(auth)
  ) {
    return datoInvalido();
  }

  const { error } = await createServiceRoleClient().rpc("push_guardar_suscripcion", {
    p_bombero_id: session.bombero_id,
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
  });
  if (error) {
    console.error("No pudimos guardar la suscripción push.");
    return { ok: false, error: "No pudimos guardar la suscripción. Intentá de nuevo." };
  }
  return { ok: true };
}

export async function desactivarSuscripcionPush(): Promise<SuscripcionResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");

  const { error } = await createServiceRoleClient().rpc("push_borrar_suscripcion", {
    p_bombero_id: session.bombero_id,
    p_endpoint: null,
  });
  if (error) {
    console.error("No pudimos borrar la suscripción push.");
    return { ok: false, error: "No pudimos desactivar las notificaciones. Intentá de nuevo." };
  }
  return { ok: true };
}
