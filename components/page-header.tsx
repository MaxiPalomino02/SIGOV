import type { ReactNode } from "react";

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
  return (
    <div
      className={`mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="heading-display text-2xl text-ink sm:text-3xl">{titulo}</h1>
          {subtitulo ? (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-ink-muted sm:text-[12px]">
              {subtitulo}
            </p>
          ) : null}
        </div>
        {acciones ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
            {acciones}
          </div>
        ) : null}
      </div>
    </div>
  );
}
