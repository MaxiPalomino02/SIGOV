import "server-only";
import { createServiceRoleClient } from "@/lib/supabase";
import { enviarPush } from "@/lib/push";

type AlertaPush = {
  id: string;
  nivel: string;
  titulo: string;
  descripcion: string;
  area: string;
  estado: string;
};

export async function notificarAlerta(alertaId: string): Promise<void> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("alertas")
      .select("id, nivel, titulo, descripcion, area, estado")
      .eq("id", alertaId)
      .maybeSingle();

    if (error || !data) return;
    const alerta = data as AlertaPush;
    if (alerta.estado !== "vigente") return;
    if (alerta.nivel !== "naranja" && alerta.nivel !== "roja") return;

    const registro = await supabase.rpc("push_registrar_envio", {
      p_referencia: `alerta:${alerta.id}`,
      p_ventana_segundos: 1800,
    });
    if (registro.error || registro.data !== true) return;

    const partes = [
      alerta.descripcion.trim(),
      alerta.area.trim() ? `Zona: ${alerta.area.trim()}` : "",
    ].filter(Boolean);
    const cuerpo = `Nivel ${alerta.nivel}. ${partes.join(" ") || "Revisá el detalle en SIGOV."}`;

    await enviarPush("todos", {
      titulo: alerta.titulo.trim().slice(0, 120) || `Alerta ${alerta.nivel}`,
      cuerpo,
      tipo: "alerta",
      url: "/avisos",
      tag: `alerta-${alerta.id}`,
      urgencia: alerta.nivel === "roja" ? "high" : "normal",
      requiereInteraccion: alerta.nivel === "roja",
    });
  } catch {
    console.error("No pudimos preparar la notificación de la alerta.");
  }
}
