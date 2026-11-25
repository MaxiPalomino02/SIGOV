"use server";

import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";
import { isOficial } from "@/lib/cargos";

export type TareaResult = { ok: true } | { ok: false; error: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string };
    if (e.code === "P0001") {
      switch (e.message) {
        case "SIN_PERMISO":
          return "No tenés permiso para gestionar tareas.";
        case "SIN_PERMISO_MARCAR":
          return "No podés marcar esta tarea en este momento.";
        case "TAREA_YA_HECHA":
          return "Esta tarea ya fue marcada como hecha.";
        case "TAREA_NO_HECHA":
          return "Esta tarea no está marcada como hecha.";
        case "DESMARCAR_VENCIDO":
          return "Solo podés desmarcar dentro de los 10 minutos, o pedile a un oficial.";
        case "TITULO_REQUERIDO":
          return "Ingresá un título para la tarea.";
        case "ASIGNADO_INVALIDO":
          return "La persona asignada no es válida.";
        case "TAREA_NO_ENCONTRADA":
          return "No encontramos esa tarea.";
        case "BOMBERO_INACTIVO":
          return "Tu usuario no está activo.";
        default:
          break;
      }
    }
  }
  console.error("Error en tareas:", err);
  return "Ocurrió un error. Intentá de nuevo.";
}

export async function crearTarea(formData: FormData): Promise<TareaResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para gestionar tareas." };

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const asignadaRaw = String(formData.get("asignada_a") ?? "").trim();
  const asignada_a = asignadaRaw && UUID_RE.test(asignadaRaw) ? asignadaRaw : null;

  if (!titulo) return { ok: false, error: "Ingresá un título para la tarea." };
  if (titulo.length > 120) return { ok: false, error: "El título es demasiado largo." };
  if (descripcion && descripcion.length > 1000) return { ok: false, error: "La descripción es demasiado larga." };

  const { error } = await createServiceRoleClient().rpc("crear_tarea", {
    p_actor_id: session.bombero_id,
    p_titulo: titulo,
    p_descripcion: descripcion,
    p_asignada_a: asignada_a,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function editarTarea(
  tareaId: string,
  formData: FormData
): Promise<TareaResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para gestionar tareas." };
  if (!UUID_RE.test(tareaId)) return { ok: false, error: "Tarea inválida." };

  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const asignadaRaw = String(formData.get("asignada_a") ?? "").trim();
  const asignada_a = asignadaRaw && UUID_RE.test(asignadaRaw) ? asignadaRaw : null;

  if (!titulo) return { ok: false, error: "Ingresá un título para la tarea." };
  if (titulo.length > 120) return { ok: false, error: "El título es demasiado largo." };
  if (descripcion && descripcion.length > 1000) return { ok: false, error: "La descripción es demasiado larga." };

  const { error } = await createServiceRoleClient().rpc("editar_tarea", {
    p_actor_id: session.bombero_id,
    p_tarea_id: tareaId,
    p_titulo: titulo,
    p_descripcion: descripcion,
    p_asignada_a: asignada_a,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function borrarTarea(tareaId: string): Promise<TareaResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para gestionar tareas." };
  if (!UUID_RE.test(tareaId)) return { ok: false, error: "Tarea inválida." };

  const { error } = await createServiceRoleClient().rpc("borrar_tarea", {
    p_actor_id: session.bombero_id,
    p_tarea_id: tareaId,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function marcarTarea(tareaId: string): Promise<TareaResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!UUID_RE.test(tareaId)) return { ok: false, error: "Tarea inválida." };

  const { error } = await createServiceRoleClient().rpc("marcar_tarea", {
    p_actor_id: session.bombero_id,
    p_tarea_id: tareaId,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}

export async function desmarcarTarea(tareaId: string): Promise<TareaResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!UUID_RE.test(tareaId)) return { ok: false, error: "Tarea inválida." };

  const { error } = await createServiceRoleClient().rpc("desmarcar_tarea", {
    p_actor_id: session.bombero_id,
    p_tarea_id: tareaId,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true };
}
