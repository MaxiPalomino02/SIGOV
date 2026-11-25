type AnilloProgresoProps = {
  valor: number;
  etiqueta?: string;
  tamano?: number;
  className?: string;
};

export function AnilloProgreso({
  valor,
  etiqueta,
  tamano = 96,
  className = "",
}: AnilloProgresoProps) {
  const porcentaje = Math.min(100, Math.max(0, valor));
  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  const desplazamiento = circunferencia * (1 - porcentaje / 100);

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <svg
        width={tamano}
        height={tamano}
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${porcentaje}%`}
      >
        <circle
          cx="50"
          cy="50"
          r={radio}
          fill="none"
          stroke="var(--color-separator)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={radio}
          fill="none"
          stroke="var(--color-red)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={desplazamiento}
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y="54"
          textAnchor="middle"
          dominantBaseline="middle"
          className="num fill-label text-[20px] font-bold"
        >
          {porcentaje}%
        </text>
      </svg>
      {etiqueta ? <span className="text-[13px] text-label-2">{etiqueta}</span> : null}
    </div>
  );
}
