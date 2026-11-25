import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CalendarRange,
  ClipboardCheck,
  Clock3,
  FileText,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { AccionesReportes } from "@/components/reportes/acciones-reportes";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { GraficoBarras } from "@/components/ui/grafico-barras";
import { GraficoLineas } from "@/components/ui/grafico-lineas";
import { Input } from "@/components/ui/input";
import { QuickAction } from "@/components/ui/quick-action";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { isOficial } from "@/lib/cargos";
import { CUARTEL } from "@/lib/cuartel.config";
import { PRODUCTO } from "@/lib/marca";
import {
  etiquetaMes,
  etiquetaRango,
  formatearEntero,
  formatearPorcentaje,
  hayDatosReporte,
  rangoDesdeParametros,
  rangoPorDefecto,
} from "@/lib/reportes";
import { getSessionActiva } from "@/lib/session-db";
import { obtenerReporte } from "./actions";

export const metadata: Metadata = {
  title: `Reportes | ${PRODUCTO.nombre}`,
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type TonoGrafico = "fire" | "brass" | "alarm" | "ok" | "ink";

type ColumnaTabla = {
  titulo: string;
  clave: string;
  derecha?: boolean;
};

type FilaTabla = Record<string, string | number>;

const TONOS: TonoGrafico[] = ["fire", "brass", "alarm", "ok", "ink"];

function mesCorto(mes: string): string {
  return `${mes.slice(5)}/${mes.slice(2, 4)}`;
}

function TablaReporte({
  columnas,
  filas,
  compacta = false,
}: {
  columnas: ColumnaTabla[];
  filas: FilaTabla[];
  compacta?: boolean;
}) {
  return (
    <div className={compacta ? "" : "overflow-x-auto"}>
      <table
        className={
          compacta
            ? "planilla-tabla"
            : "w-full min-w-[520px] border-collapse text-left text-[14px]"
        }
      >
        <thead className={compacta ? "" : "border-b border-line text-ink-muted"}>
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna.clave}
                scope="col"
                className={
                  compacta
                    ? ""
                    : `px-2 py-2 font-mono text-[11px] uppercase tracking-widest ${
                        columna.derecha ? "text-right" : ""
                      }`
                }
              >
                {columna.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, indice) => (
            <tr
              key={`${fila[columnas[0].clave]}-${indice}`}
              className={compacta ? "" : "border-b border-line-subtle text-ink"}
            >
              {columnas.map((columna, indiceColumna) =>
                indiceColumna === 0 ? (
                  <th
                    key={columna.clave}
                    scope="row"
                    className={compacta ? "" : "px-2 py-2 font-semibold"}
                  >
                    {String(fila[columna.clave] ?? "")}
                  </th>
                ) : (
                  <td
                    key={columna.clave}
                    className={
                      compacta
                        ? ""
                        : `px-2 py-2 tabular-nums ${columna.derecha ? "text-right" : ""}`
                    }
                  >
                    {String(fila[columna.clave] ?? "")}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ReportesPage({ searchParams }: Props) {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) redirect("/inicio");

  const params = await searchParams;
  const resultadoRango = rangoDesdeParametros(params.desde, params.hasta);
  const rango = resultadoRango.ok
    ? resultadoRango.rango
    : rangoPorDefecto();

  const resultado = resultadoRango.ok
    ? await obtenerReporte(rango.desde, rango.hasta)
    : ({ ok: false as const, error: resultadoRango.error });

  const reporte = resultado.ok ? resultado.data : null;
  const sinDatos = reporte ? !hayDatosReporte(reporte) : false;
  const errorTexto = resultado.ok ? null : resultado.error;
  const resumen = reporte?.resumen ?? {
    incidentes: 0,
    horas_guardia: 0,
    cobertura_promedio: 0,
    fallas_chequeo: 0,
    tareas_cumplidas: 0,
    actividades_prevencion: 0,
  };

  const barrasTipos =
    reporte?.incidentes_por_tipo.map((dato, indice) => ({
      etiqueta: dato.etiqueta,
      valor: dato.total,
      tono: TONOS[indice % TONOS.length],
    })) ?? [];

  const serieIncidentesMes = reporte
    ? [
        {
          nombre: "Incidentes",
          puntos: reporte.incidentes_por_mes.map((dato) => ({
            etiqueta: mesCorto(dato.mes),
            valor: dato.total,
          })),
          tono: "fire" as const,
        },
      ]
    : [];

  const barrasCobertura =
    reporte?.cobertura_franjas.map((dato) => ({
      etiqueta: dato.franja,
      valor: dato.porcentaje,
      tono: (dato.porcentaje >= 80
        ? "ok"
        : dato.porcentaje >= 50
          ? "brass"
          : "fire") as TonoGrafico,
    })) ?? [];

  const serieFallas = reporte
    ? [
        {
          nombre: "Fallas",
          puntos: reporte.chequeos_fallas.map((dato) => ({
            etiqueta: mesCorto(dato.mes),
            valor: dato.fallas,
          })),
          tono: "alarm" as const,
        },
      ]
    : [];

  const serieTareas = reporte
    ? [
        {
          nombre: "Tareas",
          puntos: reporte.tareas_cumplidas.map((dato) => ({
            etiqueta: mesCorto(dato.mes),
            valor: dato.total,
          })),
          tono: "ok" as const,
        },
      ]
    : [];

  const seriesPrevencion = reporte
    ? [
        {
          nombre: "Charlas",
          puntos: reporte.prevencion.map((dato) => ({
            etiqueta: mesCorto(dato.mes),
            valor: dato.charlas,
          })),
          tono: "brass" as const,
        },
        {
          nombre: "Inspecciones",
          puntos: reporte.prevencion.map((dato) => ({
            etiqueta: mesCorto(dato.mes),
            valor: dato.inspecciones,
          })),
          tono: "fire" as const,
        },
        {
          nombre: "Simulacros",
          puntos: reporte.prevencion.map((dato) => ({
            etiqueta: mesCorto(dato.mes),
            valor: dato.simulacros,
          })),
          tono: "alarm" as const,
        },
        {
          nombre: "Otras",
          puntos: reporte.prevencion.map((dato) => ({
            etiqueta: mesCorto(dato.mes),
            valor: dato.otras,
          })),
          tono: "ink" as const,
        },
      ].filter((serie) => serie.puntos.length > 0)
    : [];

  const filasResumen: FilaTabla[] = [
    { indicador: "Incidentes", valor: formatearEntero(resumen.incidentes) },
    { indicador: "Horas de guardia", valor: formatearEntero(resumen.horas_guardia) },
    {
      indicador: "Cobertura promedio",
      valor: formatearPorcentaje(resumen.cobertura_promedio),
    },
    { indicador: "Fallas de chequeo", valor: formatearEntero(resumen.fallas_chequeo) },
    {
      indicador: "Tareas cumplidas",
      valor: formatearEntero(resumen.tareas_cumplidas),
    },
    {
      indicador: "Actividades de prevención",
      valor: formatearEntero(resumen.actividades_prevencion),
    },
  ];

  const vacio = (lista: unknown[]) => !reporte || lista.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="no-print">
        <SectionHeading
          titulo="Reportes"
          descripcion={`Indicadores del cuartel calculados en SQL para ${etiquetaRango(rango)}. Solo disponible para oficiales.`}
          accion={
            <div className="flex flex-col items-end gap-2">
              <AccionesReportes desde={rango.desde} hasta={rango.hasta} />
              <StatusPill estado={resultado.ok ? "cargado" : "pendiente"} />
            </div>
          }
        />

        <div className="mt-5">
          <DashboardCard
            titulo="Rango de fechas"
            descripcion="Elegí el período a resumir. El cálculo lo hace la base de datos."
            error={errorTexto}
          >
            <form method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Input
                id="reportes-desde"
                name="desde"
                type="date"
                label="Desde"
                defaultValue={rango.desde}
                required
              />
              <Input
                id="reportes-hasta"
                name="hasta"
                type="date"
                label="Hasta"
                defaultValue={rango.hasta}
                required
              />
              <Button type="submit" variant="secondary">
                <CalendarRange className="h-4 w-4" aria-hidden />
                Aplicar rango
              </Button>
            </form>
          </DashboardCard>
        </div>

        {!resultado.ok ? (
          <div className="mt-5">
            <DashboardCard titulo="Reporte" error={resultado.error} />
          </div>
        ) : sinDatos ? (
          <div className="mt-5">
            <EstadoVacio
              icono="FileBarChart"
              titulo="No hay datos para este rango"
              texto="Probá con otro período. Los indicadores se calculan solo con información ya registrada."
            />
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <QuickAction
                icono={FileText}
                titulo={`${formatearEntero(resumen.incidentes)} incidentes`}
                descripcion="Registrados en el período elegido."
                href="/incidentes"
              />
              <QuickAction
                icono={Clock3}
                titulo={`${formatearEntero(resumen.horas_guardia)} horas`}
                descripcion="Horas de guardia sumadas por franja."
                href="/guardias"
              />
              <QuickAction
                icono={ShieldCheck}
                titulo={formatearPorcentaje(resumen.cobertura_promedio)}
                descripcion="Cobertura promedio de las franjas."
                href="/guardias"
              />
              <QuickAction
                icono={ClipboardCheck}
                titulo={`${formatearEntero(resumen.fallas_chequeo)} fallas`}
                descripcion="Fallas detectadas en chequeos."
                href="/chequeo"
              />
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <DashboardCard
                titulo="Incidentes por tipo"
                descripcion="Distribución de incidentes según el tipo registrado."
                empty={vacio(barrasTipos)}
                emptyTexto="No hay incidentes en este rango."
              >
                <GraficoBarras titulo="Incidentes por tipo" datos={barrasTipos} />
              </DashboardCard>

              <DashboardCard
                titulo="Incidentes por mes"
                descripcion="Evolución mensual de incidentes."
                empty={vacio(serieIncidentesMes[0]?.puntos ?? [])}
                emptyTexto="No hay incidentes en este rango."
              >
                <GraficoLineas
                  titulo="Incidentes por mes"
                  series={serieIncidentesMes}
                />
              </DashboardCard>

              <DashboardCard
                titulo="Horas de guardia por bombero"
                descripcion="Cada franja suma sus horas; la nocturna suma 9."
                empty={vacio(reporte?.horas_por_bombero ?? [])}
                emptyTexto="No hay turnos asignados en este rango."
              >
                <TablaReporte
                  columnas={[
                    { titulo: "Bombero", clave: "nombre" },
                    { titulo: "Legajo", clave: "legajo", derecha: true },
                    { titulo: "Turnos", clave: "turnos", derecha: true },
                    { titulo: "Horas", clave: "horas", derecha: true },
                  ]}
                  filas={(reporte?.horas_por_bombero ?? []).map((dato) => ({
                    nombre: dato.nombre_completo,
                    legajo: dato.numero_ingreso,
                    turnos: dato.turnos,
                    horas: dato.horas,
                  }))}
                />
              </DashboardCard>

              <DashboardCard
                titulo="Cobertura de franjas"
                descripcion="Ocupadas sobre la capacidad del cupo por día y franja."
                empty={vacio(barrasCobertura)}
                emptyTexto="No hay franjas para mostrar."
              >
                <GraficoBarras
                  titulo="Cobertura de franjas"
                  datos={barrasCobertura}
                  unidad="%"
                />
                <div className="mt-4">
                  <TablaReporte
                    columnas={[
                      { titulo: "Franja", clave: "franja" },
                      { titulo: "Ocupadas", clave: "ocupadas", derecha: true },
                      { titulo: "Capacidad", clave: "capacidad", derecha: true },
                      { titulo: "Cobertura", clave: "cobertura", derecha: true },
                    ]}
                    filas={(reporte?.cobertura_franjas ?? []).map((dato) => ({
                      franja: dato.franja,
                      ocupadas: dato.ocupadas,
                      capacidad: dato.capacidad,
                      cobertura: formatearPorcentaje(dato.porcentaje),
                    }))}
                  />
                </div>
              </DashboardCard>

              <DashboardCard
                titulo="Chequeos con fallas"
                descripcion="Ítems en falta o dañados, por mes."
                empty={vacio(serieFallas[0]?.puntos ?? [])}
                emptyTexto="No hay chequeos con fallas en este rango."
              >
                <GraficoLineas titulo="Fallas de chequeo" series={serieFallas} />
                <div className="mt-4">
                  <TablaReporte
                    columnas={[
                      { titulo: "Mes", clave: "mes" },
                      { titulo: "Chequeos", clave: "chequeos", derecha: true },
                      { titulo: "Ítems", clave: "items", derecha: true },
                      { titulo: "Fallas", clave: "fallas", derecha: true },
                    ]}
                    filas={(reporte?.chequeos_fallas ?? []).map((dato) => ({
                      mes: etiquetaMes(dato.mes),
                      chequeos: dato.chequeos,
                      items: dato.items,
                      fallas: dato.fallas,
                    }))}
                  />
                </div>
              </DashboardCard>

              <DashboardCard
                titulo="Tareas cumplidas"
                descripcion="Tareas marcadas como hechas, por mes."
                empty={vacio(serieTareas[0]?.puntos ?? [])}
                emptyTexto="No hay tareas cumplidas en este rango."
              >
                <GraficoLineas titulo="Tareas cumplidas" series={serieTareas} />
                <div className="mt-4">
                  <TablaReporte
                    columnas={[
                      { titulo: "Mes", clave: "mes" },
                      { titulo: "Cumplidas", clave: "total", derecha: true },
                    ]}
                    filas={(reporte?.tareas_cumplidas ?? []).map((dato) => ({
                      mes: etiquetaMes(dato.mes),
                      total: dato.total,
                    }))}
                  />
                </div>
              </DashboardCard>

              <DashboardCard
                titulo="Actividades de prevención"
                descripcion="Charlas, inspecciones, simulacros y otras actividades por mes."
                empty={vacio(seriesPrevencion)}
                emptyTexto="No hay actividades de prevención en este rango."
                className="lg:col-span-2"
              >
                <GraficoLineas
                  titulo="Actividades de prevención"
                  series={seriesPrevencion}
                />
                <div className="mt-4">
                  <TablaReporte
                    columnas={[
                      { titulo: "Mes", clave: "mes" },
                      { titulo: "Charlas", clave: "charlas", derecha: true },
                      { titulo: "Inspecciones", clave: "inspecciones", derecha: true },
                      { titulo: "Simulacros", clave: "simulacros", derecha: true },
                      { titulo: "Otras", clave: "otras", derecha: true },
                      { titulo: "Total", clave: "total", derecha: true },
                    ]}
                    filas={(reporte?.prevencion ?? []).map((dato) => ({
                      mes: etiquetaMes(dato.mes),
                      charlas: dato.charlas,
                      inspecciones: dato.inspecciones,
                      simulacros: dato.simulacros,
                      otras: dato.otras,
                      total: dato.total,
                    }))}
                  />
                </div>
              </DashboardCard>
            </div>

            <div className="mt-5">
              <QuickAction
                icono={LayoutDashboard}
                titulo="Volver al tablero"
                descripcion="Ir a la vista operativa del cuartel."
                href="/inicio"
              />
            </div>
          </>
        )}
      </div>

      <section className="print-only reportes-print" aria-label="Reporte para impresión">
        <header className="planilla-encabezado">
          <p className="font-mono uppercase tracking-widest">
            {PRODUCTO.nombre} · Reportes
          </p>
          <p className="heading-display text-lg">{CUARTEL.nombre}</p>
          <p>{etiquetaRango(rango)}</p>
        </header>

        <h2>Resumen</h2>
        <TablaReporte
          compacta
          columnas={[
            { titulo: "Indicador", clave: "indicador" },
            { titulo: "Valor", clave: "valor", derecha: true },
          ]}
          filas={filasResumen}
        />

        <h2>Incidentes por tipo</h2>
        <TablaReporte
          compacta
          columnas={[
            { titulo: "Tipo", clave: "tipo" },
            { titulo: "Total", clave: "total", derecha: true },
          ]}
          filas={(reporte?.incidentes_por_tipo ?? []).map((dato) => ({
            tipo: dato.etiqueta,
            total: dato.total,
          }))}
        />

        <h2>Incidentes por mes</h2>
        <TablaReporte
          compacta
          columnas={[
            { titulo: "Mes", clave: "mes" },
            { titulo: "Total", clave: "total", derecha: true },
          ]}
          filas={(reporte?.incidentes_por_mes ?? []).map((dato) => ({
            mes: etiquetaMes(dato.mes),
            total: dato.total,
          }))}
        />

        <h2>Horas de guardia por bombero</h2>
        <TablaReporte
          compacta
          columnas={[
            { titulo: "Bombero", clave: "nombre" },
            { titulo: "Legajo", clave: "legajo", derecha: true },
            { titulo: "Turnos", clave: "turnos", derecha: true },
            { titulo: "Horas", clave: "horas", derecha: true },
          ]}
          filas={(reporte?.horas_por_bombero ?? []).map((dato) => ({
            nombre: dato.nombre_completo,
            legajo: dato.numero_ingreso,
            turnos: dato.turnos,
            horas: dato.horas,
          }))}
        />

        <h2>Cobertura de franjas</h2>
        <TablaReporte
          compacta
          columnas={[
            { titulo: "Franja", clave: "franja" },
            { titulo: "Ocupadas", clave: "ocupadas", derecha: true },
            { titulo: "Capacidad", clave: "capacidad", derecha: true },
            { titulo: "Cobertura", clave: "cobertura", derecha: true },
          ]}
          filas={(reporte?.cobertura_franjas ?? []).map((dato) => ({
            franja: dato.franja,
            ocupadas: dato.ocupadas,
            capacidad: dato.capacidad,
            cobertura: formatearPorcentaje(dato.porcentaje),
          }))}
        />

        <h2>Chequeos con fallas</h2>
        <TablaReporte
          compacta
          columnas={[
            { titulo: "Mes", clave: "mes" },
            { titulo: "Fallas", clave: "fallas", derecha: true },
            { titulo: "Chequeos con fallas", clave: "conFallas", derecha: true },
          ]}
          filas={(reporte?.chequeos_fallas ?? []).map((dato) => ({
            mes: etiquetaMes(dato.mes),
            fallas: dato.fallas,
            conFallas: dato.chequeos_con_fallas,
          }))}
        />

        <h2>Tareas cumplidas</h2>
        <TablaReporte
          compacta
          columnas={[
            { titulo: "Mes", clave: "mes" },
            { titulo: "Cumplidas", clave: "total", derecha: true },
          ]}
          filas={(reporte?.tareas_cumplidas ?? []).map((dato) => ({
            mes: etiquetaMes(dato.mes),
            total: dato.total,
          }))}
        />

        <h2>Actividades de prevención</h2>
        <TablaReporte
          compacta
          columnas={[
            { titulo: "Mes", clave: "mes" },
            { titulo: "Charlas", clave: "charlas", derecha: true },
            { titulo: "Inspecciones", clave: "inspecciones", derecha: true },
            { titulo: "Simulacros", clave: "simulacros", derecha: true },
            { titulo: "Otras", clave: "otras", derecha: true },
            { titulo: "Total", clave: "total", derecha: true },
          ]}
          filas={(reporte?.prevencion ?? []).map((dato) => ({
            mes: etiquetaMes(dato.mes),
            charlas: dato.charlas,
            inspecciones: dato.inspecciones,
            simulacros: dato.simulacros,
            otras: dato.otras,
            total: dato.total,
          }))}
        />
      </section>
    </div>
  );
}
