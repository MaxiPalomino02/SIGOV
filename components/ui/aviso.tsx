import type { ReactNode } from "react";
import {
  CircleCheckBig,
  CircleX,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

export type AvisoVariante = "info" | "ok" | "alerta" | "error";

const ESTILOS: Record<
  AvisoVariante,
  { contenedor: string; icono: LucideIcon; iconoClase: string }
> = {
  info: {
    contenedor: "border-ink-muted/40 bg-bg-subtle text-ink",
    icono: Info,
    iconoClase: "text-ink-muted",
  },
  ok: {
    contenedor: "border-ok/60 bg-ok/10 text-ink",
    icono: CircleCheckBig,
    iconoClase: "text-ok",
  },
  alerta: {
    contenedor: "border-alarm/60 bg-alarm/10 text-ink",
    icono: TriangleAlert,
    iconoClase: "text-alarm",
  },
  error: {
    contenedor: "border-fire/60 bg-fire/10 text-ink",
    icono: CircleX,
    iconoClase: "text-fire-soft",
  },
};

type AvisoProps = {
  variante?: AvisoVariante;
  titulo?: string;
  children?: ReactNode;
  className?: string;
};

export function Aviso({
  variante = "info",
  titulo,
  children,
  className = "",
}: AvisoProps) {
  const { contenedor, icono: Icono, iconoClase } = ESTILOS[variante];

  return (
    <div
      role={variante === "error" ? "alert" : undefined}
      className={`flex items-start gap-3 rounded-xl border-l-4 px-4 py-3 ${contenedor} ${className}`}
    >
      <Icono className={`mt-0.5 h-5 w-5 shrink-0 ${iconoClase}`} aria-hidden />
      <div className="min-w-0">
        {titulo ? (
          <p className="heading-display text-sm tracking-wide text-ink">{titulo}</p>
        ) : null}
        {children ? (
          <div
            className={`text-[16px] leading-relaxed text-ink-muted ${
              titulo ? "mt-0.5" : ""
            }`}
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
