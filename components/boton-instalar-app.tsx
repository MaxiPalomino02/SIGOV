"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function enModoIndependiente(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function esIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const ipadModerno =
    navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iphone || ipadModerno;
}

export function BotonInstalarApp() {
  const promptRef = useRef<EventoInstalacion | null>(null);
  const [oculto, setOculto] = useState(enModoIndependiente);
  const [instalable, setInstalable] = useState(false);
  const [instrucciones, setInstrucciones] = useState(false);
  const [iphone] = useState(esIphone);

  useEffect(() => {
    const alPedirInstalacion = (evento: Event) => {
      evento.preventDefault();
      promptRef.current = evento as EventoInstalacion;
      setInstalable(true);
    };
    const alInstalar = () => {
      promptRef.current = null;
      setInstalable(false);
      setOculto(true);
    };
    window.addEventListener("beforeinstallprompt", alPedirInstalacion);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPedirInstalacion);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (oculto) return null;

  const instalar = async () => {
    if (promptRef.current) {
      await promptRef.current.prompt();
      const eleccion = await promptRef.current.userChoice;
      promptRef.current = null;
      setInstalable(false);
      if (eleccion.outcome === "accepted") setOculto(true);
      return;
    }
    setInstrucciones(true);
  };

  return (
    <div className="no-print fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2 lg:bottom-6">
      {instrucciones ? (
        <div className="w-72 rounded-xl border border-line bg-surface p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              Instalar SIGOV
            </p>
            <button
              type="button"
              onClick={() => setInstrucciones(false)}
              aria-label="Cerrar instrucciones de instalación"
              className="flex size-11 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-ink">
            {iphone
              ? "Tocá Compartir y después Agregar a pantalla de inicio."
              : "Abrí el menú del navegador y elegí Instalar app o Agregar a pantalla de inicio."}
          </p>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void instalar()}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-ink shadow-lg hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
        aria-label="Instalar SIGOV en el dispositivo"
      >
        <Download className="size-4 text-fire-text" aria-hidden />
        {instalable ? "Instalar SIGOV" : "Cómo instalar SIGOV"}
      </button>
    </div>
  );
}
