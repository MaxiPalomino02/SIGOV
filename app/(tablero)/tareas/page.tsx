import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import { getSession } from "@/lib/session";
import { isOficial } from "@/lib/cargos";
import { PRODUCTO } from "@/lib/marca";
import { TareasClient, type TareaVista, type BomberoOpcion } from "./tareas-client";

export const metadata: Metadata = {
  title: `Tareas | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

export default async function TareasPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = createSupabaseClient();

  const { data: tareasData, error: tareasError } = await supabase
    .from("tareas")
    .select(
      "id, titulo, descripcion, asignada_a, creada_por, estado, completada_por, completada_en, creada_en, asignada:bomberos!tareas_asignada_a_fkey(nombre_completo), completador:bomberos!tareas_completada_por_fkey(nombre_completo)"
    )
    .order("creada_en", { ascending: false });

  const { data: bomberosData } = await supabase
    .from("bomberos")
    .select("id, nombre_completo")
    .eq("activo", true)
    .order("nombre_completo", { ascending: true });

  const tareas: TareaVista[] = (tareasData ?? []).map((t: any) => ({
    id: t.id,
    titulo: t.titulo,
    descripcion: t.descripcion,
    asignada_a: t.asignada_a,
    asignada_nombre: t.asignada?.nombre_completo ?? null,
    creada_por: t.creada_por,
    estado: t.estado,
    completada_por: t.completada_por,
    completada_nombre: t.completador?.nombre_completo ?? null,
    completada_en: t.completada_en,
    creada_en: t.creada_en,
  }));

  const bomberos: BomberoOpcion[] = (bomberosData ?? []).map((b: any) => ({
    id: b.id,
    nombre_completo: b.nombre_completo,
  }));

  return (
    <TareasClient
      inicial={tareas}
      cargaError={tareasError ? "No pudimos cargar las tareas. Volvé a intentar." : null}
      bomberos={bomberos}
      sessionId={session.bombero_id}
      esOficial={isOficial(session.cargo)}
    />
  );
}
