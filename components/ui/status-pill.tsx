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
    className: "border-green bg-green-tint text-green-ink",
  },
  "en-servicio": {
    label: "En servicio",
    Icon: CheckCircle2,
    className: "border-yellow bg-yellow-tint text-yellow-ink",
  },
  "fuera-de-servicio": {
    label: "Fuera de servicio",
    Icon: Wrench,
    className: "border-separator bg-surface-2 text-label-2",
  },
  pendiente: {
    label: "Pendiente",
    Icon: Clock3,
    className: "border-yellow bg-yellow-tint text-yellow-ink",
  },
  vencido: {
    label: "Vencido",
    Icon: XCircle,
    className: "border-red bg-red-tint text-red",
  },
  "sin-conexion": {
    label: "Sin conexión",
    Icon: WifiOff,
    className: "border-separator bg-surface-2 text-label-2",
  },
  cargado: {
    label: "Cargado",
    Icon: CheckCircle2,
    className: "border-green bg-green-tint text-green-ink",
  },
  borrador: {
    label: "Borrador",
    Icon: Clock3,
    className: "border-yellow bg-yellow-tint text-yellow-ink",
  },
  "guardado-offline": {
    label: "Guardado sin conexión",
    Icon: Download,
    className: "border-yellow bg-yellow-tint text-yellow-ink",
  },
  pdf: {
    label: "PDF",
    Icon: FileText,
    className: "border-red bg-red-tint text-red",
  },
  imagen: {
    label: "Imagen",
    Icon: ImageIcon,
    className: "border-separator bg-surface-2 text-label-2",
  },
  word: {
    label: "Word",
    Icon: FileType,
    className: "border-separator bg-surface-2 text-label-2",
  },
  excel: {
    label: "Excel",
    Icon: FileSpreadsheet,
    className: "border-separator bg-surface-2 text-label-2",
  },
  archivo: {
    label: "Archivo",
    Icon: File,
    className: "border-separator bg-surface-2 text-label-2",
  },
  charla: {
    label: "Charla",
    Icon: MessageCircle,
    className: "border-yellow bg-yellow-tint text-yellow-ink",
  },
  inspeccion: {
    label: "Inspección",
    Icon: ClipboardCheck,
    className: "border-separator bg-surface-2 text-label-2",
  },
  simulacro: {
    label: "Simulacro",
    Icon: Siren,
    className: "border-red bg-red-tint text-red",
  },
  otra: {
    label: "Otra",
    Icon: FileText,
    className: "border-separator bg-surface-2 text-label-2",
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
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border border-red bg-red-tint px-3 py-1 text-[13px] font-semibold text-red ${className}`}
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
        className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border border-separator bg-surface-2 px-3 py-1 text-[13px] font-semibold text-label-2 ${className}`}
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
