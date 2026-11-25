"use client";

import { useEffect, useState, type ReactNode } from "react";

type PageHeaderProps = {
  titulo: string;
  subtitulo?: string;
  acciones?: ReactNode;
  className?: string;
};

export function PageHeader({
  titulo,
  subtitulo,
  acciones,
  className = "",
}: PageHeaderProps) {
  const [compacto, setCompacto] = useState(false);

  useEffect(() => {
    const actualizar = () => {
      const y = window.scrollY;
      setCompacto((prev) => {
        if (prev) return y < 24 ? false : prev;
        return y > 140 ? true : prev;
      });
    };
    actualizar();
    window.addEventListener("scroll", actualizar, { passive: true });
    return () => window.removeEventListener("scroll", actualizar);
  }, []);

  return (
    <header className={`no-print glass sticky top-0 z-30 border-b border-separator ${className}`}>
      <div className="mx-auto w-full max-w-[1100px] px-4 lg:px-8">
        <div className="relative flex h-14 items-center gap-3">
          <span className="hidden h-6 w-6 shrink-0 lg:block" aria-hidden />
          <span
            className={`pointer-events-none absolute left-1/2 max-w-[60%] -translate-x-1/2 truncate text-center text-[17px] font-semibold text-label transition-opacity duration-200 ${
              compacto ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!compacto}
          >
            {titulo}
          </span>
          {acciones ? (
            <div className="ml-auto flex shrink-0 items-center gap-2 pr-28 lg:pr-0">{acciones}</div>
          ) : (
            <span className="ml-auto block h-6 w-6 shrink-0 lg:w-0" aria-hidden />
          )}
        </div>

        <div
          className={`overflow-hidden transition-all duration-200 ${
            compacto ? "max-h-0 opacity-0" : "max-h-40 pb-5 opacity-100"
          }`}
          aria-hidden={compacto}
        >
          <h1 className="text-[34px] font-bold tracking-[-.4px] text-label">{titulo}</h1>
          {subtitulo ? <p className="mt-1 text-[15px] text-label-2">{subtitulo}</p> : null}
        </div>
      </div>
    </header>
  );
}
