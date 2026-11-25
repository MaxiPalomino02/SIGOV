"use server";

import { guardarIncidenteAction } from "@/app/(tablero)/incidentes/actions";
import {
  finalizarChequeo,
  guardarResultado,
} from "@/app/(tablero)/chequeo/actions-ejecucion";
import {
  borrarTarea,
  crearTarea,
  desmarcarTarea,
  editarTarea,
  marcarTarea,
} from "@/app/(tablero)/tareas/actions";
import type { GuardarIncidenteInput } from "@/lib/incidentes-guardado";
import type { OperacionPendiente } from "@/lib/cola-sincronizacion";

export type ResultadoSincronizacion =
  | { ok: true }
  | { ok: false; error: string };

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function textoONulo(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor : null;
}

function listaTexto(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === "string") : [];
}

function aFormulario(valor: unknown): FormData {
  const datos = (valor ?? {}) as Record<string, unknown>;
  const formulario = new FormData();
  formulario.set("titulo", texto(datos.titulo));
  formulario.set("descripcion", texto(datos.descripcion));
  formulario.set("asignada_a", texto(datos.asignada_a));
  return formulario;
}

async function ejecutar(
  accion: () => Promise<{ ok: boolean; error?: string }>
): Promise<ResultadoSincronizacion> {
  try {
    const resultado = await accion();
    return resultado.ok
      ? { ok: true }
      : { ok: false, error: resultado.error ?? "No se pudo sincronizar." };
  } catch {
    return { ok: false, error: "No se pudo sincronizar. Volvemos a intentar." };
  }
}

export async function sincronizarOperacion(
  operacion: OperacionPendiente
): Promise<ResultadoSincronizacion> {
  const datos = operacion.payload ?? {};

  switch (operacion.accion) {
    case "guardar_incidente":
      return ejecutar(() =>
        guardarIncidenteAction({
          incidenteId: textoONulo(datos.incidenteId),
          fecha_hora: texto(datos.fecha_hora),
          tipo: datos.tipo,
          direccion: texto(datos.direccion),
          descripcion: texto(datos.descripcion),
          unidades: listaTexto(datos.unidades),
          personal: Array.isArray(datos.personal) ? datos.personal : [],
          estado: datos.estado,
        } as GuardarIncidenteInput)
      );

    case "guardar_resultado":
      return ejecutar(() =>
        guardarResultado(
          texto(datos.chequeoId),
          texto(datos.itemId),
          texto(datos.estado),
          texto(datos.nota),
          texto(datos.fotoPath)
        )
      );

    case "finalizar_chequeo":
      return ejecutar(() =>
        finalizarChequeo(texto(datos.chequeoId), texto(datos.observaciones))
      );

    case "crear_tarea":
      return ejecutar(() => crearTarea(aFormulario(datos)));

    case "editar_tarea":
      return ejecutar(() => editarTarea(texto(datos.tareaId), aFormulario(datos)));

    case "borrar_tarea":
      return ejecutar(() => borrarTarea(texto(datos.tareaId)));

    case "marcar_tarea":
      return ejecutar(() => marcarTarea(texto(datos.tareaId)));

    case "desmarcar_tarea":
      return ejecutar(() => desmarcarTarea(texto(datos.tareaId)));

    default:
      return { ok: false, error: "Operación pendiente no reconocida." };
  }
}
