export const dynamic = "force-dynamic";

export async function GET() {
  const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY;
  if (!clave) {
    return Response.json({ clave: null }, { status: 503 });
  }
  return Response.json({ clave });
}
