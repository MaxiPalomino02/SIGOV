import { Fila } from "@/components/ui/fila";
import { Grupo } from "@/components/ui/grupo";
import { Skeleton } from "@/components/ui/skeleton";
import { formatFechaKey } from "@/lib/tablero";
import { ETIQUETAS_TIPO, formatearHoraEvento, type Evento, type TipoEvento } from "@/lib/eventos";

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
  const eventos = (data ?? []).filter(
    (e: Evento) => e.id && e.titulo && e.tipo && e.inicio && e.fin,
  );
  if (eventos.length === 0) return null;

  return (
    <Grupo titulo="Próximos eventos">
      {eventos.map((ev) => {
        const tipo = ev.tipo as TipoEvento;
        const subtitulo = `${ETIQUETAS_TIPO[tipo]} · ${formatFechaKey(ev.inicio.split("T")[0])} · ${formatearHoraEvento(ev.inicio)} - ${formatearHoraEvento(ev.fin)}${ev.lugar ? ` · ${ev.lugar}` : ""}`;
        return <Fila key={ev.id} titulo={ev.titulo} subtitulo={subtitulo} />;
      })}
    </Grupo>
  );
}

export function SkeletonProximosEventos() {
  return (
    <Grupo titulo="Próximos eventos">
      {[0, 1, 2].map((i) => (
        <div key={i} className="fila flex items-center gap-3 px-4 py-3">
          <span className="min-w-0 flex-1">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="mt-2 h-3 w-56 max-w-full" />
          </span>
        </div>
      ))}
    </Grupo>
  );
}
