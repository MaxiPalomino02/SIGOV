export type TareaEstado = "pendiente" | "hecha";

export const REGLAS_TAREAS = {
  // Quién puede crear, editar, asignar y borrar tareas.
  gestionar: "oficiales" as const,
  // Tarea general (asignada_a null): quién puede marcarla.
  marcarGeneral: "guardia_actual" as const,
  // Tarea asignada: la marca el designado, o alguien de guardia ahora (default).
  // Un oficial siempre puede marcar cualquiera.
  marcarAsignada: "designado_o_guardia_actual" as const,
  // Se puede desmarcar dentro de este tiempo (minutos) o siendo oficial.
  desmarcarMinutos: 10,
} as const;

export function puedeGestionarTareas(esOficial: boolean): boolean {
  return esOficial;
}

export function textoHechaPor(nombre: string, fechaIso: string): string {
  const fecha = new Date(fechaIso);
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
  return `Hecha por ${nombre} - ${hora}`;
}
