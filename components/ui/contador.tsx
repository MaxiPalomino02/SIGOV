import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tono = "ink" | "fire" | "ok" | "alarm" | "brass";

const TONOS: Record<Tono, string> = {
  ink: "text-label",
  fire: "text-red",
  ok: "text-green-ink",
  alarm: "text-yellow-ink",
  brass: "text-yellow-ink",
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
    <div className={`flex items-center gap-3 rounded-[16px] bg-surface px-4 py-3 ${className}`}>
      {Icono ? (
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-surface-2 ${TONOS[tono]}`}>
          <Icono size={22} strokeWidth={1.75} aria-hidden />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className={`num text-[34px] font-bold leading-none tracking-[-0.4px] ${TONOS[tono]}`}>
          {valor}
        </p>
        <p className="mt-1 text-[13px] text-label-2">{etiqueta}</p>
      </div>
    </div>
  );
}
