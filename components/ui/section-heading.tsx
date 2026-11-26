import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  titulo?: string;
  descripcion?: string;
  accion?: ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  className?: string;
};

export function SectionHeading({
  titulo,
  descripcion,
  accion,
  loading = false,
  error = null,
  empty = false,
  className = "",
}: Props) {
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`} aria-busy="true">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        className={`flex items-center gap-2 rounded-[12px] border border-red bg-red-tint px-3 py-2 text-[15px] text-red ${className}`}
      >
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
        <span>{error}</span>
      </div>
    );
  }
  if (empty || !titulo) {
    return (
      <div className={className}>
        <p className="text-[15px] text-label-2">Sin sección para mostrar.</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h1 className="text-[34px] font-bold tracking-[-.4px]">{titulo}</h1>
        {descripcion ? (
          <p className="text-[15px] mt-1 max-w-3xl">{descripcion}</p>
        ) : null}
      </div>
      {accion ? <div className="shrink-0">{accion}</div> : null}
    </div>
  );
}
