import type { ReactNode } from "react";

type TonoChip = "rojo" | "amarillo" | "verde" | "gris";

type ChipProps = {
  children: ReactNode;
  tono?: TonoChip;
  className?: string;
};

const TONOS: Record<TonoChip, string> = {
  rojo: "bg-red-tint text-red",
  amarillo: "bg-yellow text-label",
  verde: "bg-green-tint text-green-ink",
  gris: "bg-surface-2 text-label-2",
};

export function Chip({ children, tono = "gris", className = "" }: ChipProps) {
  return (
    <span className={`inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium ${TONOS[tono]} ${className}`}>
      {children}
    </span>
  );
}
