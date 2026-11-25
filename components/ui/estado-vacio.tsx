"use client";

import Link from "next/link";
import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type EstadoVacioAccion = {
  label: string;
  onClick?: () => void;
  href?: string;
};

type EstadoVacioProps = {
  icono: string;
  titulo: string;
  texto?: string;
  accion?: EstadoVacioAccion;
  className?: string;
};

export function EstadoVacio({
  icono,
  titulo,
  texto,
  accion,
  className = "",
}: EstadoVacioProps) {
  const ICONOS = Lucide as unknown as Record<string, LucideIcon>;
  const Icono = ICONOS[icono] ?? ICONOS.AlertTriangle;
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-10 text-center ${className}`}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-fire/10 text-fire-soft ring-1 ring-fire/25">
        <Icono className="h-7 w-7" aria-hidden />
      </span>
      <h3 className="heading-display mt-4 text-xl text-ink">{titulo}</h3>
      {texto ? (
        <p className="mt-2 max-w-md text-[16px] leading-relaxed text-ink-muted">{texto}</p>
      ) : null}
      {accion ? (
        accion.href ? (
          <Link
            href={accion.href}
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-fire px-5 text-[15px] font-semibold text-ink shadow-[0_0_18px_rgba(198,40,40,0.22)] transition-colors hover:bg-fire-dark"
          >
            {accion.label}
          </Link>
        ) : (
          <Button className="mt-5" onClick={accion.onClick}>
            {accion.label}
          </Button>
        )
      ) : null}
    </div>
  );
}
