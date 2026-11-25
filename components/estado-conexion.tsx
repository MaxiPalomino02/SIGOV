"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CloudUpload, Wifi, WifiOff } from "lucide-react";
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

  useEffect(() => {
    let activo = true;
    const actualizar = () => {
      void contarOperaciones()
        .then((cantidad) => {
          if (activo) setPendientes(cantidad);
        })
        .catch(() => void 0);
    };
    actualizar();
    const desuscribir = suscribirACola(actualizar);
    return () => {
      activo = false;
      desuscribir();
    };
  }, []);

  const textoPendientes = `${pendientes} ${
    pendientes === 1 ? "pendiente" : "pendientes"
  } de sincronizar`;

  return (
    <span className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <span
        className="inline-flex h-11 w-11 items-center justify-center"
        title={enLinea ? "En línea" : "Sin conexión"}
        aria-label={enLinea ? "En línea" : "Sin conexión"}
      >
        <span className="relative inline-flex">
          <span
            className={`h-2.5 w-2.5 rounded-full ${enLinea ? "bg-ok" : "bg-alarm"}`}
            aria-hidden
          />
          {!enLinea ? (
            <WifiOff className="absolute -right-3 -top-2 h-3.5 w-3.5 text-alarm" aria-hidden />
          ) : null}
        </span>
      </span>

      {!enLinea ? (
        <span className="hidden max-w-40 text-right text-[13px] leading-tight text-ink-muted sm:block">
          Anotarse en guardias requiere conexión.
        </span>
      ) : null}

      {pendientes > 0 ? (
        <span
          className="inline-flex items-center gap-1 font-mono text-[11px] text-alarm"
          aria-label={textoPendientes}
          title={textoPendientes}
        >
          <CloudUpload className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">{textoPendientes}</span>
          <span className="sm:hidden">{pendientes}</span>
        </span>
      ) : null}
    </span>
  );
}
