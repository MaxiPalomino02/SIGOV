import { Building2, CalendarClock, CloudRain, Droplets, Info, MapPin, Megaphone, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Grupo } from "@/components/ui/grupo";

export type TipoAlerta = "meteorologica" | "hidrologica" | "institucional";
export type NivelAlerta = "informativa" | "amarilla" | "naranja" | "roja";

export const NIVELES_ALERTA: Record<NivelAlerta, { label: string; Icon: LucideIcon; barra: string; chip: string; borde: string }> = {
  informativa: { label: "Informativa", Icon: Info, barra: "bg-label-3", chip: "bg-surface-2 text-label-2", borde: "border-separator" },
  amarilla: { label: "Amarilla", Icon: TriangleAlert, barra: "bg-yellow", chip: "bg-yellow-tint text-yellow-ink", borde: "border-yellow" },
  naranja: { label: "Naranja", Icon: TriangleAlert, barra: "bg-alerta-naranja", chip: "bg-alerta-naranja-tint text-label", borde: "border-alerta-naranja" },
  roja: { label: "Roja", Icon: Megaphone, barra: "bg-red", chip: "bg-red-tint text-red", borde: "border-red" },
};

export const TIPOS_ALERTA: Record<TipoAlerta, { label: string; Icon: LucideIcon }> = {
  meteorologica: { label: "Meteorológica", Icon: CloudRain },
  hidrologica: { label: "Hidrológica", Icon: Droplets },
  institucional: { label: "Institucional", Icon: Building2 },
};

type Props = {
  tipo: TipoAlerta;
  nivel: NivelAlerta;
  titulo: string;
  descripcion?: string;
  area?: string;
  fuente?: string;
  vigencia?: string;
  ultimaActualizacion?: string;
  finalizada?: boolean;
  cortoPlazo?: boolean;
  onVerMas?: () => void;
  onCerrar?: () => void;
  className?: string;
};

function FilaDato({ icono: Icono, etiqueta, valor }: { icono: LucideIcon; etiqueta: string; valor: string }) {
  return (
    <div className="fila flex items-center gap-3 px-4 py-2.5">
      <Icono size={22} strokeWidth={1.75} className="shrink-0 text-label-2" aria-hidden />
      <span className="w-[124px] shrink-0 text-[13px] text-label-2">{etiqueta}</span>
      <span className="num min-w-0 flex-1 text-[15px] text-label">{valor}</span>
    </div>
  );
}

export function AlertCard({
  tipo,
  nivel,
  titulo,
  descripcion,
  area,
  fuente,
  vigencia,
  ultimaActualizacion,
  finalizada = false,
  cortoPlazo = false,
  onVerMas,
  onCerrar,
  className = "",
}: Props) {
  const cfg = NIVELES_ALERTA[nivel];
  const tipoCfg = TIPOS_ALERTA[tipo];
  const IconNivel = cfg.Icon;
  const IconTipo = tipoCfg.Icon;

  return (
    <article className={`relative overflow-hidden rounded-[16px] border bg-surface ${cortoPlazo ? cfg.borde : "border-separator"} ${className}`}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${cfg.barra}`} />
      <div className="space-y-3 p-4 pl-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[13px] font-medium text-label-2">
            <IconTipo size={14} strokeWidth={1.75} aria-hidden />
            {tipoCfg.label}
          </span>
          <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium ${cfg.chip}`}>
            <IconNivel size={14} strokeWidth={1.75} aria-hidden />
            Nivel {cfg.label.toLowerCase()}
          </span>
          {cortoPlazo ? (
            <span className="inline-flex min-h-7 items-center rounded-full bg-surface-2 px-3 text-[13px] font-medium text-label-2">Corto plazo</span>
          ) : null}
          {finalizada ? (
            <span className="inline-flex min-h-7 items-center rounded-full bg-surface-2 px-3 text-[13px] font-medium text-label-2">Finalizada</span>
          ) : null}
        </div>

        <div>
          <h3 className={`text-[17px] ${finalizada ? "font-medium text-label-2" : "font-semibold text-label"}`}>{titulo}</h3>
          {descripcion ? (
            <>
              <p className="mt-1 line-clamp-3 text-[15px] leading-[1.45] text-label-2">{descripcion}</p>
              {onVerMas ? (
                <button type="button" onClick={onVerMas} className="tap mt-1 min-h-11 px-0 text-[15px] font-semibold text-red">
                  Ver más
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        <Grupo>
          {area ? <FilaDato icono={MapPin} etiqueta="Área" valor={area} /> : null}
          {vigencia ? <FilaDato icono={CalendarClock} etiqueta="Vigencia" valor={vigencia} /> : null}
          {ultimaActualizacion ? <FilaDato icono={RefreshCw} etiqueta="Última actualización" valor={ultimaActualizacion} /> : null}
        </Grupo>

        <div className="flex items-end justify-between gap-3">
          {fuente ? <p className="num text-[13px] text-label-2">Fuente: {fuente}</p> : <span />}
          {onCerrar ? (
            <Button variant="danger" size="sm" onClick={onCerrar}>
              Cerrar
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
