import {
  ETIQUETAS_TIPO_INCIDENTE,
  type TipoIncidente,
} from "@/lib/incidentes";
import { etiquetaMes } from "@/lib/prevencion";
import { hoyArgentina } from "@/lib/tablero";

export { etiquetaMes };

export type RangoReportes = { desde: string; hasta: string };

export type IncidentePorTipo = {
  tipo: string;
  etiqueta: string;
  total: number;
};

export type IncidentePorMes = { mes: string; total: number };

export type HoraPorBombero = {
  bombero_id: string;
  numero_ingreso: number;
  nombre_completo: string;
  cargo: string;
  horas: number;
  turnos: number;
};

export type CoberturaFranja = {
  franja: string;
  celdas: number;
  ocupadas: number;
  libres: number;
  capacidad: number;
  porcentaje: number;
};

export type ChequeoFallasPorMes = {
  mes: string;
  chequeos: number;
  items: number;
  fallas: number;
  chequeos_con_fallas: number;
};

export type TareaCumplidaPorMes = { mes: string; total: number };

export type PrevencionPorMes = {
  mes: string;
  total: number;
  charlas: number;
  inspecciones: number;
  simulacros: number;
  otras: number;
};

export type ResumenReportes = {
  incidentes: number;
  horas_guardia: number;
  cobertura_promedio: number;
  fallas_chequeo: number;
  tareas_cumplidas: number;
  actividades_prevencion: number;
};

export type Reporte = RangoReportes & {
  resumen: ResumenReportes;
  incidentes_por_tipo: IncidentePorTipo[];
  incidentes_por_mes: IncidentePorMes[];
  horas_por_bombero: HoraPorBombero[];
  cobertura_franjas: CoberturaFranja[];
  chequeos_fallas: ChequeoFallasPorMes[];
  tareas_cumplidas: TareaCumplidaPorMes[];
  prevencion: PrevencionPorMes[];
};

export type ResultadoRango =
  | { ok: true; rango: RangoReportes }
  | { ok: false; error: string };

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

function aFecha(iso: string): Date {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function aISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function esFechaISO(valor: unknown): valor is string {
  if (typeof valor !== "string" || !FECHA_RE.test(valor)) return false;
  const fecha = aFecha(valor);
  return !Number.isNaN(fecha.getTime()) && aISO(fecha) === valor;
}

function desplazarMeses(iso: string, meses: number): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  const objetivo = new Date(Date.UTC(anio, mes - 1 + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth() + 1, 0)
  ).getUTCDate();
  objetivo.setUTCDate(Math.min(dia, ultimoDia));
  return aISO(objetivo);
}

export function fechaDeParametro(
  valor: string | string[] | undefined
): string | null {
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return texto && esFechaISO(texto) ? texto : null;
}

export function rangoPorDefecto(): RangoReportes {
  const hasta = hoyArgentina();
  return { desde: desplazarMeses(hasta, -5), hasta };
}

