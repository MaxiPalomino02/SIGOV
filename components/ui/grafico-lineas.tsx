type Tono = "red" | "yellow" | "green" | "ink";

type Punto = { etiqueta: string; valor: number };

type Serie = {
  nombre: string;
  puntos: Punto[];
  tono?: Tono;
};

type Props = {
  titulo: string;
  series: Serie[];
  unidad?: string;
};

const TONOS: Record<Tono, string> = {
  red: "text-red",
  yellow: "text-yellow-ink",
  green: "text-green-ink",
  ink: "text-label-2",
};

function acortar(texto: string): string {
  return texto.length > 12 ? `${texto.slice(0, 11)}…` : texto;
}

export function GraficoLineas({ titulo, series, unidad = "" }: Props) {
  const activas = series.filter((serie) => serie.puntos.length > 0);
  if (activas.length === 0) return null;

  const ancho = 720;
  const alto = 280;
  const izquierda = 52;
  const derecha = 16;
  const arriba = 18;
  const abajo = 58;
  const interiorAncho = ancho - izquierda - derecha;
  const interiorAlto = alto - arriba - abajo;
  const cantidad = Math.max(...activas.map((serie) => serie.puntos.length));
  const valores = activas.flatMap((serie) => serie.puntos.map((punto) => punto.valor));
  const maximo = Math.max(1, ...valores);
  const denominador = cantidad > 1 ? cantidad - 1 : 1;
  const xDe = (indice: number) =>
    izquierda +
    (cantidad === 1 ? interiorAncho / 2 : (indice * interiorAncho) / denominador);
  const yDe = (valor: number) =>
    arriba + interiorAlto - (valor / maximo) * interiorAlto;
  const etiquetas = activas[0].puntos.map((punto) => punto.etiqueta);

  return (
    <figure>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${ancho} ${alto}`}
        className="h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {[0, 0.5, 1].map((proporcion) => {
          const y = arriba + interiorAlto - interiorAlto * proporcion;
          return (
            <g key={proporcion}>
              <line
                x1={izquierda}
                x2={ancho - derecha}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeWidth={1}
                className="text-separator"
              />
              <text
                x={izquierda - 10}
                y={y + 4}
                textAnchor="end"
                fontSize={13}
                className="num fill-current text-label-2"
              >
                {Math.round(maximo * proporcion)}
              </text>
            </g>
          );
        })}
        {etiquetas.map((etiqueta, indice) => (
          <text
            key={`${etiqueta}-${indice}`}
            x={xDe(indice)}
            y={alto - abajo + 22}
            textAnchor="middle"
            fontSize={13}
            className="fill-current text-label-2"
          >
            {acortar(etiqueta)}
          </text>
        ))}
        {activas.map((serie) => {
          const puntos = serie.puntos
            .map((punto, indice) => `${xDe(indice)},${yDe(punto.valor)}`)
            .join(" ");
          return (
            <g
              key={serie.nombre}
              className={TONOS[serie.tono ?? "red"]}
              fill="currentColor"
              stroke="currentColor"
            >
              <polyline
                points={puntos}
                fill="none"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {serie.puntos.map((punto, indice) => (
                <circle
                  key={`${punto.etiqueta}-${indice}`}
                  cx={xDe(indice)}
                  cy={yDe(punto.valor)}
                  r={4}
                  strokeWidth={2}
                  className="fill-surface"
                />
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">{titulo}</figcaption>
      {activas.length > 1 ? (
        <ul className="no-print mt-2 flex flex-wrap gap-3 text-[13px] text-label-2">
          {activas.map((serie) => (
            <li key={serie.nombre} className="flex items-center gap-2">
              <span
                aria-hidden
                className={`inline-block h-2.5 w-2.5 rounded-full bg-current ${TONOS[serie.tono ?? "red"]}`}
              />
              {serie.nombre}
            </li>
          ))}
        </ul>
      ) : null}
      <details className="no-print mt-3">
        <summary className="min-h-11 cursor-pointer text-[15px] font-semibold text-label">
          Ver datos en tabla
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-separator text-label-2">
                <th scope="col" className="px-2 py-2">Período</th>
                {activas.map((serie) => (
                  <th key={serie.nombre} scope="col" className="px-2 py-2 text-right">
                    {serie.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {etiquetas.map((etiqueta, indice) => (
                <tr key={`${etiqueta}-${indice}`} className="border-b border-separator">
                  <th scope="row" className="px-2 py-2 font-normal text-label">{etiqueta}</th>
                  {activas.map((serie) => (
                    <td key={serie.nombre} className="px-2 py-2 text-right tabular-nums text-label">
                      {serie.puntos[indice]?.valor ?? 0}
                      {unidad}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
