import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { sincronizarAlertasSmn } from "@/lib/alertas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const res = await sincronizarAlertasSmn({ forzar: true });
  if (!res.ok) {
    return NextResponse.json({ error: "No se pudieron actualizar las alertas" }, { status: 500 });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, procesadas: res.procesadas, aplicadas: res.aplicadas });
}
