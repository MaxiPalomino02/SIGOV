import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFechaKey } from "@/lib/tablero";
import { formatearHoraEvento, ETIQUETAS_TIPO, type Evento, type TipoEvento } from "@/lib/eventos";

export async function ProximosEventos({ limite = 3 }: { limite?: number }) {
  const { createSupabaseClient } = await import("@/lib/supabase");
  const supabase = createSupabaseClient();
  const ahora = new Date().toISOString();

  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .gte("fin", ahora)
    .order("inicio", { ascending: true })
    .limit(limite);

  if (error) return null;
  const eventos = (data ?? []).filter((e: Evento) => e.id && e.titulo && e.tipo && e.inicio && e.fin);
  if (eventos.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="titulo-tarjeta">Próximos eventos</h2>
      </div>
      <ul className="mt-3 divide-y divide-line-subtle">
        {eventos.map((ev) => {
          const tipo = ev.tipo as TipoEvento;
          return (
            <li key={ev.id} className="py-2.5 first:pt-0 last:pb-0">
              <p className="text-[16px] text-ink">{ev.titulo}</p>
              <p className="texto-aux mt-0.5">
                {ETIQUETAS_TIPO[tipo]} · {formatFechaKey(ev.inicio.split("T")[0])} · {formatearHoraEvento(ev.inicio)} - {formatearHoraEvento(ev.fin)}
              </p>
              {ev.lugar ? <p className="texto-aux">{ev.lugar}</p> : null}
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <Link href="/calendario" className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap text-[16px] font-medium text-fire hover:underline">
          Ver calendario <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

export function SkeletonProximosEventos() {
  return (
    <Card className="p-5">
      <Skeleton className="h-5 w-36" />
      <div className="mt-4 space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </Card>
  );
}
