import type { ReactNode } from "react";

type GrupoProps = {
  titulo?: string;
  children: ReactNode;
  className?: string;
};

export function Grupo({ titulo, children, className = "" }: GrupoProps) {
  return (
    <section className={className}>
      {titulo ? (
        <h2 className="mb-2 px-1 text-[13px] font-medium tracking-[.3px] text-label-2 uppercase">
          {titulo}
        </h2>
      ) : null}
      <div className="grupo">{children}</div>
    </section>
  );
}
