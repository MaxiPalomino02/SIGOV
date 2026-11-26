import { EncabezadoIsla } from "@/components/encabezado-isla";

function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-[12px] bg-surface-2 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="min-h-dvh bg-bg pb-24">
      <EncabezadoIsla titulo="Reportes" subtitulo="Cargando indicadores del cuartel..." />
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 lg:max-w-5xl">
        <section className="rounded-[16px] bg-surface p-4 sm:p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Skeleton className="h-[52px]" />
            <Skeleton className="h-[52px]" />
            <Skeleton className="h-[52px]" />
          </div>
        </section>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[96px] rounded-[16px]" />)}
        </section>
        {Array.from({ length: 4 }).map((_, i) => (
          <section key={i} className="rounded-[16px] bg-surface p-4 sm:p-5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-2 h-4 w-64 max-w-full" />
            <Skeleton className="mt-4 h-48 w-full" />
          </section>
        ))}
      </div>
    </div>
  );
}
