type OpcionSegmentado = {
  valor: string;
  etiqueta: string;
};

type SegmentadoProps = {
  opciones: readonly OpcionSegmentado[];
  valor: string;
  onChange: (valor: string) => void;
  etiqueta: string;
  className?: string;
};

export function Segmentado({
  opciones,
  valor,
  onChange,
  etiqueta,
  className = "",
}: SegmentadoProps) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={`flex min-h-[50px] items-center gap-1 rounded-[14px] bg-surface-2 p-1 ${className}`}
    >
      {opciones.map((opcion) => {
        const activo = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(opcion.valor)}
            className={`tap min-h-11 flex-1 rounded-[11px] px-3 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
              activo ? "bg-surface text-label shadow-[0_1px_2px_rgba(0,0,0,.04)]" : "text-label-2"
            }`}
          >
            {opcion.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
