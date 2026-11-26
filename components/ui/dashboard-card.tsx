"use client";

import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  titulo?: string;
  descripcion?: string;
  encabezadoAccion?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTexto?: string;
  className?: string;
};

export function DashboardCard({
  titulo,
  descripcion,
  encabezadoAccion,
  children,
  loading = false,
  error = null,
  empty = false,
  emptyTexto = "No hay información para mostrar.",
  className = "",
}: Props) {
  return (
    <section className={`overflow-hidden rounded-[16px] bg-surface shadow-[0_1px_2px_rgba(0,0,0,.04)] ${className}`}>
      <header className="px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {loading ? <Skeleton className="h-5 w-40" /> : <h2 className="text-[22px] font-bold">{titulo ?? "Panel"}</h2>}
            {loading ? <Skeleton className="mt-2 h-4 w-64 max-w-full" /> : descripcion ? <p className="text-[15px] mt-1">{descripcion}</p> : null}
          </div>
          {encabezadoAccion ? <div className="shrink-0">{encabezadoAccion}</div> : null}
        </div>
      </header>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Cargando contenido">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : error ? (
          <div role="alert" className="flex items-start gap-2 rounded-[14px] bg-red-tint p-3 text-[15px] text-red">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-[14px] bg-surface-2 px-4 py-8 text-center text-label-2">
            <Inbox className="h-8 w-8" aria-hidden />
            <p className="text-[15px]">{emptyTexto}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
