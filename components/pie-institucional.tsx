import { CUARTEL } from "@/lib/cuartel.config";
import { PRODUCTO } from "@/lib/marca";

export function PieInstitucional({
  className = "",
}: {
  className?: string;
}) {
  return (
    <footer className={`border-t border-separator ${className}`}>
      <div className="mx-auto w-full max-w-[1100px] px-4 py-4 text-[13px] text-label-2 lg:px-8">
        {PRODUCTO.nombre} · {CUARTEL.nombre} · {CUARTEL.localidad}, {CUARTEL.provincia}
      </div>
    </footer>
  );
}
