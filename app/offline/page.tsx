import Link from "next/link";
import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import { PRODUCTO } from "@/lib/marca";

export const metadata: Metadata = {
  title: `Sin conexión | ${PRODUCTO.nombre}`,
};

export default function PaginaSinConexion() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-6 py-10">
      <div className="w-full max-w-[400px] text-center">
        <CloudOff size={56} strokeWidth={1.75} className="mx-auto text-label-3" aria-hidden />
        <h1 className="mt-5 text-[22px] font-bold leading-tight text-label">Sin conexión</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-label-2">
          Podés ver lo último guardado y completar chequeos, tareas e incidentes.
          Cuando vuelva la conexión, se sincronizan solos.
        </p>
        <Link
          href="/inicio"
          className="tap mt-7 inline-flex h-14 w-full items-center justify-center rounded-[14px] bg-red px-6 text-[17px] font-semibold text-surface transition-colors hover:bg-red-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
        >
          Reintentar
        </Link>
      </div>
    </main>
  );
}
