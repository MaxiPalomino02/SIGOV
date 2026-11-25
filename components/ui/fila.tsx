import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

type FilaProps = {
  titulo: string;
  subtitulo?: string;
  valor?: ReactNode;
  icono?: LucideIcon;
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
};

export function Fila(props: FilaProps) {
  const { titulo, subtitulo, valor, icono: Icono, onClick, chevron, className } = props;
  const mostrarChevron = chevron ?? Boolean(onClick);
  const clase = className ?? "";
  const contenido = (
    <>
      {Icono ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center text-label-2">
          <Icono size={22} strokeWidth={1.75} aria-hidden />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-medium text-label">{titulo}</span>
        {subtitulo ? <span className="mt-0.5 block text-[15px] text-label-2">{subtitulo}</span> : null}
      </span>
      {valor ? <span className="num shrink-0 text-[17px] text-label-2">{valor}</span> : null}
      {mostrarChevron ? (
        <ChevronRight size={22} strokeWidth={1.75} className="shrink-0 text-label-3" aria-hidden />
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`fila tap flex w-full items-center gap-3 px-4 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-red ${clase}`}
      >
        {contenido}
      </button>
    );
  }

  return <div className={`fila flex items-center gap-3 px-4 py-2 ${clase}`}>{contenido}</div>;
}
