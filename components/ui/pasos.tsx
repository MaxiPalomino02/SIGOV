"use client";

import { Check } from "lucide-react";

export type PasoItem = {
  n: number;
  label: string;
};

type Props = {
  pasos: PasoItem[];
  paso: number;
  onIr: (paso: number) => void;
  ariaLabel?: string;
};

export function Pasos({
  pasos,
  paso,
  onIr,
  ariaLabel = "Pasos del registro",
}: Props) {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label={ariaLabel}>
      {pasos.map((p, index) => {
        const activo = paso === p.n;
        const hecho = paso > p.n;
        return (
          <li key={p.n} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (hecho ? onIr(p.n) : undefined)}
              aria-current={activo ? "step" : undefined}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-[15px] font-semibold transition-colors ${
                activo
                  ? "border-red bg-red-tint text-label"
                  : hecho
                    ? "border-yellow bg-yellow-tint text-yellow-ink hover:bg-yellow-tint"
                    : "border-separator bg-surface text-label-2"
              } ${hecho ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`num flex h-5 w-5 items-center justify-center rounded-full text-[12px] ${
                  activo
                  ? "bg-red text-surface"
                  : hecho
                    ? "bg-yellow text-label"
                      : "bg-surface-2 text-label-2"
                }`}
              >
                {hecho ? <Check className="h-3 w-3" aria-hidden /> : p.n}
              </span>
              {p.label}
            </button>
            {index < pasos.length - 1 ? (
              <span aria-hidden className="h-px w-4 bg-separator" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
