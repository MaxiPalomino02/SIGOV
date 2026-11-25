"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionActiva } from "@/lib/session-db";
import { isOficial } from "@/lib/cargos";
import { createServiceRoleClient } from "@/lib/supabase";
import { sincronizarAlertasSmn } from "@/lib/alertas";
import { notificarAlerta } from "@/lib/notificaciones-alertas";

export type AlertaAccionResult = { ok: true; id?: string } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS = new Set(["meteorologica", "hidrologica", "institucional"]);
const NIVELES = new Set(["informativa", "amarilla", "naranja", "roja"]);

function invalidarAlertas(): void {
  revalidatePath("/", "layout");
}

function mapError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string };
    if (e.code === "P0001") {
      switch (e.message) {
        case "SIN_PERMISO": return "No tenés permiso para gestionar alertas.";
        case "TIPO_INVALIDO": return "Tipo de alerta inválido.";
        case "NIVEL_INVALIDO": return "Nivel inválido.";
        case "TITULO_REQUERIDO": return "El título es obligatorio.";
        case "FUENTE_REQUERIDA": return "La fuente es obligatoria.";
        case "ALERTA_NO_ENCONTRADA": return "No se encontró la alerta.";
        default: break;
      }
    }
  }
  console.error("Error en alertas:", err);
  return "Ocurrió un error. Intentá de nuevo.";
}

function parseFecha(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function crearAlertaManual(formData: FormData): Promise<AlertaAccionResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para crear alertas." };

  const tipo = String(formData.get("tipo_fuente") ?? "").trim();
  const nivel = String(formData.get("nivel") ?? "").trim();
  const fenomeno = String(formData.get("fenomeno") ?? "").trim();
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const area = String(formData.get("area") ?? "").trim();
  const fuente = String(formData.get("fuente_nombre") ?? "").trim();
  const fuenteUrl = String(formData.get("fuente_url") ?? "").trim();
  const desde = parseFecha(formData.get("desde"));
  const hasta = parseFecha(formData.get("hasta"));

  if (!TIPOS.has(tipo)) return { ok: false, error: "Tipo de alerta inválido." };
  if (!NIVELES.has(nivel)) return { ok: false, error: "Nivel inválido." };
  if (!titulo) return { ok: false, error: "El título es obligatorio." };
  if (titulo.length > 200) return { ok: false, error: "El título es demasiado largo." };
  if (!fuente) return { ok: false, error: "La fuente es obligatoria." };
  if (descripcion.length > 2000) return { ok: false, error: "La descripción es demasiado larga." };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("crear_alerta_manual", {
    p_bombero_id: session.bombero_id,
    p_tipo_fuente: tipo,
    p_nivel: nivel,
    p_fenomeno: fenomeno || null,
    p_titulo: titulo,
    p_descripcion: descripcion || null,
    p_area: area || null,
    p_desde: desde,
    p_hasta: hasta,
    p_fuente_nombre: fuente,
    p_fuente_url: fuenteUrl || null,
  });
  if (error) return { ok: false, error: mapError(error) };
  const id = typeof data === "string" ? data : undefined;
  const vigente = !hasta || new Date(hasta) > new Date();
  if (id && vigente && (nivel === "naranja" || nivel === "roja")) {
    await notificarAlerta(id);
  }
  invalidarAlertas();
  return { ok: true, id };
}

export async function cerrarAlerta(alertaId: string): Promise<AlertaAccionResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para gestionar alertas." };
  if (!UUID_RE.test(alertaId)) return { ok: false, error: "Alerta inválida." };
  const { error } = await createServiceRoleClient().rpc("cerrar_alerta", {
    p_bombero_id: session.bombero_id,
    p_alerta_id: alertaId,
  });
  if (error) return { ok: false, error: mapError(error) };
  invalidarAlertas();
  return { ok: true };
}

export async function cancelarAlerta(alertaId: string): Promise<AlertaAccionResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para gestionar alertas." };
  if (!UUID_RE.test(alertaId)) return { ok: false, error: "Alerta inválida." };
  const { error } = await createServiceRoleClient().rpc("cancelar_alerta", {
    p_bombero_id: session.bombero_id,
    p_alerta_id: alertaId,
  });
  if (error) return { ok: false, error: mapError(error) };
  invalidarAlertas();
  return { ok: true };
}

export async function actualizarAlertasAhora(): Promise<AlertaAccionResult> {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) return { ok: false, error: "No tenés permiso para actualizar alertas." };
  const res = await sincronizarAlertasSmn({ forzar: true });
  if (!res.ok) return { ok: false, error: "No se pudo consultar la fuente de alertas." };
  invalidarAlertas();
  return { ok: true };
}
