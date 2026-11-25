import Link from "next/link";
import { WifiOff } from "lucide-react";
import type { Metadata } from "next";
import { PRODUCTO } from "@/lib/marca";

export const metadata: Metadata = {
  title: `Sin conexión | ${PRODUCTO.nombre}`,
};

export default function PaginaSinConexion() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-bg-subtle">
            <WifiOff aria-hidden="true" className="size-5 text-alarm" />
          </span>
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              {PRODUCTO.nombre}
            </p>
            <h1 className="heading-display text-2xl leading-tight text-ink">
              Sin conexión
            </h1>
          </div>
        </div>

        <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
          No pudimos cargar esta pantalla porque no hay conexión. Revisá tu señal
          y volvé a intentar.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
          Las acciones que quedaron pendientes se sincronizan solas cuando
          vuelva la conexión.
        </p>

        <Link
          href="/inicio"
          className="mt-6 flex min-h-11 items-center justify-center rounded-xl bg-fire px-4 py-3 text-[16px] font-semibold text-ink transition-colors hover:bg-fire-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
