export type TipoPush = "aviso" | "convocatoria" | "alarma" | "alerta";

export type UrgenciaPush = "very-low" | "low" | "normal" | "high";

export type PayloadPush = {
  titulo: string;
  cuerpo: string;
  tipo: TipoPush;
  url: "/alarma" | "/avisos" | "/notificaciones";
  tag: string;
  urgencia?: UrgenciaPush;
  requiereInteraccion?: boolean;
  vibracion?: number[];
};
