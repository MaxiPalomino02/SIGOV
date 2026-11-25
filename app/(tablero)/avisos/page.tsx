import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { isOficial } from "@/lib/cargos";
import { PRODUCTO } from "@/lib/marca";
import {
  AvisosClient,
  type AvisoVista,
  type BomberoActivo,
} from "./avisos-client";

export const metadata: Metadata = {
  title: `Avisos | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

export default async function AvisosPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createSupabaseClient();

  const { data: avisosData, error: avisosError } = await supabase
    .from("avisos")
    .select(
      "id, titulo, cuerpo, tipo, creado_por, fijado, creado_en, creador:bomberos!avisos_creado_por_fkey(nombre_completo), convocatorias(motivo, fecha_hora, lugar)"
    )
    .order("fijado", { ascending: false })
    .order("creado_en", { ascending: false });

  const ids = (avisosData ?? []).map((a: any) => a.id);

  const { data: lecturasData } = ids.length
    ? await supabase
        .from("avisos_lecturas")
        .select("aviso_id")
        .eq("bombero_id", session.bombero_id)
        .in("aviso_id", ids)
    : { data: [] as any[] };

  const convIds = (avisosData ?? [])
    .filter((a: any) => a.tipo === "convocatoria")
    .map((a: any) => a.id);

  const { data: respuestasData } = convIds.length
    ? await supabase
        .from("convocatoria_respuestas")
        .select("aviso_id, bombero_id, respuesta, respondido_en, bombero:bomberos(nombre_completo)")
        .in("aviso_id", convIds)
    : { data: [] as any[] };

  const { data: activosData } = await supabase
    .from("bomberos")
    .select("id, nombre_completo")
    .eq("activo", true)
    .order("nombre_completo", { ascending: true });

  const leidos = new Set((lecturasData ?? []).map((l: any) => l.aviso_id));

  const avisos: AvisoVista[] = (avisosData ?? []).map((a: any) => {
    const conv = Array.isArray(a.convocatorias) ? a.convocatorias[0] : a.convocatorias;
    const respuestas = (respuestasData ?? [])
      .filter((r: any) => r.aviso_id === a.id)
      .map((r: any) => ({
        bombero_id: r.bombero_id,
        nombre: r.bombero?.nombre_completo ?? "Bombero",
        respuesta: r.respuesta as "voy" | "no_puedo" | "en_camino",
        respondido_en: r.respondido_en,
      }));
    return {
      id: a.id,
      titulo: a.titulo,
      cuerpo: a.cuerpo,
      tipo: a.tipo,
      creado_por: a.creado_por,
      creador_nombre: a.creador?.nombre_completo ?? "Oficial",
      fijado: !!a.fijado,
      creado_en: a.creado_en,
      leido: leidos.has(a.id),
      convocatoria: conv
        ? { motivo: conv.motivo, fecha_hora: conv.fecha_hora, lugar: conv.lugar }
        : null,
      respuestas,
    };
  });

  const activos: BomberoActivo[] = (activosData ?? []).map((b: any) => ({
    id: b.id,
    nombre_completo: b.nombre_completo,
  }));

  return (
    <AvisosClient
      inicial={avisos}
      cargaError={avisosError ? "No pudimos cargar los avisos. Volvé a intentar." : null}
      activos={activos}
      sessionId={session.bombero_id}
      esOficial={isOficial(session.cargo)}
    />
  );
}
