import Link from "next/link";
import { Siren } from "lucide-react";
import { createSupabaseClient } from "@/lib/supabase";
import { etiquetaAlarma } from "@/lib/alarma";

const AUTO_CIERRE_MS = 6 * 60 * 60 * 1000;

type AlarmaActiva = {
  tipo: unknown;
  detalle: unknown;
  es_simulacro: unknown;
  activada_en: unknown;
};

export async function BannerAlarma() {
  let vista: { etiqueta: string; simulacro: boolean; detalle: string } | null = null;
  try {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from("alarmas")
      .select("id, tipo, detalle, es_simulacro, activada_en")
      .eq("estado", "activa")
      .order("activada_en", { ascending: false })
      .limit(1);
    const row = (data ?? [])[0] as AlarmaActiva | undefined;
    if (row) {
      const t = Date.parse(typeof row.activada_en === "string" ? row.activada_en : "");
      // eslint-disable-next-line react-hooks/purity -- comparación temporal en server component
      const vigente = Number.isFinite(t) && Date.now() - t < AUTO_CIERRE_MS;
      if (vigente) {
        vista = {
          etiqueta: etiquetaAlarma(
            typeof row.tipo === "string" ? row.tipo : "",
            Boolean(row.es_simulacro),
          ),
          simulacro: Boolean(row.es_simulacro),
          detalle: typeof row.detalle === "string" ? row.detalle.trim() : "",
        };
      }
    }
  } catch {
    return null;
  }

  if (!vista) return null;

  return (
    <Link
      href="/alarma"
      className="no-print tap flex min-h-[56px] items-center gap-3 rounded-[16px] bg-red px-4 py-3 text-surface transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
      aria-label={`Alarma activa: ${vista.etiqueta}. Responder`}
    >
      <Siren size={22} strokeWidth={1.75} className="shrink-0 text-surface" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold leading-tight">
          {vista.etiqueta}
          {vista.simulacro ? " · Simulacro" : ""}
        </span>
        {vista.detalle ? (
          <span className="block truncate text-[15px] text-surface">{vista.detalle}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-[15px] font-semibold text-surface">Responder</span>
    </Link>
  );
}
