import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isOficial } from "@/lib/cargos";
import { PRODUCTO } from "@/lib/marca";
import { EquiposClient } from "./equipos-client";

export const metadata: Metadata = {
  title: `Equipamiento | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

export default async function EquipamientoPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <EquiposClient oficial={isOficial(session.cargo)} />
    </div>
  );
}
