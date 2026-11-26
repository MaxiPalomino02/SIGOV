"use client";

import type { ReactNode } from "react";
import { EncabezadoIsla } from "@/components/encabezado-isla";

type PageHeaderProps = {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
  className?: string;
};

export function PageHeader({ titulo, subtitulo, acciones, className = "" }: PageHeaderProps) {
  return (
    <EncabezadoIsla titulo={titulo} subtitulo={subtitulo} className={className}>
      {acciones}
    </EncabezadoIsla>
  );
}
