import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { AccionesReportes } from "@/components/reportes/acciones-reportes";
import { Button } from "@/components/ui/button";
import { Contador } from "@/components/ui/contador";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { GraficoBarras } from "@/components/ui/grafico-barras";
import { GraficoLineas } from "@/components/ui/grafico-lineas";
import { Grupo } from "@/components/ui/grupo";
import { Input } from "@/components/ui/input";
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

export const metadata: Metadata = { title: `Reportes | ${PRODUCTO.nombre}` };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
type TonoGrafico = "red" | "yellow" | "green" | "ink";
type ColumnaTabla = { titulo: string; clave: string; derecha?: boolean };
type FilaTabla = Record<string, string | number>;
const TONOS: TonoGrafico[] = ["red", "yellow", "green", "ink"];

function mesCorto(mes: string): string { return `${mes.slice(5)}/${mes.slice(2, 4)}`; }

function TablaReporte({ columnas, filas, compacta = false }: { columnas: ColumnaTabla[]; filas: FilaTabla[]; compacta?: boolean }) {
  const th = compacta ? "" : "px-3 py-3 text-[13px] font-normal tracking-[.3px] text-label-2 uppercase";
  const td = compacta ? "" : "px-3 py-3 text-[15px] text-label";
  return (
    <div className={compacta ? "" : "overflow-x-auto"}>
      <table className={compacta ? "planilla-tabla" : "w-full min-w-[520px] border-collapse text-left"}>
        <thead className={compacta ? "" : "border-b border-separator"}>
          <tr>
            {columnas.map((c) => <th key={c.clave} scope="col" className={`${th} ${c.derecha ? "text-right" : ""}`.trim()}>{c.titulo}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={`${fila[columnas[0].clave]}-${i}`} className={compacta ? "" : "border-b border-separator last:border-b-0"}>
              {columnas.map((c, j) => j === 0 ? (
                <th key={c.clave} scope="row" className={`${td} font-semibold`.trim()}>{String(fila[c.clave] ?? "")}</th>
              ) : (
                <td key={c.clave} className={`${td} tabular-nums ${c.derecha ? "text-right" : ""}`.trim()}>{String(fila[c.clave] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tarjeta({ titulo, descripcion, children, error, vacio }: { titulo: string; descripcion?: string; children?: React.ReactNode; error?: string | null; vacio?: boolean }) {
  return (
    <section className="rounded-[16px] bg-surface p-4 sm:p-5">
      <h2 className="text-[17px] font-semibold text-label">{titulo}</h2>
      {descripcion ? <p className="mt-1 text-[15px] text-label-2">{descripcion}</p> : null}
      {error ? <div role="alert" className="mt-4 rounded-[14px] bg-red-tint px-4 py-3 text-[15px] text-red">{error}</div> : null}
      {!error && vacio ? <p className="mt-4 text-[15px] text-label-2">No hay datos para mostrar en este período.</p> : null}
      {!error && !vacio ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export default async function ReportesPage({ searchParams }: Props) {
  const session = await getSessionActiva();
  if (!session) redirect("/login");
  if (!isOficial(session.cargo)) redirect("/inicio");

  const params = await searchParams;
  const resultadoRango = rangoDesdeParametros(params.desde, params.hasta);
  const rango = resultadoRango.ok ? resultadoRango.rango : rangoPorDefecto();
  const resultado = resultadoRango.ok ? await obtenerReporte(rango.desde, rango.hasta) : ({ ok: false as const, error: resultadoRango.error });
  const reporte = resultado.ok ? resultado.data : null;
  const sinDatos = reporte ? !hayDatosReporte(reporte) : false;
  const errorTexto = resultado.ok ? null : resultado.error;
  const resumen = reporte?.resumen ?? { incidentes: 0, horas_guardia: 0, cobertura_promedio: 0, fallas_chequeo: 0, tareas_cumplidas: 0, actividades_prevencion: 0 };

  const barrasTipos = reporte?.incidentes_por_tipo.map((d, i) => ({ etiqueta: d.etiqueta, valor: d.total, tono: TONOS[i % TONOS.length] })) ?? [];
  const serieIncidentesMes = reporte ? [{ nombre: "Incidentes", puntos: reporte.incidentes_por_mes.map((d) => ({ etiqueta: mesCorto(d.mes), valor: d.total })), tono: "red" as const }] : [];
  const barrasCobertura = reporte?.cobertura_franjas.map((d) => ({ etiqueta: d.franja, valor: d.porcentaje, tono: (d.porcentaje >= 80 ? "green" : d.porcentaje >= 50 ? "yellow" : "red") as TonoGrafico })) ?? [];
  const serieFallas = reporte ? [{ nombre: "Fallas", puntos: reporte.chequeos_fallas.map((d) => ({ etiqueta: mesCorto(d.mes), valor: d.fallas })), tono: "yellow" as const }] : [];
  const serieTareas = reporte ? [{ nombre: "Tareas", puntos: reporte.tareas_cumplidas.map((d) => ({ etiqueta: mesCorto(d.mes), valor: d.total })), tono: "green" as const }] : [];
  const seriesPrevencion = reporte ? [
    { nombre: "Charlas", puntos: reporte.prevencion.map((d) => ({ etiqueta: mesCorto(d.mes), valor: d.charlas })), tono: "yellow" as const },
    { nombre: "Inspecciones", puntos: reporte.prevencion.map((d) => ({ etiqueta: mesCorto(d.mes), valor: d.inspecciones })), tono: "red" as const },
    { nombre: "Simulacros", puntos: reporte.prevencion.map((d) => ({ etiqueta: mesCorto(d.mes), valor: d.simulacros })), tono: "ink" as const },
    { nombre: "Otras", puntos: reporte.prevencion.map((d) => ({ etiqueta: mesCorto(d.mes), valor: d.otras })), tono: "green" as const },
  ].filter((s) => s.puntos.length > 0) : [];

  const filasResumen: FilaTabla[] = [
    { indicador: "Incidentes", valor: formatearEntero(resumen.incidentes) },
    { indicador: "Horas de guardia", valor: formatearEntero(resumen.horas_guardia) },
    { indicador: "Cobertura promedio", valor: formatearPorcentaje(resumen.cobertura_promedio) },
    { indicador: "Fallas de chequeo", valor: formatearEntero(resumen.fallas_chequeo) },
    { indicador: "Tareas cumplidas", valor: formatearEntero(resumen.tareas_cumplidas) },
    { indicador: "Actividades de prevención", valor: formatearEntero(resumen.actividades_prevencion) },
  ];
  const vacio = (lista: unknown[]) => !reporte || lista.length === 0;

  return (
    <div className="min-h-dvh bg-bg pb-24">
      <AccionesReportes
        titulo="Reportes"
        subtitulo="Indicadores del cuartel."
        estado={etiquetaRango(rango)}
        desde={rango.desde}
        hasta={rango.hasta}
      />

      <div className="no-print mx-auto w-full max-w-3xl space-y-5 px-4 py-5 lg:max-w-5xl">
        <section className="rounded-[16px] bg-surface p-4 sm:p-5">
          <h2 className="text-[17px] font-semibold text-label">Rango de fechas</h2>
          <p className="mt-1 text-[15px] text-label-2">Elegí el período a resumir. El cálculo lo hace la base de datos.</p>
          <form method="get" className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Input id="reportes-desde" name="desde" type="date" label="Desde" defaultValue={rango.desde} required />
            <Input id="reportes-hasta" name="hasta" type="date" label="Hasta" defaultValue={rango.hasta} required />
            <Button type="submit" variant="secondary" className="gap-2"><CalendarRange size={22} strokeWidth={1.75} aria-hidden />Aplicar rango</Button>
          </form>
          {errorTexto ? <div role="alert" className="mt-4 rounded-[14px] bg-red-tint px-4 py-3 text-[15px] text-red">{errorTexto}</div> : null}
        </section>

        {!resultado.ok ? null : sinDatos ? (
          <EstadoVacio icono="FileBarChart" titulo="No hay datos para este rango" texto="Probá con otro período. Los indicadores se calculan solo con información ya registrada." />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Contador valor={formatearEntero(resumen.incidentes)} etiqueta="Incidentes" icono="FileText" tono="fire" />
              <Contador valor={formatearEntero(resumen.horas_guardia)} etiqueta="Horas de guardia" icono="Clock3" tono="ink" />
              <Contador valor={formatearPorcentaje(resumen.cobertura_promedio)} etiqueta="Cobertura promedio" icono="ShieldCheck" tono="ok" />
              <Contador valor={formatearEntero(resumen.fallas_chequeo)} etiqueta="Fallas de chequeo" icono="ClipboardCheck" tono="brass" />
              <Contador valor={formatearEntero(resumen.tareas_cumplidas)} etiqueta="Tareas cumplidas" icono="CheckCircle2" tono="ok" />
              <Contador valor={formatearEntero(resumen.actividades_prevencion)} etiqueta="Prevención" icono="Shield" tono="fire" />
            </section>

            <Tarjeta titulo="Incidentes por tipo" descripcion="Distribución de incidentes según el tipo registrado." vacio={vacio(barrasTipos)}>
              <GraficoBarras titulo="Incidentes por tipo" datos={barrasTipos} />
            </Tarjeta>

            <Tarjeta titulo="Incidentes por mes" descripcion="Evolución mensual de incidentes." vacio={vacio(serieIncidentesMes[0]?.puntos ?? [])}>
              <GraficoLineas titulo="Incidentes por mes" series={serieIncidentesMes} />
            </Tarjeta>

            <Tarjeta titulo="Horas de guardia por bombero" descripcion="Cada franja suma sus horas; la nocturna suma 9." vacio={vacio(reporte?.horas_por_bombero ?? [])}>
              <TablaReporte columnas={[{ titulo: "Bombero", clave: "nombre" }, { titulo: "Legajo", clave: "legajo", derecha: true }, { titulo: "Turnos", clave: "turnos", derecha: true }, { titulo: "Horas", clave: "horas", derecha: true }]} filas={(reporte?.horas_por_bombero ?? []).map((d) => ({ nombre: d.nombre_completo, legajo: d.numero_ingreso, turnos: d.turnos, horas: d.horas }))} />
            </Tarjeta>

            <Tarjeta titulo="Cobertura de franjas" descripcion="Ocupadas sobre la capacidad del cupo por día y franja." vacio={vacio(barrasCobertura)}>
              <GraficoBarras titulo="Cobertura de franjas" datos={barrasCobertura} unidad="%" />
              <div className="mt-4"><TablaReporte columnas={[{ titulo: "Franja", clave: "franja" }, { titulo: "Ocupadas", clave: "ocupadas", derecha: true }, { titulo: "Capacidad", clave: "capacidad", derecha: true }, { titulo: "Cobertura", clave: "cobertura", derecha: true }]} filas={(reporte?.cobertura_franjas ?? []).map((d) => ({ franja: d.franja, ocupadas: d.ocupadas, capacidad: d.capacidad, cobertura: formatearPorcentaje(d.porcentaje) }))} /></div>
            </Tarjeta>

            <Tarjeta titulo="Chequeos con fallas" descripcion="Ítems en falta o dañados, por mes." vacio={vacio(serieFallas[0]?.puntos ?? [])}>
              <GraficoLineas titulo="Fallas de chequeo" series={serieFallas} />
              <div className="mt-4"><TablaReporte columnas={[{ titulo: "Mes", clave: "mes" }, { titulo: "Chequeos", clave: "chequeos", derecha: true }, { titulo: "Ítems", clave: "items", derecha: true }, { titulo: "Fallas", clave: "fallas", derecha: true }]} filas={(reporte?.chequeos_fallas ?? []).map((d) => ({ mes: etiquetaMes(d.mes), chequeos: d.chequeos, items: d.items, fallas: d.fallas }))} /></div>
            </Tarjeta>

            <Tarjeta titulo="Tareas cumplidas" descripcion="Tareas marcadas como hechas, por mes." vacio={vacio(serieTareas[0]?.puntos ?? [])}>
              <GraficoLineas titulo="Tareas cumplidas" series={serieTareas} />
              <div className="mt-4"><TablaReporte columnas={[{ titulo: "Mes", clave: "mes" }, { titulo: "Cumplidas", clave: "total", derecha: true }]} filas={(reporte?.tareas_cumplidas ?? []).map((d) => ({ mes: etiquetaMes(d.mes), total: d.total }))} /></div>
            </Tarjeta>

            <Tarjeta titulo="Actividades de prevención" descripcion="Charlas, inspecciones, simulacros y otras actividades por mes." vacio={vacio(seriesPrevencion)}>
              <GraficoLineas titulo="Actividades de prevención" series={seriesPrevencion} />
              <div className="mt-4"><TablaReporte columnas={[{ titulo: "Mes", clave: "mes" }, { titulo: "Charlas", clave: "charlas", derecha: true }, { titulo: "Inspecciones", clave: "inspecciones", derecha: true }, { titulo: "Simulacros", clave: "simulacros", derecha: true }, { titulo: "Otras", clave: "otras", derecha: true }, { titulo: "Total", clave: "total", derecha: true }]} filas={(reporte?.prevencion ?? []).map((d) => ({ mes: etiquetaMes(d.mes), charlas: d.charlas, inspecciones: d.inspecciones, simulacros: d.simulacros, otras: d.otras, total: d.total }))} /></div>
            </Tarjeta>
          </>
        )}
      </div>

      <section className="print-only reportes-print" aria-label="Reporte para impresión">
        <header className="planilla-encabezado">
          <p className="text-[13px]">{PRODUCTO.nombre} · Reportes</p>
          <p className="text-[22px] font-bold">{CUARTEL.nombre}</p>
          <p>{etiquetaRango(rango)}</p>
        </header>
        <h2>Resumen</h2>
        <TablaReporte compacta columnas={[{ titulo: "Indicador", clave: "indicador" }, { titulo: "Valor", clave: "valor", derecha: true }]} filas={filasResumen} />
        <h2>Incidentes por tipo</h2>
        <TablaReporte compacta columnas={[{ titulo: "Tipo", clave: "tipo" }, { titulo: "Total", clave: "total", derecha: true }]} filas={(reporte?.incidentes_por_tipo ?? []).map((d) => ({ tipo: d.etiqueta, total: d.total }))} />
        <h2>Incidentes por mes</h2>
        <TablaReporte compacta columnas={[{ titulo: "Mes", clave: "mes" }, { titulo: "Total", clave: "total", derecha: true }]} filas={(reporte?.incidentes_por_mes ?? []).map((d) => ({ mes: etiquetaMes(d.mes), total: d.total }))} />
        <h2>Horas de guardia por bombero</h2>
        <TablaReporte compacta columnas={[{ titulo: "Bombero", clave: "nombre" }, { titulo: "Legajo", clave: "legajo", derecha: true }, { titulo: "Turnos", clave: "turnos", derecha: true }, { titulo: "Horas", clave: "horas", derecha: true }]} filas={(reporte?.horas_por_bombero ?? []).map((d) => ({ nombre: d.nombre_completo, legajo: d.numero_ingreso, turnos: d.turnos, horas: d.horas }))} />
        <h2>Cobertura de franjas</h2>
        <TablaReporte compacta columnas={[{ titulo: "Franja", clave: "franja" }, { titulo: "Ocupadas", clave: "ocupadas", derecha: true }, { titulo: "Capacidad", clave: "capacidad", derecha: true }, { titulo: "Cobertura", clave: "cobertura", derecha: true }]} filas={(reporte?.cobertura_franjas ?? []).map((d) => ({ franja: d.franja, ocupadas: d.ocupadas, capacidad: d.capacidad, cobertura: formatearPorcentaje(d.porcentaje) }))} />
        <h2>Chequeos con fallas</h2>
        <TablaReporte compacta columnas={[{ titulo: "Mes", clave: "mes" }, { titulo: "Fallas", clave: "fallas", derecha: true }, { titulo: "Chequeos con fallas", clave: "conFallas", derecha: true }]} filas={(reporte?.chequeos_fallas ?? []).map((d) => ({ mes: etiquetaMes(d.mes), fallas: d.fallas, conFallas: d.chequeos_con_fallas }))} />
        <h2>Tareas cumplidas</h2>
        <TablaReporte compacta columnas={[{ titulo: "Mes", clave: "mes" }, { titulo: "Cumplidas", clave: "total", derecha: true }]} filas={(reporte?.tareas_cumplidas ?? []).map((d) => ({ mes: etiquetaMes(d.mes), total: d.total }))} />
        <h2>Actividades de prevención</h2>
        <TablaReporte compacta columnas={[{ titulo: "Mes", clave: "mes" }, { titulo: "Charlas", clave: "charlas", derecha: true }, { titulo: "Inspecciones", clave: "inspecciones", derecha: true }, { titulo: "Simulacros", clave: "simulacros", derecha: true }, { titulo: "Otras", clave: "otras", derecha: true }, { titulo: "Total", clave: "total", derecha: true }]} filas={(reporte?.prevencion ?? []).map((d) => ({ mes: etiquetaMes(d.mes), charlas: d.charlas, inspecciones: d.inspecciones, simulacros: d.simulacros, otras: d.otras, total: d.total }))} />
      </section>
    </div>
  );
}
