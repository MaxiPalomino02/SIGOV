import { EscudoCuartel, IsotipoSigov } from "@/components/marca";
import { CUARTEL } from "@/lib/cuartel.config";
import { PRODUCTO } from "@/lib/marca";

export function PieInstitucional({
  className = "",
}: {
  className?: string;
}) {
  return (
    <footer className={`border-t-2 border-fire ${className}`}>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <IsotipoSigov size={30} alt="" />
          <div className="min-w-0">
            <p className="heading-display text-lg leading-none tracking-[0.18em] text-ink">
              {PRODUCTO.nombre}
            </p>
            <p className="mt-1 font-mono text-[13px] uppercase leading-relaxed tracking-[0.12em] text-ink-muted">
              {PRODUCTO.nombreCompleto}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:justify-end md:text-right">
          <EscudoCuartel nombre={CUARTEL.nombre} size={30} />
          <div>
            <p className="text-[13px] font-semibold text-ink">
              {CUARTEL.nombre}
            </p>
            <p className="font-mono text-[13px] uppercase tracking-[0.12em] text-ink-muted">
              {CUARTEL.localidad} · {CUARTEL.provincia}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-line/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-ink-muted">
            {PRODUCTO.nombre} · {CUARTEL.nombre} · {CUARTEL.provincia}, Argentina
          </p>
          <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-ink-secondary">
            Versión institucional
          </p>
        </div>
      </div>
    </footer>
  );
}
