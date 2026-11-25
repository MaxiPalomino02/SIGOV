import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionActiva } from "@/lib/session-db";
import { createSupabaseClient } from "@/lib/supabase";
import { isOficial } from "@/lib/cargos";
import { Admin } from "./admin";

export const metadata: Metadata = {
  title: "Administración · SIGOV",
};

export const dynamic = "force-dynamic";

export type RosterBombero = {
  id: string;
  numero_ingreso: number;
  nombre_completo: string;
  cargo: string;
};

export default async function AdminPage() {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) redirect("/guardias");

  const { data } = await createSupabaseClient()
    .from("bomberos")
    .select("id, numero_ingreso, nombre_completo, cargo")
    .eq("activo", true)
    .order("numero_ingreso", { ascending: true });

  const bomberos: RosterBombero[] = [];
  for (const b of data ?? []) {
    if (
      typeof b.id === "string" &&
      typeof b.numero_ingreso === "number" &&
      typeof b.nombre_completo === "string" &&
      typeof b.cargo === "string"
    ) {
      bomberos.push({
        id: b.id,
        numero_ingreso: b.numero_ingreso,
        nombre_completo: b.nombre_completo,
        cargo: b.cargo,
      });
    }
  }

  return <Admin bomberos={bomberos} />;
}
