import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tono = "ink" | "fire" | "ok" | "alarm" | "brass";

const TONOS: Record<Tono, string> = {
  ink: "text-ink",
  fire: "text-fire-soft",
  ok: "text-ok",
  alarm: "text-alarm",
  brass: "text-brass",
};

type ContadorProps = {
  valor: number | string;
  etiqueta: string;
  tono?: Tono;
  icono?: string;
  className?: string;
};

export function Contador({
  valor,
  etiqueta,
  tono = "ink",
  icono,
  className = "",
}: ContadorProps) {
  const ICONOS = Lucide as unknown as Record<string, LucideIcon>;
  const Icono = icono ? ICONOS[icono] : undefined;
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-[0_1px_0_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.16)] ${className}`}
    >
      {Icono ? (
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-hover ${TONOS[tono]}`}
        >
          <Icono className="h-5 w-5" aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className={`heading-display text-3xl leading-none tabular-nums ${TONOS[tono]}`}>
          {valor}
        </p>
        <p className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
          {etiqueta}
        </p>
      </div>
    </div>
  );
}
