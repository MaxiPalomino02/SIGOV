import "server-only";
import * as webpush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase";
import type { PayloadPush } from "@/lib/push-tipos";

export type DestinoPush = "todos" | { bomberoId: string };
export type ResultadoPush = { enviados: number; eliminados: number };

type SuscripcionPush = {
  id: string;
  bombero_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

let vapidListo = false;
let avisoConfiguracion = false;

function configurarVapid(): boolean {
  if (vapidListo) return true;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    if (!avisoConfiguracion) {
      console.warn("Push no configurado: faltan variables VAPID.");
      avisoConfiguracion = true;
    }
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidListo = true;
    return true;
  } catch {
    if (!avisoConfiguracion) {
      console.warn("Push no configurado: datos VAPID inválidos.");
      avisoConfiguracion = true;
    }
    return false;
  }
}

function codigoEstado(error: unknown): number | undefined {
  if (error && typeof error === "object" && "statusCode" in error) {
    const valor = (error as { statusCode?: unknown }).statusCode;
    return typeof valor === "number" ? valor : undefined;
  }
  return undefined;
}

function normalizarPayload(payload: PayloadPush) {
  return {
    titulo: payload.titulo.trim().slice(0, 120) || "SIGOV",
    cuerpo: payload.cuerpo.trim().slice(0, 500),
    tipo: payload.tipo,
    url:
      payload.url === "/alarma" || payload.url === "/notificaciones"
        ? payload.url
        : ("/avisos" as const),
    tag: payload.tag.trim().slice(0, 64) || `sigov-${payload.tipo}`,
    urgencia: payload.urgencia ?? "normal",
    requiereInteraccion: Boolean(payload.requiereInteraccion),
    vibracion: payload.vibracion?.slice(0, 16),
  };
}

export async function enviarPush(
  destino: DestinoPush,
  payload: PayloadPush
): Promise<ResultadoPush> {
  const vacio: ResultadoPush = { enviados: 0, eliminados: 0 };
  if (!configurarVapid()) return vacio;

  const supabase = createServiceRoleClient();
  const consulta = await supabase.rpc("push_obtener_suscripciones", {
    p_bombero_id: destino === "todos" ? null : destino.bomberoId,
  });
  if (consulta.error) {
    console.warn("No pudimos leer las suscripciones push.");
    return vacio;
  }

  const suscripciones = (consulta.data ?? []) as SuscripcionPush[];
  if (suscripciones.length === 0) return vacio;

  const cuerpo = JSON.stringify(normalizarPayload(payload));
  const urgencia = payload.urgencia ?? "normal";
  const resultados = await Promise.allSettled(
    suscripciones.map((suscripcion) =>
      webpush
        .sendNotification(
          {
            endpoint: suscripcion.endpoint,
            keys: { p256dh: suscripcion.p256dh, auth: suscripcion.auth },
          },
          cuerpo,
          {
            TTL: urgencia === "high" ? 60 : 3600,
            urgency: urgencia,
            topic: payload.tipo === "alarma" ? "alarma" : undefined,
          }
        )
        .then(() => suscripcion)
    )
  );

  const enviados: string[] = [];
  const expiradas: { bomberoId: string; endpoint: string }[] = [];

  for (const [indice, resultado] of resultados.entries()) {
    const suscripcion = suscripciones[indice];
    if (resultado.status === "fulfilled") {
      enviados.push(resultado.value.id);
      continue;
    }

    const estado = codigoEstado(resultado.reason);
    if ((estado === 404 || estado === 410) && suscripcion) {
      expiradas.push({
        bomberoId: suscripcion.bombero_id,
        endpoint: suscripcion.endpoint,
      });
      continue;
    }
    console.warn("No se pudo entregar una notificación push.", estado ? { estado } : undefined);
  }

  let eliminados = 0;
  if (expiradas.length > 0) {
    const borrados = await Promise.all(
      expiradas.map(({ bomberoId, endpoint }) =>
        supabase.rpc("push_borrar_suscripcion", {
          p_bombero_id: bomberoId,
          p_endpoint: endpoint,
        })
      )
    );
    eliminados = borrados.filter((borrado) => !borrado.error).length;
  }

  if (enviados.length > 0) {
    const actualizacion = await supabase.rpc("push_marcar_uso", { p_ids: enviados });
    if (actualizacion.error) {
      console.warn("No pudimos actualizar el uso de las suscripciones push.");
    }
  }

  return { enviados: enviados.length, eliminados };
}
