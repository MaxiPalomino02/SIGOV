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
              className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-[14px] font-semibold transition-colors ${
                activo
                  ? "border-fire bg-fire/15 text-ink"
                  : hecho
                    ? "border-brass/50 bg-brass/10 text-brass hover:bg-brass/15"
                    : "border-line bg-surface text-ink-muted"
              } ${hecho ? "cursor-pointer" : "cursor-default"}`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                  activo
                    ? "bg-fire text-ink"
                    : hecho
                      ? "bg-brass text-bg"
                      : "bg-bg-subtle text-ink-muted"
                }`}
              >
                {hecho ? <Check className="h-3 w-3" aria-hidden /> : p.n}
              </span>
              {p.label}
            </button>
            {index < pasos.length - 1 ? (
              <span aria-hidden className="h-px w-4 bg-line" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
