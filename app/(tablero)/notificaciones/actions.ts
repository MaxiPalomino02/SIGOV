"use server";

import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { isOficial } from "@/lib/cargos";
import { createServiceRoleClient } from "@/lib/supabase";
import { enviarPush } from "@/lib/push";
import {
  borrarSuscripcionPush,
  guardarSuscripcionPush,
  type SuscripcionResult,
} from "@/lib/push-suscripcion";

export async function activarSuscripcionPush(datos: unknown): Promise<SuscripcionResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  return guardarSuscripcionPush(datos, session);
}

export async function desactivarSuscripcionPush(): Promise<SuscripcionResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  return borrarSuscripcionPush(session);
}

export async function enviarNotificacionPrueba(): Promise<SuscripcionResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) {
    return { ok: false, error: "No tenés permiso para enviar una prueba." };
  }

  const registro = await createServiceRoleClient().rpc("push_registrar_envio", {
    p_referencia: `prueba:${session.bombero_id}`,
    p_ventana_segundos: 60,
  });
  if (registro.error || registro.data !== true) {
    return { ok: false, error: "Ya enviamos una prueba hace poco. Esperá un minuto." };
  }

  const resultado = await enviarPush(
    { bomberoId: session.bombero_id },
    {
      titulo: "Notificación de prueba",
      cuerpo: "SIGOV. Las notificaciones están funcionando en este dispositivo.",
      tipo: "aviso",
      url: "/notificaciones",
      tag: "sigov-prueba",
      urgencia: "normal",
    }
  );

  if (resultado.enviados === 0) {
    return {
      ok: false,
      error: "No pudimos entregar la prueba. Revisá que las notificaciones estén activadas acá.",
    };
  }
  return { ok: true };
}
