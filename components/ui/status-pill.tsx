"use client";

import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  File,
  FileSpreadsheet,
  FileText,
  FileType,
  Image as ImageIcon,
  MessageCircle,
  Siren,
  WifiOff,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export type EstadoStatusPill =
  | "operativo"
  | "en-servicio"
  | "fuera-de-servicio"
  | "pendiente"
  | "vencido"
  | "sin-conexion"
  | "cargado"
  | "borrador"
  | "guardado-offline"
  | "pdf"
  | "imagen"
  | "word"
  | "excel"
  | "archivo"
  | "charla"
  | "inspeccion"
  | "simulacro"
  | "otra";

type Config = {
  label: string;
  Icon: LucideIcon;
  className: string;
};

const CONFIG: Record<EstadoStatusPill, Config> = {
  operativo: {
    label: "Operativo",
    Icon: CheckCircle2,
    className: "border-ok/40 bg-ok-light text-ok",
  },
  "en-servicio": {
    label: "En servicio",
    Icon: CheckCircle2,
    className: "border-alarm-border bg-alarm-light text-alarm",
  },
  "fuera-de-servicio": {
    label: "Fuera de servicio",
    Icon: Wrench,
    className: "border-line bg-bg-subtle text-ink-muted",
  },
  pendiente: {
    label: "Pendiente",
    Icon: Clock3,
    className: "border-brass-border bg-brass-light text-brass",
  },
  vencido: {
    label: "Vencido",
    Icon: XCircle,
    className: "border-error-border bg-error-light text-error-text",
  },
  "sin-conexion": {
    label: "Sin conexión",
    Icon: WifiOff,
    className: "border-line bg-surface-hover text-ink-muted",
  },
  cargado: {
    label: "Cargado",
    Icon: CheckCircle2,
    className: "border-ok/40 bg-ok-light text-ok",
  },
  borrador: {
    label: "Borrador",
    Icon: Clock3,
    className: "border-brass-border bg-brass-light text-brass",
  },
  "guardado-offline": {
    label: "Guardado sin conexión",
    Icon: Download,
    className: "border-brass-border bg-brass-light text-brass",
  },
  pdf: {
    label: "PDF",
    Icon: FileText,
    className: "border-fire-border bg-fire-light text-fire-text",
  },
  imagen: {
    label: "Imagen",
    Icon: ImageIcon,
    className: "border-line bg-bg-subtle text-ink-muted",
  },
  word: {
    label: "Word",
    Icon: FileType,
    className: "border-line bg-bg-subtle text-ink-muted",
  },
  excel: {
    label: "Excel",
    Icon: FileSpreadsheet,
    className: "border-line bg-bg-subtle text-ink-muted",
  },
  archivo: {
    label: "Archivo",
    Icon: File,
    className: "border-line bg-bg-subtle text-ink-muted",
  },
  charla: {
    label: "Charla",
    Icon: MessageCircle,
    className: "border-brass-border bg-brass-light text-brass",
  },
  inspeccion: {
    label: "Inspección",
    Icon: ClipboardCheck,
    className: "border-line bg-bg-subtle text-ink-muted",
  },
  simulacro: {
    label: "Simulacro",
    Icon: Siren,
    className: "border-alarm-border bg-alarm-light text-alarm",
  },
  otra: {
    label: "Otra",
    Icon: FileText,
    className: "border-line bg-bg-subtle text-ink-muted",
  },
};

type Props = {
  estado?: EstadoStatusPill;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  className?: string;
};

export function StatusPill({
  estado,
  loading = false,
  error = null,
  empty = false,
  className = "",
}: Props) {
  if (loading) {
    return <Skeleton className={`h-8 w-32 rounded-full ${className}`} />;
  }
  if (error) {
    return (
      <span
        role="status"
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border border-error-border bg-error-light px-3 py-1 text-[13px] font-semibold text-error-text ${className}`}
      >
        <AlertCircle className="h-4 w-4" aria-hidden />
        <span>{error}</span>
      </span>
    );
  }
  if (empty || !estado) {
    return (
      <span
        role="status"
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border border-line bg-bg-subtle px-3 py-1 text-[13px] font-semibold text-ink-muted ${className}`}
      >
        <Clock3 className="h-4 w-4" aria-hidden />
        <span>Sin estado</span>
      </span>
    );
  }
  const { label, Icon, className: tone } = CONFIG[estado];
  return (
    <span
      role="status"
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold ${tone} ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span>{label}</span>
    </span>
  );
}
