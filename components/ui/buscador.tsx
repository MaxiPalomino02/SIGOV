import { Search } from "lucide-react";

type BuscadorProps = {
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  etiqueta: string;
  className?: string;
};

export function Buscador({
  value,
  onChange,
  placeholder = "Buscar",
  etiqueta,
  className = "",
}: BuscadorProps) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={22}
        strokeWidth={1.75}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-label-3"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(evento) => onChange(evento.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta}
        className="min-h-[50px] w-full rounded-full bg-surface-2 pl-12 pr-4 text-[17px] text-label placeholder:text-label-3 focus:outline-2 focus:outline-offset-2 focus:outline-red"
      />
    </div>
  );
}
