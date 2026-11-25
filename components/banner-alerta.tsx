import "server-only";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase";
import { estadoVigenteCalculado, refrescarSmnSiCorresponde } from "@/lib/alertas";
import { NIVELES_ALERTA, TIPOS_ALERTA, type NivelAlerta, type TipoAlerta } from "@/components/ui/alert-card";

type AlertaRow = {
  tipo_fuente: unknown;
  nivel: unknown;
  fenomeno: unknown;
  titulo: unknown;
  hasta: unknown;
  estado: unknown;
};

function fmtHasta(hasta: unknown) {
  if (typeof hasta !== "string" || !hasta) return "";
  const d = new Date(hasta);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Tucuman",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function esNivel(valor: unknown): valor is NivelAlerta {
  return valor === "informativa" || valor === "amarilla" || valor === "naranja" || valor === "roja";
}

function esTipo(valor: unknown): valor is TipoAlerta {
  return valor === "meteorologica" || valor === "hidrologica" || valor === "institucional";
}

export async function BannerAlerta() {
  await refrescarSmnSiCorresponde();

  let vista: {
    texto: string;
    extra: string;
    cls: string;
    IconNivel: LucideIcon;
    IconTipo: LucideIcon;
  } | null = null;

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("alertas")
      .select("id, tipo_fuente, nivel, fenomeno, titulo, hasta, estado")
      .in("estado", ["vigente"])
      .order("actualizada_en", { ascending: false })
      .limit(50);
    if (!error) {
      const ahora = new Date();
      const vigentes = (data ?? []).filter((a: AlertaRow) =>
        estadoVigenteCalculado(String(a.estado ?? ""), typeof a.hasta === "string" ? a.hasta : null, ahora) === "vigente",
      );

      if (vigentes.length > 0) {
        const peso: Record<NivelAlerta, number> = { roja: 3, naranja: 2, amarilla: 1, informativa: 0 };
        vigentes.sort((a, b) => {
          const na = esNivel(a.nivel) ? a.nivel : "informativa";
          const nb = esNivel(b.nivel) ? b.nivel : "informativa";
          return peso[nb] - peso[na];
        });
        const top = vigentes[0];
        const nivel = esNivel(top.nivel) ? top.nivel : "informativa";
        const tipo = esTipo(top.tipo_fuente) ? top.tipo_fuente : "institucional";
        const cfg = NIVELES_ALERTA[nivel];
        const hastaTxt = fmtHasta(top.hasta);
        const fenomeno =
          (typeof top.fenomeno === "string" && top.fenomeno.trim()) ||
          (typeof top.titulo === "string" && top.titulo.trim()) ||
          "alerta";
        vista = {
          texto: `Alerta ${cfg.label.toLowerCase()} por ${fenomeno}${hastaTxt ? ` hasta las ${hastaTxt}` : ""}`,
          extra: vigentes.length > 1 ? ` y ${vigentes.length - 1} más` : "",
          cls: cfg.chip,
          IconNivel: cfg.Icon,
          IconTipo: TIPOS_ALERTA[tipo].Icon,
        };
      }
    }
  } catch {
    return null;
  }

  if (!vista) return null;
  const { IconNivel, IconTipo } = vista;

  return (
    <Link
      href="/alertas"
      className={`tap flex min-h-11 items-center gap-3 rounded-[16px] px-4 py-3 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${vista.cls}`}
      aria-label={`${vista.texto}${vista.extra}. Ver alertas`}
    >
      <IconNivel size={22} strokeWidth={1.75} className="shrink-0" aria-hidden />
      <IconTipo size={22} strokeWidth={1.75} className="shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 text-[15px] font-medium leading-snug">
        {vista.texto}
        {vista.extra ? <span className="font-normal">{vista.extra}</span> : null}
      </span>
      <ChevronRight size={22} strokeWidth={1.75} className="shrink-0 opacity-70" aria-hidden />
    </Link>
  );
}
