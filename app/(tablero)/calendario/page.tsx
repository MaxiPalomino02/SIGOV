import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isOficial } from "@/lib/cargos";
import { CalendarioClient } from "./calendario-client";

export const metadata: Metadata = {
  title: "Calendario de eventos · SIGOV",
};

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const oficial = isOficial(session.cargo);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <CalendarioClient oficial={oficial} />
    </div>
  );
}