export function validarRango(desde: unknown, hasta: unknown): ResultadoRango {
  if (!esFechaISO(desde) || !esFechaISO(hasta)) {
    return { ok: false, error: "Ingresá un rango de fechas válido." };
  }
  if (desde > hasta) {
    return {
      ok: false,
      error: "La fecha desde no puede ser mayor a la fecha hasta.",
    };
  }
  const dias = Math.round(
    (aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000
  );
  if (dias > 366) {
    return { ok: false, error: "El rango no puede superar un año." };
  }
  return { ok: true, rango: { desde, hasta } };
}

export function rangoDesdeParametros(
  desde: string | string[] | undefined,
  hasta: string | string[] | undefined
): ResultadoRango {
  const porDefecto = rangoPorDefecto();
  return validarRango(
    fechaDeParametro(desde) ?? porDefecto.desde,
    fechaDeParametro(hasta) ?? porDefecto.hasta
  );
}

export function etiquetaRango(rango: RangoReportes): string {
  const formato = new Intl.DateTimeFormat("es-AR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const desde = formato.format(aFecha(rango.desde));
  const hasta = formato.format(aFecha(rango.hasta));
  return `${desde} al ${hasta}`;
}

function numero(valor: unknown): number {
  const resultado = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(resultado) ? resultado : 0;
}

function entero(valor: unknown): number {
  return Math.round(numero(valor));
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function arreglo(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : [];
}

function objeto(valor: unknown): Record<string, unknown> {
  return typeof valor === "object" && valor !== null
    ? (valor as Record<string, unknown>)
    : {};
}

export function normalizarReporte(datos: unknown): Reporte | null {
  const r = objeto(datos);
  const desde = texto(r.desde);
  const hasta = texto(r.hasta);
  if (!esFechaISO(desde) || !esFechaISO(hasta)) return null;

  const resumenRaw = objeto(r.resumen);
  const resumen: ResumenReportes = {
    incidentes: entero(resumenRaw.incidentes),
    horas_guardia: entero(resumenRaw.horas_guardia),
    cobertura_promedio: numero(resumenRaw.cobertura_promedio),
    fallas_chequeo: entero(resumenRaw.fallas_chequeo),
    tareas_cumplidas: entero(resumenRaw.tareas_cumplidas),
    actividades_prevencion: entero(resumenRaw.actividades_prevencion),
  };

  const incidentes_por_tipo: IncidentePorTipo[] = arreglo(
    r.incidentes_por_tipo
  ).flatMap((fila) => {
    const item = objeto(fila);
    const tipo = texto(item.tipo);
    if (!tipo) return [];
    const etiqueta =
      ETIQUETAS_TIPO_INCIDENTE[tipo as TipoIncidente] ?? tipo;
    return [{ tipo, etiqueta, total: entero(item.total) }];
  });

  const incidentes_por_mes: IncidentePorMes[] = arreglo(
    r.incidentes_por_mes
  ).map((fila) => {
    const item = objeto(fila);
    return { mes: texto(item.mes), total: entero(item.total) };
  });

  const horas_por_bombero: HoraPorBombero[] = arreglo(
    r.horas_por_bombero
  ).map((fila) => {
    const item = objeto(fila);
    return {
      bombero_id: texto(item.bombero_id),
      numero_ingreso: entero(item.numero_ingreso),
      nombre_completo: texto(item.nombre_completo),
      cargo: texto(item.cargo),
      horas: entero(item.horas),
      turnos: entero(item.turnos),
    };
  });

  const cobertura_franjas: CoberturaFranja[] = arreglo(
    r.cobertura_franjas
  ).map((fila) => {
    const item = objeto(fila);
    return {
      franja: texto(item.franja),
      celdas: entero(item.celdas),
      ocupadas: entero(item.ocupadas),
      libres: entero(item.libres),
      capacidad: entero(item.capacidad),
      porcentaje: numero(item.porcentaje),
    };
  });

  const chequeos_fallas: ChequeoFallasPorMes[] = arreglo(
    r.chequeos_fallas
  ).map((fila) => {
    const item = objeto(fila);
    return {
      mes: texto(item.mes),
      chequeos: entero(item.chequeos),
      items: entero(item.items),
      fallas: entero(item.fallas),
      chequeos_con_fallas: entero(item.chequeos_con_fallas),
    };
  });

  const tareas_cumplidas: TareaCumplidaPorMes[] = arreglo(
    r.tareas_cumplidas
  ).map((fila) => {
    const item = objeto(fila);
    return { mes: texto(item.mes), total: entero(item.total) };
  });

  const prevencion: PrevencionPorMes[] = arreglo(r.prevencion).map((fila) => {
    const item = objeto(fila);
    return {
      mes: texto(item.mes),
      total: entero(item.total),
      charlas: entero(item.charlas),
      inspecciones: entero(item.inspecciones),
      simulacros: entero(item.simulacros),
      otras: entero(item.otras),
    };
  });

  return {
    desde,
    hasta,
    resumen,
    incidentes_por_tipo,
    incidentes_por_mes,
    horas_por_bombero,
    cobertura_franjas,
    chequeos_fallas,
    tareas_cumplidas,
    prevencion,
  };
}

export function hayDatosReporte(reporte: Reporte): boolean {
  return [
    reporte.incidentes_por_tipo,
    reporte.incidentes_por_mes,
    reporte.horas_por_bombero,
    reporte.cobertura_franjas,
    reporte.chequeos_fallas,
    reporte.tareas_cumplidas,
    reporte.prevencion,
  ].some((lista) => lista.length > 0);
}

export function formatearEntero(valor: number): string {
  return new Intl.NumberFormat("es-AR").format(valor);
}

export function formatearPorcentaje(valor: number): string {
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(valor)}%`;
}
