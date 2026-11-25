import { Header } from "@/components/header";
import { NavMovil } from "@/components/app-nav";
import { PieInstitucional } from "@/components/pie-institucional";
import { AlarmaGlobal } from "@/components/alarma-global";
import { AlertasRealtime } from "@/components/alertas-realtime";
import { getSession } from "@/lib/session";
import { isOficial } from "@/lib/cargos";
import { createSupabaseClient } from "@/lib/supabase";

export default async function TableroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const oficial = session ? isOficial(session.cargo) : false;

  let avisosNoLeidos = 0;
  if (session) {
    try {
      const supabase = createSupabaseClient();
      const { data: avisos } = await supabase.from("avisos").select("id");
      const ids = (avisos ?? []).map((a: any) => a.id);
      if (ids.length > 0) {
        const { data: lecturas } = await supabase
          .from("avisos_lecturas")
          .select("aviso_id")
          .eq("bombero_id", session.bombero_id)
          .in("aviso_id", ids);
        const leidos = new Set((lecturas ?? []).map((l: any) => l.aviso_id));
        avisosNoLeidos = ids.filter((id) => !leidos.has(id)).length;
      }
    } catch {
      avisosNoLeidos = 0;
    }
  }

  return (
    <div className="flex min-h-full flex-col bg-bg pb-24 text-ink lg:pb-0">
      <Header avisosNoLeidos={avisosNoLeidos} />
      {session ? <AlarmaGlobal sessionId={session.bombero_id} /> : null}
      {session ? <AlertasRealtime /> : null}
      <main className="flex-1">{children}</main>
      <div className="no-print">
        <PieInstitucional className="bg-bg" />
      </div>
      <NavMovil oficial={oficial} avisosNoLeidos={avisosNoLeidos} />
    </div>
  );
}
