import { renovarSuscripcionPush } from "@/lib/push-suscripcion";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let datos: unknown;
  try {
    datos = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "Los datos de la suscripción son inválidos." },
      { status: 400 }
    );
  }

  const resultado = await renovarSuscripcionPush(datos);
  if (!resultado.ok) {
    return Response.json(resultado, { status: 400 });
  }
  return Response.json({ ok: true });
}
