export type TipoAlarma =
  | "incendio_estructural"
  | "incendio_forestal"
  | "rescate_vehicular"
  | "rescate"
  | "enjambre_abejas"
  | "inundacion"
  | "convocatoria_general"
  | "simulacro";

export type AlarmaInfo = {
  etiqueta: string;
  frase: string;
};

export const TIPOS_ALARMA: Record<TipoAlarma, AlarmaInfo> = {
  incendio_estructural: {
    etiqueta: "Incendio estructural",
    frase: "Atenci?n. Incendio estructural. Incendio estructural. Presentarse en el cuartel.",
  },
  incendio_forestal: {
    etiqueta: "Incendio forestal",
    frase: "Atenci?n. Incendio forestal. Incendio forestal. Presentarse en el cuartel.",
  },
  rescate_vehicular: {
    etiqueta: "Rescate vehicular",
    frase: "Atenci?n. Rescate vehicular. Rescate vehicular. Presentarse en el cuartel.",
  },
  rescate: {
    etiqueta: "Rescate",
    frase: "Atenci?n. Rescate. Rescate. Presentarse en el cuartel.",
  },
  enjambre_abejas: {
    etiqueta: "Enjambre de abejas",
    frase: "Atenci?n. Enjambre de abejas. Enjambre de abejas. Presentarse en el cuartel.",
  },
  inundacion: {
    etiqueta: "Inundaci?n",
    frase: "Atenci?n. Inundaci?n. Inundaci?n. Presentarse en el cuartel.",
  },
  convocatoria_general: {
    etiqueta: "Convocatoria general",
    frase: "Atenci?n. Convocatoria general. Convocatoria general. Presentarse en el cuartel.",
  },
  simulacro: {
    etiqueta: "Simulacro",
    frase: "Atenci?n. Simulacro. Simulacro. Presentarse en el cuartel.",
  },
};

export const TIPOS_ALARMA_LISTA = Object.entries(TIPOS_ALARMA).map(([value, info]) => ({
  value: value as TipoAlarma,
  ...info,
}));

export function etiquetaAlarma(tipo: string, esSimulacro = false): string {
  if (esSimulacro) return "Simulacro";
  return TIPOS_ALARMA[tipo as TipoAlarma]?.etiqueta ?? "Alarma";
}

export function fraseAlarma(tipo: string): string {
  return TIPOS_ALARMA[tipo as TipoAlarma]?.frase ?? "Atenci?n. Alarma. Presentarse en el cuartel.";
}
