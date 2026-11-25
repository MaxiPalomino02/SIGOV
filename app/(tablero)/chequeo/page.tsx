import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isOficial } from "@/lib/cargos";
import { ChequeoClient } from "./ChequeoClient";

export const metadata: Metadata = {
  title: "Chequeo de unidades · SIGOV",
};

export const dynamic = "force-dynamic";

export default async function ChequeoPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const oficial = isOficial(session.cargo);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <ChequeoClient oficial={oficial} />
    </div>
  );
}