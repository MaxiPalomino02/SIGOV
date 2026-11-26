"use client";

import { useEffect, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Hoja } from "@/components/ui/hoja";
import styles from "./login.module.css";

type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function HelpSheet() {
  const [abierto, setAbierto] = useState(false);
  const [instalable, setInstalable] = useState(false);
  const eventoRef = useRef<EventoInstalacion | null>(null);

  useEffect(() => {
    const alPedir = (evento: Event) => {
      evento.preventDefault();
      eventoRef.current = evento as EventoInstalacion;
      setInstalable(true);
    };
    const alInstalar = () => {
      eventoRef.current = null;
      setInstalable(false);
    };

    window.addEventListener("beforeinstallprompt", alPedir);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPedir);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  async function instalar() {
    const evento = eventoRef.current;
    if (!evento) return;
    await evento.prompt();
    const eleccion = await evento.userChoice;
    eventoRef.current = null;
    setInstalable(false);
    if (eleccion.outcome === "accepted") setAbierto(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Ayuda e instalación de SIGOV"
        className={`${styles.ayuda} tap glass fixed z-40 flex h-11 w-11 items-center justify-center rounded-full border border-separator/60 text-label-2 shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-colors hover:text-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red`}
        style={{
          top: "calc(env(safe-area-inset-top) + 16px)",
          right: "calc(env(safe-area-inset-right) + 16px)",
        }}
      >
        <CircleHelp size={22} strokeWidth={1.75} aria-hidden />
      </button>

      <Hoja
        open={abierto}
        onClose={() => setAbierto(false)}
        title="Ayuda"
        footer={
          instalable ? (
            <button
              type="button"
              onClick={() => void instalar()}
              className="tap flex h-11 w-full items-center justify-center rounded-[14px] bg-red px-5 text-[17px] font-semibold text-surface transition-colors hover:bg-red-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
            >
              Instalar SIGOV
            </button>
          ) : undefined
        }
      >
        <div className="space-y-5">
          <section>
            <h3 className="text-[17px] font-semibold text-label">Legajo</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-label-2">
              Tu legajo son los tres números que usás para entrar. Si no lo sabés, preguntale al
              responsable del cuartel.
            </p>
          </section>

          <section>
            <h3 className="text-[17px] font-semibold text-label">Instalar SIGOV</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-label-2">
              iPhone: Compartir → Agregar a pantalla de inicio.
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-label-2">
              Android: Menú → Instalar app.
            </p>
          </section>
        </div>
      </Hoja>
    </>
  );
}
