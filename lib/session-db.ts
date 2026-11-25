import { getSession, destroySession } from "@/lib/session";
import { createServiceRoleClient } from "@/lib/supabase";
import type { SessionBombero } from "@/lib/auth";

async function borrarCookie(): Promise<void> {
  try {
    await destroySession();
  } catch {
    return;
  }
}

export async function getSessionActiva(): Promise<SessionBombero | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const { data, error } = await createServiceRoleClient()
      .from("bomberos")
      .select("id, numero_ingreso, nombre_completo, cargo")
      .eq("id", session.bombero_id)
      .eq("activo", true)
      .maybeSingle();

    if (error) {
      console.error("Error al revalidar la sesión:", error.message);
      return null;
    }

    if (!data) {
      await borrarCookie();
      return null;
    }

    return {
      bombero_id: data.id,
      numero_ingreso: data.numero_ingreso,
      nombre_completo: data.nombre_completo,
      cargo: data.cargo,
    };
  } catch (err) {
    console.error("Error al revalidar la sesión:", err);
    return null;
  }
}
