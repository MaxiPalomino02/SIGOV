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
    frase: "Atención. Incendio estructural. Incendio estructural. Presentarse en el cuartel.",
  },
  incendio_forestal: {
    etiqueta: "Incendio forestal",
    frase: "Atención. Incendio forestal. Incendio forestal. Presentarse en el cuartel.",
  },
  rescate_vehicular: {
    etiqueta: "Rescate vehicular",
    frase: "Atención. Rescate vehicular. Rescate vehicular. Presentarse en el cuartel.",
  },
  rescate: {
    etiqueta: "Rescate",
    frase: "Atención. Rescate. Rescate. Presentarse en el cuartel.",
  },
  enjambre_abejas: {
    etiqueta: "Enjambre de abejas",
    frase: "Atención. Enjambre de abejas. Enjambre de abejas. Presentarse en el cuartel.",
  },
  inundacion: {
    etiqueta: "Inundación",
    frase: "Atención. Inundación. Inundación. Presentarse en el cuartel.",
  },
  convocatoria_general: {
    etiqueta: "Convocatoria general",
    frase: "Atención. Convocatoria general. Convocatoria general. Presentarse en el cuartel.",
  },
  simulacro: {
    etiqueta: "Simulacro",
    frase: "Atención. Simulacro. Simulacro. Presentarse en el cuartel.",
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
  return TIPOS_ALARMA[tipo as TipoAlarma]?.frase ?? "Atención. Alarma. Presentarse en el cuartel.";
}
