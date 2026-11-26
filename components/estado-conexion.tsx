"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { contarOperaciones, suscribirACola } from "@/lib/cola-sincronizacion";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function EstadoConexion() {
  const enLinea = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [pendientes, setPendientes] = useState(0);
  const [aviso, setAviso] = useState<number | null>(null);
  const anteriores = useRef(0);
  const temporizadores = useRef<number[]>([]);

  useEffect(() => {
    let activo = true;
    const actualizar = () => {
      void contarOperaciones()
        .then((cantidad) => {
          if (!activo) return;
          const antes = anteriores.current;
          anteriores.current = cantidad;
          setPendientes(cantidad);

          if (antes > 0 && cantidad === 0 && navigator.onLine) {
            setAviso(antes);
            temporizadores.current.push(
              window.setTimeout(() => setAviso(null), 4000)
            );
          }
        })
        .catch(() => void 0);
    };
    actualizar();
    const desuscribir = suscribirACola(actualizar);
    return () => {
      activo = false;
      desuscribir();
      temporizadores.current.forEach((id) => window.clearTimeout(id));
      temporizadores.current = [];
    };
  }, []);

  return (
    <>
      {!enLinea ? (
        <div
          className="no-print fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-2"
          role="status"
          aria-live="polite"
        >
          <div className="flex min-h-11 max-w-full items-center gap-2 rounded-[14px] bg-yellow-tint px-4 py-2 text-[15px] font-medium text-yellow-ink shadow-[0_1px_2px_rgba(0,0,0,.04)] animate-fade-in">
            <WifiOff size={22} strokeWidth={1.75} aria-hidden />
            <span>Sin conexión. Anotarse en guardias requiere internet.</span>
          </div>
        </div>
      ) : null}

      <span className="sr-only" role="status" aria-live="polite">
        {enLinea ? "En línea" : "Sin conexión"}
        {pendientes > 0 ? ` · ${pendientes} pendientes de sincronizar` : ""}
      </span>

      {aviso !== null ? (
        <div
          className="no-print fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 lg:bottom-6"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-full rounded-full border border-separator bg-surface px-5 py-3 text-[15px] font-medium text-label shadow-[0_1px_2px_rgba(0,0,0,.04)] animate-sheet-up">
            {aviso === 1
              ? "Se sincronizó 1 cambio"
              : `Se sincronizaron ${aviso} cambios`}
          </div>
        </div>
      ) : null}
    </>
  );
}
