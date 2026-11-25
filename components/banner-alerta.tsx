import "server-only";
import { CloudRain, Droplets, Building2, TriangleAlert, Info, Megaphone } from "lucide-react";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase";
import { estadoVigenteCalculado, FUENTE_SMN, refrescarSmnSiCorresponde } from "@/lib/alertas";

type Nivel = "informativa" | "amarilla" | "naranja" | "roja";
type Tipo = "meteorologica" | "hidrologica" | "institucional";

const NIVEL_CFG: Record<Nivel, { label: string; cls: string; icon: typeof Info }> = {
  informativa: { label: "Alerta informativa", cls: "border-line bg-bg-subtle text-ink", icon: Info },
  amarilla: { label: "Alerta amarilla", cls: "border-smn-amarilla/50 bg-smn-amarilla/10 text-smn-amarilla", icon: TriangleAlert },
  naranja: { label: "Alerta naranja", cls: "border-smn-naranja/50 bg-smn-naranja/10 text-smn-naranja", icon: TriangleAlert },
  roja: { label: "Alerta roja", cls: "border-smn-roja/60 bg-smn-roja/15 text-fire-text", icon: Megaphone },
};
const TIPO_ICON: Record<Tipo, typeof CloudRain> = {
  meteorologica: CloudRain,
  hidrologica: Droplets,
  institucional: Building2,
};

function fmtHasta(hasta: string | null) {
  if (!hasta) return "";
  const d = new Date(hasta);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

export async function BannerAlerta() {
  // refresco perezoso en segundo plano si >15 min (throttling interno)
  await refrescarSmnSiCorresponde();

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("alertas")
      .select("id, tipo_fuente, nivel, fenomeno, titulo, hasta, estado")
      .in("estado", ["vigente"])
      .order("actualizada_en", { ascending: false })
      .limit(50);
    if (error) return null;

    const ahora = new Date();
    const vigentes = (data ?? []).filter((a: any) =>
      estadoVigenteCalculado(a.estado, a.hasta, ahora) === "vigente"
    );
    if (vigentes.length === 0) return null;

    const peso: Record<Nivel, number> = { roja: 3, naranja: 2, amarilla: 1, informativa: 0 };
    vigentes.sort((a: any, b: any) => (peso[b.nivel as Nivel] ?? 0) - (peso[a.nivel as Nivel] ?? 0));
    const top = vigentes[0] as any;
    const nivel = (top.nivel as Nivel) in NIVEL_CFG ? (top.nivel as Nivel) : "informativa";
    const tipo = (top.tipo_fuente as Tipo) in TIPO_ICON ? (top.tipo_fuente as Tipo) : "institucional";
    const cfg = NIVEL_CFG[nivel];
    const IconNivel = cfg.icon;
    const IconTipo = TIPO_ICON[tipo];
    const hastaTxt = fmtHasta(top.hasta);
    const fenomeno = top.fenomeno || top.titulo || "alerta";
    const texto = `${cfg.label} por ${fenomeno}${hastaTxt ? ` hasta las ${hastaTxt}` : ""}`;

    return (
      <Link
        href="/alertas"
        className={`flex min-h-11 items-center gap-3 rounded-[12px] border px-4 py-2 transition-colors hover:brightness-95 ${cfg.cls}`}
        aria-label={`${texto}. Ver alertas`}
      >
        <IconNivel className="h-4 w-4 shrink-0" aria-hidden />
        <IconTipo className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1 text-[16px] font-medium leading-snug">{texto}</span>
        <span className="shrink-0 text-[15px] font-semibold text-ink">Ver</span>
      </Link>
    );
  } catch {
    return null;
  }
}
