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
  const Icono = ICONOS[icono] ?? ICONOS.CircleHelp;
  const frase = texto ?? titulo;

  return (
    <div className={`flex flex-col items-center justify-center rounded-[16px] bg-surface px-6 py-10 text-center ${className}`}>
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-[16px] bg-surface-2 text-label-2">
        <Icono size={22} strokeWidth={1.75} aria-hidden />
      </span>
      <p className="max-w-md text-[17px] leading-relaxed text-label-2">{frase}</p>
      {accion ? (
        accion.href ? (
          <Link
            href={accion.href}
            className="tap mt-5 inline-flex min-h-[50px] items-center justify-center rounded-[14px] bg-red px-5 text-[17px] font-semibold text-surface transition-colors hover:bg-red-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
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
