"use server";

import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";
import { isOficial } from "@/lib/cargos";
import { TIPOS_ALARMA } from "@/lib/alarma";
import { notificarAlarma } from "@/lib/notificaciones-alarmas";

export type AlarmaResult = { ok: true; id?: string } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string };
    if (e.code === "P0001") {
      switch (e.message) {
        case "SIN_PERMISO": return "No tenés permiso para gestionar la alarma.";
        case "TIPO_INVALIDO": return "Tipo de alarma inválido.";
        case "ALARMA_YA_ACTIVA": return "Ya hay una alarma activa. Cerrala antes de activar otra.";
        case "ALARMA_NO_ACTIVA": return "La alarma ya no está activa.";
        case "RESPUESTA_INVALIDA": return "Respuesta inválida.";
        case "BOMBERO_INACTIVO": return "Tu usuario no está activo.";
        default: break;
      }
    }
  }
  console.error("Error en alarma:", err);
  return "Ocurrió un error. Intentá de nuevo.";
}

export async function activarAlarma(
  tipo: string,
  detalle: string | null,
  esSimulacro: boolean
): Promise<AlarmaResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para activar la alarma." };
  if (!(tipo in TIPOS_ALARMA)) return { ok: false, error: "Tipo de alarma inválido." };
  const det = (detalle ?? "").trim();
  if (det.length > 300) return { ok: false, error: "El detalle es demasiado largo." };

  const { data, error } = await createServiceRoleClient().rpc("activar_alarma", {
    p_bombero_id: session.bombero_id,
    p_tipo: tipo,
    p_detalle: det || null,
    p_es_simulacro: !!esSimulacro,
  });
  if (error) return { ok: false, error: mapError(error) };
  const id = typeof data === "string" ? data : undefined;
  if (id) await notificarAlarma(id);
  return { ok: true, id };
}

export async function cerrarAlarma(alarmaId: string): Promise<AlarmaResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para cerrar la alarma." };
  if (!UUID_RE.test(alarmaId)) return { ok: false, error: "Alarma inválida." };

  const { error } = await createServiceRoleClient().rpc("cerrar_alarma", {
    p_bombero_id: session.bombero_id,
    p_alarma_id: alarmaId,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function responderAlarma(
  alarmaId: string,
  respuesta: "recibido" | "voy" | "no_puedo"
): Promise<AlarmaResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!UUID_RE.test(alarmaId)) return { ok: false, error: "Alarma inválida." };
  if (!["recibido", "voy", "no_puedo"].includes(respuesta)) {
    return { ok: false, error: "Respuesta inválida." };
  }

  const { error } = await createServiceRoleClient().rpc("responder_alarma", {
    p_bombero_id: session.bombero_id,
    p_alarma_id: alarmaId,
    p_respuesta: respuesta,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}
