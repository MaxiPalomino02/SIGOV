"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  desde: string;
  hasta: string;
};

export function AccionesReportes({ desde, hasta }: Props) {
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
    <div className="no-print flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        onClick={() => imprimir("pdf")}
        disabled={accion !== null}
        aria-label="Exportar reporte a PDF"
      >
        <FileDown className="h-4 w-4" aria-hidden />
        Exportar PDF
      </Button>
      <Button
        variant="secondary"
        onClick={() => imprimir("impresion")}
        disabled={accion !== null}
        aria-label="Imprimir reporte"
      >
        <Printer className="h-4 w-4" aria-hidden />
        Imprimir
      </Button>
      <span aria-live="polite" className="sr-only">
        {accion === "pdf"
          ? "Preparando el PDF del reporte."
          : accion === "impresion"
            ? "Preparando la impresión del reporte."
            : ""}
      </span>
    </div>
  );
}
