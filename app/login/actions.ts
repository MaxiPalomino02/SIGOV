"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/session";
import { createServiceRoleClient, createSupabaseClient } from "@/lib/supabase";

export type LoginState = { error: string | null };

const MAX_INTENTOS = 5;
const VENTANA_MINUTOS = 10;
const MENSAJE_BLOQUEO = "Demasiados intentos. Probá en unos minutos.";

function obtenerIp(h: Headers): string {
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip ? ip.slice(0, 100) : "sin-ip";
}

async function contarIntentos(clave: string): Promise<number> {
  try {
    const { data, error } = await createServiceRoleClient().rpc(
      "contar_intentos_login",
      { p_clave: clave, p_minutos: VENTANA_MINUTOS }
    );
    if (error) {
      console.error("Error al contar intentos de login:", error.message);
      return 0;
    }
    return typeof data === "number" ? data : 0;
  } catch (err) {
    console.error("Error al contar intentos de login:", err);
    return 0;
  }
}

async function registrarIntento(clave: string): Promise<void> {
  try {
    const { error } = await createServiceRoleClient().rpc(
      "registrar_intento_login",
      { p_clave: clave }
    );
    if (error) {
      console.error("Error al registrar intento de login:", error.message);
    }
  } catch (err) {
    console.error("Error al registrar intento de login:", err);
  }
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = formData.get("numero_ingreso");
  const numero = typeof raw === "string" ? parseInt(raw.trim(), 10) : NaN;

  const ip = obtenerIp(await headers());
  const claveIp = `ip:${ip}`;

  if ((await contarIntentos(claveIp)) >= MAX_INTENTOS) {
    return { error: MENSAJE_BLOQUEO };
  }

  if (!Number.isFinite(numero)) {
    await registrarIntento(claveIp);
    return { error: "Ingresá tu número de ingreso." };
  }

  const claveLegajo = `legajo:${numero}`;

  if ((await contarIntentos(claveLegajo)) >= MAX_INTENTOS) {
    return { error: MENSAJE_BLOQUEO };
  }

  const supabase = createSupabaseClient();
  const { data: bombero, error } = await supabase
    .from("bomberos")
    .select("id, numero_ingreso, nombre_completo, cargo")
    .eq("numero_ingreso", numero)
    .eq("activo", true)
    .maybeSingle();

  if (error) {
    console.error("Error al buscar el bombero:", error.message);
    return {
      error: "Ocurrió un error al consultar el padrón. Volvé a intentar.",
    };
  }

  if (!bombero) {
    await registrarIntento(claveIp);
    await registrarIntento(claveLegajo);
    return {
      error: "Número no encontrado, contactate con la comisión directiva",
    };
  }

  try {
    await createSession({
      bombero_id: bombero.id,
      numero_ingreso: bombero.numero_ingreso,
      nombre_completo: bombero.nombre_completo,
      cargo: bombero.cargo,
    });
  } catch (err) {
    console.error("Error al crear la sesión:", err);
    return {
      error:
        "El servidor no está configurado para iniciar sesión. Avisale al encargado del sistema.",
    };
  }

  redirect("/inicio");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
