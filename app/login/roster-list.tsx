import { ChevronDown } from "lucide-react";

export type RosterBombero = {
  numero_ingreso: number;
  nombre_completo: string;
};

function formatLegajo(numero: number) {
  return String(numero).padStart(3, "0");
}

export function RosterList({ bomberos }: { bomberos: RosterBombero[] }) {
  return (
    <details className="group overflow-hidden rounded-xl border border-line bg-bg/60">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-ink-muted transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em]">
          ¿No recordás tu legajo?
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="border-t border-line">
        <p className="px-4 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Padrón de bomberos activos
        </p>

        {bomberos.length > 0 ? (
          <ul className="max-h-56 divide-y divide-line/70 overflow-y-auto pb-2">
            {bomberos.map((bombero) => (
              <li
                key={bombero.numero_ingreso}
                className="flex items-center justify-between gap-4 px-4 py-2 transition-colors hover:bg-surface-hover"
              >
                <span className="min-w-0 text-[14px] font-medium leading-tight text-ink">
                  {bombero.nombre_completo}
                </span>
                <span className="shrink-0 font-mono text-[13px] font-bold text-fire-soft">
                  N° {formatLegajo(bombero.numero_ingreso)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 pb-4 pt-2 text-[14px] text-ink-muted">
            No hay bomberos activos cargados en el padrón.
          </p>
        )}
      </div>
    </details>
  );
}
