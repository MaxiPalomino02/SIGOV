import "server-only";
import { createServiceRoleClient } from "@/lib/supabase";
import { enviarPush } from "@/lib/push";

type ConvocatoriaPush = { motivo: string; fecha_hora: string; lugar: string };
type AvisoPush = {
  id: string;
  titulo: string;
  cuerpo: string;
  tipo: string;
  convocatorias: ConvocatoriaPush[] | ConvocatoriaPush | null;
};

export async function notificarAviso(avisoId: string): Promise<void> {
  try {
    const { data, error } = await createServiceRoleClient()
      .from("avisos")
      .select("id, titulo, cuerpo, tipo, convocatorias(motivo, fecha_hora, lugar)")
      .eq("id", avisoId)
      .maybeSingle();

    if (error || !data) return;
    const aviso = data as unknown as AvisoPush;
    const esConvocatoria = aviso.tipo === "convocatoria";
    const convocatoria = Array.isArray(aviso.convocatorias)
      ? aviso.convocatorias[0]
      : aviso.convocatorias;
    const detalle = esConvocatoria && convocatoria
      ? `${aviso.cuerpo}\nMotivo: ${convocatoria.motivo}\nLugar: ${convocatoria.lugar}`
      : aviso.cuerpo;

    await enviarPush("todos", {
      titulo: esConvocatoria ? `Convocatoria: ${aviso.titulo}` : `Aviso: ${aviso.titulo}`,
      cuerpo: detalle,
      tipo: esConvocatoria ? "convocatoria" : "aviso",
      url: "/avisos",
      tag: `aviso-${aviso.id}`,
      urgencia: esConvocatoria || aviso.tipo === "importante" ? "high" : "normal",
      requiereInteraccion: esConvocatoria,
    });
  } catch {
    console.error("No pudimos preparar la notificación del aviso.");
  }
}
