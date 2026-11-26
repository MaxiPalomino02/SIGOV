"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { CircleX, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hoja } from "@/components/ui/hoja";
import { login, type LoginState } from "./actions";
import { RosterList, type RosterBombero } from "./roster-list";

const MENSAJE_BLOQUEO = "Demasiados intentos. Probá en unos minutos.";

type EventoInstalacion = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function esIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  const iphone = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const ipadModerno = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iphone || ipadModerno;
}

export function LoginForm({ bomberos }: { bomberos: RosterBombero[] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {
    error: null,
  });
  const [legajo, setLegajo] = useState("");
  const [instalacionAbierta, setInstalacionAbierta] = useState(false);
  const [instalable, setInstalable] = useState(false);
  const [iphone, setIphone] = useState(false);
  const promptRef = useRef<EventoInstalacion | null>(null);
  const errorId = useId();
  const listo = /^\d{3}$/.test(legajo);
  const bloqueado = state.error === MENSAJE_BLOQUEO;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIphone(esIphone()));
    const alPedirInstalacion = (evento: Event) => {
      evento.preventDefault();
      promptRef.current = evento as EventoInstalacion;
      setInstalable(true);
    };
    const alInstalar = () => {
      promptRef.current = null;
      setInstalable(false);
      setInstalacionAbierta(false);
    };
    window.addEventListener("beforeinstallprompt", alPedirInstalacion);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("beforeinstallprompt", alPedirInstalacion);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  async function instalar() {
    if (!promptRef.current) return;
    await promptRef.current.prompt();
    const eleccion = await promptRef.current.userChoice;
    promptRef.current = null;
    setInstalable(false);
    if (eleccion.outcome === "accepted") setInstalacionAbierta(false);
  }

  return (
    <>
      <form action={action} className="mt-6">
        <label htmlFor="numero_ingreso" className="sr-only">
          Número de legajo
        </label>
        <input
          id="numero_ingreso"
          name="numero_ingreso"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus
          value={legajo}
          maxLength={3}
          placeholder="000"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
          onChange={(evento) => setLegajo(evento.target.value.replace(/\D/g, "").slice(0, 3))}
          className="num h-16 w-full rounded-[16px] bg-surface px-4 text-center text-[34px] font-bold leading-none text-label placeholder:text-label-2 focus:outline-2 focus:outline-offset-2 focus:outline-red"
        />

        <div aria-live="polite" aria-atomic="true">
          {state.error ? (
            <div
              id={errorId}
              role="alert"
              className="mt-3 flex items-start gap-3 rounded-[16px] bg-red-tint p-4 text-left text-red"
            >
              <CircleX size={22} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
              <p className="text-[15px] font-medium leading-snug">{state.error}</p>
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={pending || !listo || bloqueado}
          className="tap mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-red px-6 text-[17px] font-semibold text-surface transition-colors hover:bg-red-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red disabled:pointer-events-none disabled:text-label-2 disabled:bg-surface-2"
        >
          {pending ? (
            <>
              <LoaderCircle size={22} strokeWidth={1.75} className="animate-spin" aria-hidden />
              <span>Ingresando al sistema…</span>
            </>
          ) : (
            "Ingresar"
          )}
        </button>
      </form>

      <div className="mt-5">
        <RosterList bomberos={bomberos} onSeleccionar={setLegajo} />
      </div>

      <button
        type="button"
        onClick={() => setInstalacionAbierta(true)}
        className="tap mt-4 flex min-h-11 w-full items-center justify-center rounded-[14px] text-[13px] text-label-2 transition-colors hover:text-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red"
      >
        Cómo instalar SIGOV
      </button>

      <Hoja
        open={instalacionAbierta}
        onClose={() => setInstalacionAbierta(false)}
        title="Cómo instalar SIGOV"
        footer={
          instalable ? (
            <Button className="w-full" onClick={() => void instalar()}>
              Instalar SIGOV
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setInstalacionAbierta(false)}
            >
              Entendido
            </Button>
          )
        }
      >
        <p className="text-[17px] leading-relaxed text-label">
          {iphone
            ? "Tocá Compartir y después Agregar a pantalla de inicio."
            : "Abrí el menú del navegador y elegí Instalar app o Agregar a pantalla de inicio."}
        </p>
      </Hoja>
    </>
  );
}
