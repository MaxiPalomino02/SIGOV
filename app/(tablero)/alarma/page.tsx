import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { isOficial } from "@/lib/cargos";
import { createSupabaseClient } from "@/lib/supabase";
import { PRODUCTO } from "@/lib/marca";
import {
  AlarmaClient,
  type AlarmaActivaVista,
  type RespuestaVista,
  type AlarmaHistorial,
  type BomberoActivo,
} from "./alarma-client";

export const metadata: Metadata = {
  title: `Alarma | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

export default async function AlarmaPage() {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) redirect("/inicio");

  const supabase = createSupabaseClient();

  const { data: activaData } = await supabase
    .from("alarmas")
    .select("id, tipo, detalle, es_simulacro, activada_en, activa")
    .eq("activa", true)
    .order("activada_en", { ascending: false })
    .limit(1);

  const row = (activaData ?? [])[0] as any;
  const expirada = row ? Date.now() - new Date(row.activada_en).getTime() > 6 * 60 * 60 * 1000 : false;
  const activa: AlarmaActivaVista = row && !expirada
    ? { id: row.id, tipo: row.tipo, detalle: row.detalle, es_simulacro: !!row.es_simulacro, activada_en: row.activada_en, activa: true }
    : null;

  let respuestas: RespuestaVista[] = [];
  if (activa) {
    const { data: resp } = await supabase
      .from("alarma_respuestas")
      .select("alarma_id, bombero_id, respuesta, respondido_en, bombero:bomberos(nombre_completo)")
      .eq("alarma_id", activa.id);
    respuestas = (resp ?? []).map((r: any) => ({
      bombero_id: r.bombero_id,
      nombre: r.bombero?.nombre_completo ?? "Bombero",
      respuesta: r.respuesta,
      respondido_en: r.respondido_en,
    }));
  }

  const { data: hist } = await supabase
    .from("alarmas")
    .select("id, tipo, detalle, es_simulacro, activada_en, activa, cerrada_en")
    .order("activada_en", { ascending: false })
    .limit(10);

  const { data: activosData } = await supabase
    .from("bomberos")
    .select("id, nombre_completo")
    .eq("activo", true)
    .order("nombre_completo", { ascending: true });

  return (
    <AlarmaClient
      activaInicial={activa}
      respuestasInicial={respuestas}
      ultimasInicial={(hist ?? []) as AlarmaHistorial[]}
      activos={(activosData ?? []) as BomberoActivo[]}
    />
  );
}
