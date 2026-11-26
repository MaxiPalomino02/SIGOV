"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarRange, FileDown, Printer } from "lucide-react";
import { EncabezadoIsla } from "@/components/encabezado-isla";

type Props = {
  titulo: string;
  subtitulo: string;
  estado: string;
  desde: string;
  hasta: string;
};

export function AccionesReportes({ titulo, subtitulo, estado, desde, hasta }: Props) {
  const [accion, setAccion] = useState<"pdf" | "impresion" | null>(null);
  const limpiarRef = useRef<(() => void) | null>(null);

  useEffect(() => () => limpiarRef.current?.(), []);

  function imprimir(tipo: "pdf" | "impresion") {
    limpiarRef.current?.();
    setAccion(tipo);

    const tituloAnterior = document.title;
    document.title = `reportes-${desde}-a-${hasta}`;

    const limpiar = () => {
      document.title = tituloAnterior;
      setAccion(null);
      window.removeEventListener("afterprint", limpiar);
      limpiarRef.current = null;
    };

    limpiarRef.current = limpiar;
    window.addEventListener("afterprint", limpiar);
    window.setTimeout(() => window.print(), 60);
  }

  return (
    <>
      <EncabezadoIsla
        titulo={titulo}
        subtitulo={subtitulo}
        icono={CalendarRange}
        estado={{ tono: "neutro", texto: estado }}
        acciones={[
          { icono: FileDown, etiqueta: "Exportar PDF", onClick: () => imprimir("pdf"), principal: true },
          { icono: Printer, etiqueta: "Imprimir", onClick: () => imprimir("impresion") },
        ]}
      />
      <span aria-live="polite" className="sr-only">
        {accion === "pdf"
          ? "Preparando el PDF del reporte."
          : accion === "impresion"
            ? "Preparando la impresión del reporte."
            : ""}
      </span>
    </>
  );
}
