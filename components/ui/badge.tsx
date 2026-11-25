import { type Cargo, CARGOS, isCargo } from "@/lib/cargos";

export { type Cargo, CARGOS, isCargo };

type BadgeProps = {
  cargo: Cargo;
  className?: string;
};

const toneClasses: Record<Cargo, string> = {
  "Oficial Principal": "border-fire/50 bg-fire/15 text-fire-soft font-bold",
  "Oficial Ayudante": "border-ink/40 bg-ink/10 text-ink font-semibold",
  Cabo: "border-brass/40 bg-brass/10 text-brass font-bold",
  Bombero: "border-line bg-surface-hover text-ink-muted",
  Aspirante: "border-line bg-bg-subtle text-ink-muted",
};

export function Badge({ cargo, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold leading-tight tracking-wide ${toneClasses[cargo]} ${className}`}
    >
      {cargo}
    </span>
  );
}
