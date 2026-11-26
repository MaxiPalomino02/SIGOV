import "server-only";
import { createServiceRoleClient } from "@/lib/supabase";
import { etiquetaAlarma } from "@/lib/alarma";
import { CUARTEL } from "@/lib/cuartel.config";
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

    const supabase = createServiceRoleClient();
    const registro = await supabase.rpc("push_registrar_envio", {
      p_referencia: `alarma:${alarma.id}`,
      p_ventana_segundos: 1800,
    });
    if (registro.error || registro.data !== true) return;

    const tipo = etiquetaAlarma(alarma.tipo, alarma.es_simulacro);
    const detalle = alarma.detalle?.trim();
    const cuerpo = detalle
      ? `${tipo}. Detalle: ${detalle}. Presentarse en ${CUARTEL.nombre}.`
      : `${tipo}. Presentarse en ${CUARTEL.nombre}.`;

    const resultado = await enviarPush("todos", {
      titulo: alarma.es_simulacro ? "Simulacro" : "Alarma activa",
      cuerpo,
      tipo: "alarma",
      url: "/alarma",
      tag: "alarma-activa",
      urgencia: "high",
      requiereInteraccion: true,
      vibracion: [1000, 500, 1000, 500, 1000, 500, 2000],
    });

    if (resultado.enviados > 0) {
      const actualizacion = await supabase.rpc("alarma_registrar_envio", {
        p_alarma_id: alarma.id,
        p_mensaje: cuerpo,
        p_cantidad: resultado.enviados,
      });
      if (actualizacion.error) {
        console.warn("No pudimos registrar el total de notificaciones de la alarma.");
      }
    }
  } catch {
    console.error("No pudimos preparar la notificación de la alarma.");
  }
}
