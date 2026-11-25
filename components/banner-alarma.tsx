import Link from "next/link";
import { Siren } from "lucide-react";
import { createSupabaseClient } from "@/lib/supabase";
import { etiquetaAlarma } from "@/lib/alarma";

const AUTO_CIERRE_MS = 6 * 60 * 60 * 1000;

export async function BannerAlarma() {
  try {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("alarmas")
      .select("id, tipo, detalle, es_simulacro, activada_en")
      .eq("estado", "activa")
      .order("activada_en", { ascending: false })
      .limit(1);
    const row = (data ?? [])[0] as any;
    if (!row) return null;
    const t = Date.parse(row.activada_en ?? "");
    if (!Number.isFinite(t) || Date.now() - t >= AUTO_CIERRE_MS) return null;
    const etiqueta = etiquetaAlarma(row.tipo, Boolean(row.es_simulacro));
    return (
      <Link
        href="/alarma"
        className="no-print flex min-h-11 items-center gap-3 rounded-[12px] bg-fire-light px-4 py-2 text-ink hover:brightness-95"
        aria-label="Ver alarma activa"
      >
        <Siren className="h-4 w-4 shrink-0 text-fire" aria-hidden />
        <span className="min-w-0 flex-1 text-[16px] font-medium">
          Alarma activa{row.es_simulacro ? " · Simulacro" : ""}: {etiqueta}
          {row.detalle ? <span className="font-normal text-ink-muted"> · {row.detalle}</span> : null}
        </span>
        <span className="shrink-0 text-[13px] font-medium text-fire">Ver</span>
      </Link>
    );
  } catch {
    return null;
  }
}
