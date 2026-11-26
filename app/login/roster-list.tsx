"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Buscador } from "@/components/ui/buscador";
import { Grupo } from "@/components/ui/grupo";

export type RosterBombero = {
  numero_ingreso: number;
  nombre_completo: string;
};

function formatLegajo(numero: number) {
  return String(numero).padStart(3, "0");
}

export function RosterList({
  bomberos,
  onSeleccionar,
}: {
  bomberos: RosterBombero[];
  onSeleccionar: (legajo: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const listaId = useId();

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase("es-AR");
    if (!texto) return bomberos;
    return bomberos.filter(
      (bombero) =>
        bombero.nombre_completo.toLocaleLowerCase("es-AR").includes(texto) ||
        formatLegajo(bombero.numero_ingreso).includes(texto)
    );
  }, [bomberos, busqueda]);

  return (
    <div>
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={listaId}
        onClick={() => setAbierto((valor) => !valor)}
        className="tap flex min-h-11 w-full items-center justify-between gap-3 rounded-[14px] bg-surface-2 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
      >
        <span className="text-[15px] font-medium text-label">Ver padrón</span>
        <ChevronDown
          size={22}
          strokeWidth={1.75}
          className={`shrink-0 text-label-2 transition-transform duration-200 ${
            abierto ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {abierto ? (
        <div id={listaId} className="mt-3 text-left">
          <Buscador
            value={busqueda}
            onChange={setBusqueda}
            placeholder="Buscar por nombre o legajo"
            etiqueta="Buscar en el padrón"
          />
          <Grupo titulo="Padrón de bomberos activos" className="mt-3">
            {filtrados.length > 0 ? (
              filtrados.map((bombero) => (
                <button
                  key={bombero.numero_ingreso}
                  type="button"
                  onClick={() => {
                    onSeleccionar(formatLegajo(bombero.numero_ingreso));
                    setAbierto(false);
                  }}
                  className="fila tap flex w-full items-center justify-between gap-4 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red"
                >
                  <span className="min-w-0 text-[15px] font-medium leading-snug text-label">
                    {bombero.nombre_completo}
                  </span>
                  <span className="num shrink-0 text-[15px] text-label-2">
                    N° {formatLegajo(bombero.numero_ingreso)}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-4 py-4 text-[15px] text-label-2">
                {bomberos.length > 0
                  ? "No hay bomberos que coincidan con la búsqueda."
                  : "No hay bomberos activos cargados en el padrón."}
              </p>
            )}
          </Grupo>
        </div>
      ) : null}
    </div>
  );
}
