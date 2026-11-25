import { type Cargo, CARGOS, isCargo } from "@/lib/cargos";

export { type Cargo, CARGOS, isCargo };

type BadgeProps = {
  cargo: Cargo;
  className?: string;
};

const toneClasses: Record<Cargo, string> = {
  "Oficial Principal": "bg-red-tint text-red",
  "Oficial Ayudante": "bg-surface-2 text-label-2",
  Cabo: "bg-yellow text-label",
  Bombero: "bg-green-tint text-green-ink",
  Aspirante: "bg-surface-2 text-label-2",
};

export function Badge({ cargo, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold leading-tight ${toneClasses[cargo]} ${className}`}
    >
      {cargo}
    </span>
  );
}
