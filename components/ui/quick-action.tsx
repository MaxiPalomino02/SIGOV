"use client";

import Link from "next/link";
import * as Lucide from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  icono?: LucideIcon | string;
  titulo?: string;
  descripcion?: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  className?: string;
};

const base =
  "group flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fire-soft focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function QuickAction({
  icono: Icono,
  titulo,
  descripcion,
  href,
  onClick,
  loading = false,
  error = null,
  empty = false,
  className = "",
}: Props) {
  if (loading) {
    return (
      <div
        className={`flex min-h-12 items-center gap-3 rounded-xl border border-line bg-surface p-3 ${className}`}
        aria-busy="true"
      >
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        className={`flex min-h-12 items-center gap-3 rounded-xl border border-error-border bg-error-light p-3 text-error-text ${className}`}
      >
        <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
        <span className="text-[14px] font-semibold">{error}</span>
      </div>
    );
  }
  if (empty || !titulo) {
    return (
      <div
        className={`flex min-h-12 items-center gap-3 rounded-xl border border-line bg-bg-subtle p-3 text-ink-muted ${className}`}
      >
        <Inbox className="h-5 w-5 shrink-0" aria-hidden />
        <span className="text-[14px]">Sin acción disponible</span>
      </div>
    );
  }

  const ICONOS = Lucide as unknown as Record<string, LucideIcon | undefined>;
  const IconoResuelto = typeof Icono === "string" ? (ICONOS[Icono] ?? Inbox) : (Icono ?? Inbox);
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line-subtle bg-bg-subtle text-fire-text transition-colors group-hover:border-fire-border group-hover:bg-fire-light">
        <IconoResuelto className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-ink">{titulo}</span>
        {descripcion ? (
          <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">
            {descripcion}
          </span>
        ) : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${base} hover:bg-surface-hover ${className}`}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} cursor-pointer hover:bg-surface-hover ${className}`}
    >
      {content}
    </button>
  );
}
