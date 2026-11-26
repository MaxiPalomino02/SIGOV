import "server-only";
import { getSessionActiva } from "@/lib/session-db";
import { createServiceRoleClient } from "@/lib/supabase";

export type SuscripcionResult = { ok: true } | { ok: false; error: string };

type Sesion = Awaited<ReturnType<typeof getSessionActiva>>;
type DatosSuscripcion = {
  endpoint?: unknown;
  p256dh?: unknown;
  auth?: unknown;
  endpointAnterior?: unknown;
};

const CLAVE_RE = /^[A-Za-z0-9_-]{1,512}={0,2}$/;
const DATOS_INVALIDOS: SuscripcionResult = {
  ok: false,
  error: "Los datos de la suscripción son inválidos.",
};
const SIN_SESION: SuscripcionResult = {
  ok: false,
  error: "Tu sesión venció. Ingresá de nuevo.",
};

function datosValidos(datos: DatosSuscripcion): datos is Required<Pick<DatosSuscripcion, "endpoint" | "p256dh" | "auth">> & DatosSuscripcion {
  return (
    typeof datos.endpoint === "string" &&
    datos.endpoint.startsWith("https://") &&
    datos.endpoint.length <= 2048 &&
    typeof datos.p256dh === "string" &&
    CLAVE_RE.test(datos.p256dh) &&
    typeof datos.auth === "string" &&
    CLAVE_RE.test(datos.auth)
  );
}

function endpointAnteriorValido(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  if (typeof valor !== "string" || !valor.startsWith("https://") || valor.length > 2048) return null;
  return valor;
}

export async function guardarSuscripcionPush(
  datos: unknown,
  sesion?: Sesion
): Promise<SuscripcionResult> {
  const activa = sesion === undefined ? await getSessionActiva() : sesion;
  if (!activa) return SIN_SESION;
  if (!datos || typeof datos !== "object" || !datosValidos(datos as DatosSuscripcion)) {
    return DATOS_INVALIDOS;
  }

  const { endpoint, p256dh, auth } = datos as DatosSuscripcion;
  const { error } = await createServiceRoleClient().rpc("push_guardar_suscripcion", {
    p_bombero_id: activa.bombero_id,
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
  });
  if (error) {
    console.error("No pudimos guardar la suscripción push.");
    return { ok: false, error: "No pudimos guardar la suscripción. Intentá de nuevo." };
  }
  return { ok: true };
}

export async function renovarSuscripcionPush(
  datos: unknown,
  sesion?: Sesion
): Promise<SuscripcionResult> {
  const activa = sesion === undefined ? await getSessionActiva() : sesion;
  if (!activa) return SIN_SESION;
  if (!datos || typeof datos !== "object") return DATOS_INVALIDOS;

  const entrada = datos as DatosSuscripcion;
  if (!datosValidos(entrada)) return DATOS_INVALIDOS;
  const anterior = endpointAnteriorValido(entrada.endpointAnterior);

  const { error } = await createServiceRoleClient().rpc("push_renovar_suscripcion", {
    p_bombero_id: activa.bombero_id,
    p_endpoint_anterior: anterior,
    p_endpoint: entrada.endpoint,
    p_p256dh: entrada.p256dh,
    p_auth: entrada.auth,
  });
  if (error) {
    console.error("No pudimos renovar la suscripción push.");
    return { ok: false, error: "No pudimos renovar la suscripción. Intentá de nuevo." };
  }
  return { ok: true };
}

export async function borrarSuscripcionPush(sesion?: Sesion): Promise<SuscripcionResult> {
  const activa = sesion === undefined ? await getSessionActiva() : sesion;
  if (!activa) return SIN_SESION;

  const { error } = await createServiceRoleClient().rpc("push_borrar_suscripcion", {
    p_bombero_id: activa.bombero_id,
    p_endpoint: null,
  });
  if (error) {
    console.error("No pudimos borrar la suscripción push.");
    return { ok: false, error: "No pudimos desactivar las notificaciones. Intentá de nuevo." };
  }
  return { ok: true };
}
