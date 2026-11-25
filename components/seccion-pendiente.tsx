import { PageHeader } from "@/components/page-header";
import { EstadoVacio } from "@/components/ui/estado-vacio";

type SeccionPendienteProps = {
  titulo: string;
  subtitulo?: string;
  descripcion: string;
  icono: string;
};

export function SeccionPendiente({
  titulo,
  subtitulo = "Módulo en preparación",
  descripcion,
  icono,
}: SeccionPendienteProps) {
  return (
    <>
      <PageHeader titulo={titulo} subtitulo={subtitulo} />
      <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6">
        <EstadoVacio icono={icono} titulo="Próximamente" texto={descripcion} />
      </div>
    </>
  );
}
