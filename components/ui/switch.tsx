type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  etiqueta: string;
  descripcion?: string;
  disabled?: boolean;
  className?: string;
};

export function Switch({
  checked,
  onChange,
  etiqueta,
  descripcion,
  disabled = false,
  className = "",
}: SwitchProps) {
  return (
    <div className={`fila flex min-h-11 items-center justify-between gap-4 px-4 py-2 ${className}`}>
      <div className="min-w-0">
        <p className="text-[17px] font-medium text-label">{etiqueta}</p>
        {descripcion ? <p className="mt-0.5 text-[15px] text-label-2">{descripcion}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={etiqueta}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`tap relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red disabled:opacity-50 ${
          checked ? "bg-red" : "bg-separator"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-transform duration-200 ease-[cubic-bezier(.2,.8,.2,1)] ${
            checked ? "translate-x-[22px]" : "translate-x-[2px]"
          }`}
        />
      </button>
    </div>
  );
}
