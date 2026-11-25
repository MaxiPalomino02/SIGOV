"use server";

import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";
import { isOficial } from "@/lib/cargos";
import { notificarAviso } from "@/lib/notificaciones-avisos";

export type AvisoResult = { ok: true } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string };
    if (e.code === "P0001") {
      switch (e.message) {
        case "SIN_PERMISO": return "No tenés permiso para esta acción.";
        case "TITULO_REQUERIDO": return "Ingresá un título para el aviso.";
        case "CUERPO_REQUERIDO": return "Ingresá el contenido del aviso.";
        case "TIPO_INVALIDO": return "Tipo de aviso inválido.";
        case "CONVOCATORIA_INCOMPLETA": return "Completá motivo, fecha/hora y lugar de la convocatoria.";
        case "AVISO_NO_ENCONTRADO": return "No encontramos ese aviso.";
        case "CONVOCATORIA_NO_ENCONTRADA": return "No encontramos esa convocatoria.";
        case "RESPUESTA_INVALIDA": return "Respuesta inválida.";
        case "BOMBERO_INACTIVO": return "Tu usuario no está activo.";
        default: break;
      }
    }
  }
  console.error("Error en avisos:", err);
  return "Ocurrió un error. Intentá de nuevo.";
}

export async function publicarAviso(formData: FormData): Promise<AvisoResult & { id?: string }> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para publicar avisos." };

  const titulo = String(formData.get("titulo") ?? "").trim();
  const cuerpo = String(formData.get("cuerpo") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "informativo").trim();
  const fijado = String(formData.get("fijado") ?? "") === "on";
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  const fechaHoraRaw = String(formData.get("fecha_hora") ?? "").trim();
  const lugar = String(formData.get("lugar") ?? "").trim() || null;
  const fecha_hora = fechaHoraRaw ? new Date(fechaHoraRaw).toISOString() : null;

  if (!titulo) return { ok: false, error: "Ingresá un título para el aviso." };
  if (titulo.length > 120) return { ok: false, error: "El título es demasiado largo." };
  if (!cuerpo) return { ok: false, error: "Ingresá el contenido del aviso." };
  if (cuerpo.length > 4000) return { ok: false, error: "El contenido es demasiado largo." };
  if (!["informativo", "importante", "convocatoria"].includes(tipo)) {
    return { ok: false, error: "Tipo de aviso inválido." };
  }
  if (tipo === "convocatoria") {
    if (!motivo || !fecha_hora || !lugar) {
      return { ok: false, error: "Completá motivo, fecha/hora y lugar de la convocatoria." };
    }
  }

  const { data, error } = await createServiceRoleClient().rpc("publicar_aviso", {
    p_actor_id: session.bombero_id,
    p_titulo: titulo,
    p_cuerpo: cuerpo,
    p_tipo: tipo,
    p_fijado: fijado,
    p_motivo: tipo === "convocatoria" ? motivo : null,
    p_fecha_hora: tipo === "convocatoria" ? fecha_hora : null,
    p_lugar: tipo === "convocatoria" ? lugar : null,
  });
  if (error) return { ok: false, error: mapError(error) };

  const id = typeof data === "string" ? data : null;
  if (id) await notificarAviso(id);
  return { ok: true, id: id ?? undefined };
}

export async function fijarAviso(avisoId: string, fijado: boolean): Promise<AvisoResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para esta acción." };
  if (!UUID_RE.test(avisoId)) return { ok: false, error: "Aviso inválido." };

  const { error } = await createServiceRoleClient().rpc("fijar_aviso", {
    p_actor_id: session.bombero_id,
    p_aviso_id: avisoId,
    p_fijado: fijado,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function borrarAviso(avisoId: string): Promise<AvisoResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para esta acción." };
  if (!UUID_RE.test(avisoId)) return { ok: false, error: "Aviso inválido." };

  const { error } = await createServiceRoleClient().rpc("borrar_aviso", {
    p_actor_id: session.bombero_id,
    p_aviso_id: avisoId,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function marcarLeido(avisoId: string): Promise<AvisoResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!UUID_RE.test(avisoId)) return { ok: false, error: "Aviso inválido." };

  const { error } = await createServiceRoleClient().rpc("marcar_leido", {
    p_actor_id: session.bombero_id,
    p_aviso_id: avisoId,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function responderConvocatoria(
  avisoId: string,
  respuesta: "voy" | "no_puedo" | "en_camino"
): Promise<AvisoResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!UUID_RE.test(avisoId)) return { ok: false, error: "Aviso inválido." };
  if (!["voy", "no_puedo", "en_camino"].includes(respuesta)) {
    return { ok: false, error: "Respuesta inválida." };
  }

  const { error } = await createServiceRoleClient().rpc("responder_convocatoria", {
    p_actor_id: session.bombero_id,
    p_aviso_id: avisoId,
    p_respuesta: respuesta,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}
