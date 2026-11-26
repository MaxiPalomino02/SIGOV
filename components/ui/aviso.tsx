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
    contenedor: "border-separator bg-surface-2 text-label",
    icono: Info,
    iconoClase: "text-label-2",
  },
  ok: {
    contenedor: "border-green bg-green-tint text-label",
    icono: CircleCheckBig,
    iconoClase: "text-green-ink",
  },
  alerta: {
    contenedor: "border-red bg-red-tint text-label",
    icono: TriangleAlert,
    iconoClase: "text-red",
  },
  error: {
    contenedor: "border-red bg-red-tint text-label",
    icono: CircleX,
    iconoClase: "text-red",
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
      className={`flex items-start gap-3 rounded-[16px] border-l px-4 py-3 ${contenedor} ${className}`}
    >
      <Icono className={`mt-0.5 h-5 w-5 shrink-0 ${iconoClase}`} aria-hidden />
      <div className="min-w-0">
        {titulo ? (
          <p className="text-[17px] font-semibold text-label">{titulo}</p>
        ) : null}
        {children ? (
          <div
            className={`text-[17px] leading-relaxed text-label-2 ${
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
