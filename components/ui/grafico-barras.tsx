type Tono = "red" | "yellow" | "green" | "ink";

type Barra = {
  etiqueta: string;
  valor: number;
  tono?: Tono;
};

type Props = {
  titulo: string;
  datos: Barra[];
  unidad?: string;
};

const TONOS: Record<Tono, string> = {
  red: "text-red",
  yellow: "text-yellow-ink",
  green: "text-green-ink",
  ink: "text-label-2",
};

function acortar(texto: string): string {
  return texto.length > 15 ? `${texto.slice(0, 14)}…` : texto;
}

export function GraficoBarras({ titulo, datos, unidad = "" }: Props) {
  if (datos.length === 0) return null;

  const ancho = 720;
  const alto = 280;
  const izquierda = 52;
  const derecha = 16;
  const arriba = 18;
  const abajo = 58;
  const interiorAncho = ancho - izquierda - derecha;
  const interiorAlto = alto - arriba - abajo;
  const maximo = Math.max(1, ...datos.map((dato) => dato.valor));
  const celda = interiorAncho / datos.length;
  const anchoBarra = Math.min(46, Math.max(10, celda * 0.58));

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
        {datos.map((dato, indice) => {
          const altura = (dato.valor / maximo) * interiorAlto;
          const x = izquierda + indice * celda + (celda - anchoBarra) / 2;
          const y = arriba + interiorAlto - altura;
          return (
            <g key={`${dato.etiqueta}-${indice}`} className={TONOS[dato.tono ?? "red"]}>
              <rect
                x={x}
                y={y}
                width={anchoBarra}
                height={Math.max(dato.valor === 0 ? 2 : 4, altura)}
                rx={4}
                fill="currentColor"
              />
              <text
                x={x + anchoBarra / 2}
                y={Math.max(arriba + 12, y - 7)}
                textAnchor="middle"
                fontSize={12}
                className="num fill-current font-semibold"
              >
                {dato.valor}
                {unidad}
              </text>
              <text
                x={x + anchoBarra / 2}
                y={alto - abajo + 22}
                textAnchor="middle"
                fontSize={13}
                className="fill-current text-label-2"
              >
                {acortar(dato.etiqueta)}
              </text>
            </g>
          );
        })}
        <line
          x1={izquierda}
          x2={ancho - derecha}
          y1={arriba + interiorAlto}
          y2={arriba + interiorAlto}
          stroke="currentColor"
          strokeWidth={1}
          className="text-separator"
        />
      </svg>
      <figcaption className="sr-only">{titulo}</figcaption>
      <details className="no-print mt-3">
        <summary className="min-h-11 cursor-pointer text-[15px] font-semibold text-label">
          Ver datos en tabla
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-separator text-label-2">
                <th scope="col" className="px-2 py-2">Categoría</th>
                <th scope="col" className="px-2 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((dato, indice) => (
                <tr key={`${dato.etiqueta}-${indice}`} className="border-b border-separator">
                  <th scope="row" className="px-2 py-2 font-normal text-label">{dato.etiqueta}</th>
                  <td className="px-2 py-2 text-right tabular-nums text-label">
                    {dato.valor}
                    {unidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
