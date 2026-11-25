import "server-only";
import { createServiceRoleClient } from "@/lib/supabase";
import { etiquetaAlarma } from "@/lib/alarma";
import { enviarPush } from "@/lib/push";

type AlarmaPush = {
  id: string;
  tipo: string;
  detalle: string | null;
  es_simulacro: boolean;
  activa: boolean;
};

export async function notificarAlarma(alarmaId: string): Promise<void> {
  try {
    const { data, error } = await createServiceRoleClient()
      .from("alarmas")
      .select("id, tipo, detalle, es_simulacro, activa")
      .eq("id", alarmaId)
      .maybeSingle();

    if (error || !data) return;
    const alarma = data as AlarmaPush;
    if (!alarma.activa) return;

    const tipo = etiquetaAlarma(alarma.tipo, alarma.es_simulacro);
    const detalle = alarma.detalle?.trim();
    const cuerpo = detalle
      ? `${tipo}. Detalle: ${detalle}. Presentarse en el cuartel.`
      : `${tipo}. Presentarse en el cuartel.`;

    await enviarPush("todos", {
      titulo: alarma.es_simulacro ? "Simulacro" : "Alarma activa",
      cuerpo,
      tipo: "alarma",
      url: "/alarma",
      tag: "alarma-activa",
      urgencia: "high",
      requiereInteraccion: true,
      vibracion: [1000, 500, 1000, 500, 1000, 500, 2000],
    });
  } catch {
    console.error("No pudimos preparar la notificación de la alarma.");
  }
}
