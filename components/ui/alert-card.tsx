"use client";

import {
  AlertCircle,
  Building2,
  CloudRain,
  Droplets,
  Info,
  Megaphone,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export type TipoAlerta = "meteorologica" | "hidrologica" | "institucional";
export type NivelAlerta = "informativa" | "amarilla" | "naranja" | "roja";

const TIPO: Record<TipoAlerta, { label: string; Icon: LucideIcon }> = {
  meteorologica: { label: "Meteorológica", Icon: CloudRain },
  hidrologica: { label: "Hidrológica", Icon: Droplets },
  institucional: { label: "Institucional", Icon: Building2 },
};

const NIVEL: Record<
  NivelAlerta,
  { label: string; Icon: LucideIcon; bar: string; badge: string }
> = {
  informativa: {
    label: "Informativa",
    Icon: Info,
    bar: "bg-ink-muted",
    badge: "border-line bg-bg-subtle text-ink-muted",
  },
  amarilla: {
    label: "Amarilla",
    Icon: TriangleAlert,
    bar: "bg-smn-amarilla",
    badge: "border-smn-amarilla/40 bg-smn-amarilla/15 text-smn-amarilla",
  },
  naranja: {
    label: "Naranja",
    Icon: TriangleAlert,
    bar: "bg-smn-naranja",
    badge: "border-smn-naranja/40 bg-smn-naranja/15 text-smn-naranja",
  },
  roja: {
    label: "Roja",
    Icon: Megaphone,
    bar: "bg-smn-roja",
    badge: "border-smn-roja/50 bg-smn-roja/15 text-fire-text",
  },
};

type Props = {
  tipo?: TipoAlerta;
  nivel?: NivelAlerta;
  titulo?: string;
  descripcion?: string;
  area?: string;
  fuente?: string;
  vigencia?: string;
  ultimaActualizacion?: string;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  className?: string;
};

export function AlertCard({
  tipo,
  nivel,
  titulo,
  descripcion,
  area,
  fuente,
  vigencia,
  ultimaActualizacion,
  loading = false,
  error = null,
  empty = false,
  className = "",
}: Props) {
  if (loading) {
    return (
      <article
        className={`rounded-xl border border-line bg-surface p-4 ${className}`}
        aria-busy="true"
        aria-label="Cargando alerta"
      >
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </article>
    );
  }
  if (error) {
    return (
      <article
        role="alert"
        className={`flex items-start gap-3 rounded-xl border border-error-border bg-error-light p-4 text-error-text ${className}`}
      >
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">Error al cargar la alerta</p>
          <p className="mt-1 text-[14px]">{error}</p>
        </div>
      </article>
    );
  }
  if (empty || !tipo || !nivel || !titulo) {
    return (
      <article
        className={`flex items-center gap-3 rounded-xl border border-line bg-bg-subtle p-4 text-ink-muted ${className}`}
      >
        <Info className="h-5 w-5 shrink-0" aria-hidden />
        <p className="text-[14px]">No hay alertas para mostrar.</p>
      </article>
    );
  }

  const tipoCfg = TIPO[tipo];
  const nivelCfg = NIVEL[nivel];
  const TipoIcon = tipoCfg.Icon;
  const NivelIcon = nivelCfg.Icon;

  return (
    <article
      className={`relative overflow-hidden rounded-xl border border-line bg-surface ${className}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${nivelCfg.bar}`} />
      <div className="p-4 pl-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-semibold uppercase tracking-widest text-ink-muted">
            <TipoIcon className="h-4 w-4" aria-hidden />
            {tipoCfg.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${nivelCfg.badge}`}
          >
            <NivelIcon className="h-3.5 w-3.5" aria-hidden />
            Nivel {nivelCfg.label}
          </span>
        </div>

        <h3 className="heading-display mt-2 text-lg leading-tight text-ink">{titulo}</h3>
        {descripcion ? (
          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{descripcion}</p>
        ) : null}

        <dl className="mt-3 grid gap-x-4 gap-y-1 text-[13px] text-ink-muted sm:grid-cols-2">
          {area ? (
            <div>
              <dt className="inline font-semibold text-ink">Área: </dt>
              <dd className="inline">{area}</dd>
            </div>
          ) : null}
          {vigencia ? (
            <div>
              <dt className="inline font-semibold text-ink">Vigencia: </dt>
              <dd className="inline">{vigencia}</dd>
            </div>
          ) : null}
          {ultimaActualizacion ? (
            <div>
              <dt className="inline font-semibold text-ink">Última actualización: </dt>
              <dd className="inline">{ultimaActualizacion}</dd>
            </div>
          ) : null}
        </dl>
        {fuente ? (
          <p className="mt-3 border-t border-line-subtle pt-2 font-mono text-[13px] uppercase tracking-widest text-ink-secondary">
            Fuente: {fuente}
          </p>
        ) : null}
      </div>
    </article>
  );
}
